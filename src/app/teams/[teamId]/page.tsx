
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, ArrowLeft, Trophy, Activity, History as HistoryIcon, Loader2, Edit2, Camera, Upload, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';

export default function TeamDetailsPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const teamRef = useMemoFirebase(() => teamId ? doc(db, 'teams', teamId) : null, [db, teamId]);
  const { data: team, isLoading: isTeamLoading } = useDoc(teamRef);

  const playersQuery = useMemoFirebase(() => teamId ? query(collection(db, 'players'), where('teamId', '==', teamId)) : null, [db, teamId]);
  const { data: players, isLoading: isPlayersLoading } = useCollection(playersQuery);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: allMatches, isLoading: isMatchesLoading } = useCollection(allMatchesQuery);

  const squadDeliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(squadDeliveriesQuery);

  const activeMatchIds = useMemo(() => new Set(allMatches?.map(m => m.id) || []), [allMatches]);

  const allDeliveries = useMemo(() => {
    if (!rawDeliveries || !allMatches || allMatches.length === 0) return [];
    return rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && activeMatchIds.has(matchId);
    });
  }, [rawDeliveries, allMatches, activeMatchIds]);

  const standingsForThisTeam = useMemo(() => {
    if (!teamId || !allMatches || !allMatches.length) return { played: 0, won: 0, lost: 0, drawn: 0, nrr: 0 };
    
    let played = 0, won = 0, lost = 0, drawn = 0;
    const teamName = team?.name.toLowerCase() || '';

    allMatches.filter(m => m.status === 'completed' && (m.team1Id === teamId || m.team2Id === teamId)).forEach(m => {
      played++;
      const result = m.resultDescription?.toLowerCase() || '';
      if (result.includes(teamName) && result.includes('won')) {
        won++;
      } else if (result.includes('drawn') || result.includes('tied')) {
        drawn++;
      } else {
        lost++;
      }
    });

    return { played, won, lost, drawn, nrr: team?.netRunRate || 0 };
  }, [allMatches, teamId, team?.name, team?.netRunRate]);

  const squadStats = useMemo(() => {
    if (!players || players.length === 0) return {};
    
    const pMatchStats: Record<string, Record<string, any>> = {};
    const careerTotals: Record<string, any> = {};

    players.forEach(p => {
      careerTotals[p.id] = { id: p.id, name: p.name, runs: 0, wickets: 0, cvp: 0, wides: 0, noBalls: 0 };
    });

    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const sId = d.strikerPlayerId;
      const bId = d.bowlerId || d.bowlerPlayerId;
      const fId = d.fielderPlayerId;

      const involvedIds = [sId, bId, fId].filter(id => id && id !== 'none');
      involvedIds.forEach(pid => {
        if (!careerTotals[pid]) return; 
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId!]) {
          pMatchStats[pid][matchId!] = { id: pid, name: '', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
        }
      });

      if (careerTotals[sId] && pMatchStats[sId]?.[matchId!]) {
        const sStats = pMatchStats[sId][matchId!];
        sStats.runs += d.runsScored || 0;
        if (d.extraType !== 'wide') sStats.ballsFaced += 1;
        careerTotals[sId].runs += d.runsScored || 0;
      }

      if (bId && careerTotals[bId] && pMatchStats[bId]?.[matchId!]) {
        const bStats = pMatchStats[bId][matchId!];
        bStats.runsConceded += d.totalRunsOnDelivery || 0;
        if (d.extraType !== 'wide' && d.extraType !== 'noball') bStats.ballsBowled += 1;
        if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') {
          bStats.wickets += 1;
          careerTotals[bId].wickets += 1;
        }
        if (d.extraType === 'wide') careerTotals[bId].wides += 1;
        if (d.extraType === 'noball') careerTotals[bId].noBalls += 1;
      }

      if (fId && careerTotals[fId] && pMatchStats[fId]?.[matchId!]) {
        const fStats = pMatchStats[fId][matchId!];
        if (d.dismissalType === 'caught') fStats.catches += 1;
        if (d.dismissalType === 'stumped') fStats.stumpings += 1;
        if (d.dismissalType === 'runout') fStats.runOuts += 1;
      }
    });

    Object.keys(careerTotals).forEach(id => {
      const matchHistory = pMatchStats[id] || {};
      let totalCvp = 0;
      Object.values(matchHistory).forEach(ms => {
        totalCvp += calculatePlayerCVP(ms);
      });
      careerTotals[id].cvp = totalCvp;
    });

    return careerTotals;
  }, [players, allDeliveries]);

  const extrasLeaderboard = useMemo(() => {
    return Object.values(squadStats)
      .map((s: any) => ({
        ...s,
        totalExtras: (s.wides || 0) + (s.noBalls || 0)
      }))
      .filter(s => s.totalExtras > 0)
      .sort((a, b) => b.totalExtras - a.totalExtras)
      .slice(0, 5);
  }, [squadStats]);

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  
  const [newPlayer, setNewPlayer] = useState({ name: '', role: 'Batsman' });
  const [editForm, setEditForm] = useState({ name: '', role: 'Batsman', imageUrl: '' });

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 200;
          const MAX_HEIGHT = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const resized = await resizeImage(file);
      setEditForm(prev => ({ ...prev, imageUrl: resized }));
      toast({ title: "Photo Updated", description: "Click Save to commit changes." });
    }
  };

  const handleAddPlayer = () => {
    if (!user || !newPlayer.name.trim()) return;
    const playerId = doc(collection(db, 'players')).id;
    const playerData = {
      id: playerId, name: newPlayer.name, teamId, ownerId: user.uid,
      role: newPlayer.role, battingStyle: 'Right Handed Bat', isWicketKeeper: false, isRetired: false,
      matchesPlayed: 0, runsScored: 0, wicketsTaken: 0, highestScore: 0,
      bestBowlingFigures: '0/0', careerCVP: 0,
      imageUrl: `https://picsum.photos/seed/${playerId}/200`
    };
    setDocumentNonBlocking(doc(db, 'players', playerId), playerData, { merge: true });
    setIsAddPlayerOpen(false);
    setNewPlayer({ name: '', role: 'Batsman' });
    toast({ title: "Player Added" });
  };

  const openEditDialog = (player: any) => {
    setEditingPlayerId(player.id);
    setEditForm({
      name: player.name,
      role: player.role,
      imageUrl: player.imageUrl || ''
    });
    setIsEditOpen(true);
  };

  const handleUpdatePlayer = () => {
    if (!editingPlayerId) return;
    updateDocumentNonBlocking(doc(db, 'players', editingPlayerId), editForm);
    setIsEditOpen(false);
    toast({ title: "Profile Updated" });
  };

  const handleDeletePlayer = (id: string, name: string) => {
    if (confirm(`Remove ${name}?`)) {
      deleteDocumentNonBlocking(doc(db, 'players', id));
      toast({ title: "Player Released" });
    }
  };

  const isLoading = !isMounted || isTeamLoading || isDeliveriesLoading || isMatchesLoading;

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Team History...</p>
    </div>
  );

  if (!team) return <div className="p-8 text-center font-black uppercase tracking-widest text-slate-400">Franchise Not Found</div>;

  return (
    <div className="space-y-6 pb-24 px-1 md:px-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5"/></Button>
        <Avatar className="w-12 h-12 border-2 border-primary"><AvatarImage src={team.logoUrl}/><AvatarFallback>{team.name[0]}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-black truncate uppercase">{team.name}</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Franchise Squad</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Wins', value: standingsForThisTeam.won, icon: Trophy, color: 'text-secondary' },
          { label: 'Losses', value: standingsForThisTeam.lost, icon: Activity, color: 'text-destructive' },
          { label: 'NRR', value: (standingsForThisTeam.nrr || 0).toFixed(3), icon: HistoryIcon },
          { label: 'Played', value: standingsForThisTeam.played, icon: HistoryIcon },
        ].map((stat, i) => (
          <Card key={i} className="shadow-none border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-1.5 bg-slate-50 rounded"><stat.icon className={cn("w-4 h-4", stat.color)}/></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">{stat.label}</p><p className="text-lg font-black">{stat.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {extrasLeaderboard.length > 0 && (
        <Card className="border-t-4 border-t-amber-500 shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Extras contribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extrasLeaderboard.map((player) => (
              <div key={player.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border">
                <span className="font-black text-xs uppercase truncate max-w-[150px]">{player.name}</span>
                <span className="font-bold text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                  {player.totalExtras} - [{player.wides || 0} WD & {player.noBalls || 0} NB]
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center gap-4">
        <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight">Active Squad</h2>
        <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
          <DialogTrigger asChild><Button className="bg-secondary hover:bg-secondary/90 font-bold h-10"><UserPlus className="mr-2 h-4 w-4"/> Add Player</Button></DialogTrigger>
          <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-primary">
            <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Register Player</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Full Name</Label><Input value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} className="font-bold h-12 shadow-sm" /></div>
              <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Role</Label><Select value={newPlayer.role} onValueChange={(v) => setNewPlayer({...newPlayer, role: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button onClick={handleAddPlayer} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl">Confirm Registration</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players?.map(player => {
          const stats = squadStats[player.id] || { runs: 0, wickets: 0, cvp: 0 };
          return (
            <Card key={player.id} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all group rounded-xl bg-white">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="relative group/photo">
                      <Avatar className="w-14 h-14 rounded-xl shadow-sm border overflow-hidden">
                        <AvatarImage src={player.imageUrl} className="object-cover" />
                        <AvatarFallback className="font-black text-slate-400 bg-slate-50">{player.name[0]}</AvatarFallback>
                      </Avatar>
                      {user && (
                        <button 
                          onClick={() => openEditDialog(player)}
                          className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg border shadow-sm text-primary hover:text-primary/70 transition-colors"
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <Link href={`/players/${player.id}`} className="min-w-0 hover:opacity-80 transition-opacity">
                      <p className="font-black text-sm truncate max-w-[120px] uppercase tracking-tight text-slate-900">{player.name}</p>
                      <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 py-0 h-4 border-slate-200 mt-1 text-slate-500">{player.role}</Badge>
                    </Link>
                  </div>
                  <div className="flex gap-1">
                    {user && (
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(player)} className="h-8 w-8 text-slate-300 hover:text-primary">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {user?.uid === player.ownerId && <Button variant="ghost" size="icon" onClick={() => handleDeletePlayer(player.id, player.name)} className="h-8 w-8 text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4"/></Button>}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center bg-slate-50/50 -mx-4 -mb-4 p-4 rounded-b-xl">
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Runs</p><p className="font-black text-sm text-slate-700">{stats.runs}</p></div>
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Wkts</p><p className="font-black text-sm text-slate-700">{stats.wickets}</p></div>
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">CVP</p><p className="font-black text-sm text-primary">{stats.cvp.toFixed(1)}</p></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-primary">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-primary flex items-center gap-2">Edit Player Profile</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="w-24 h-24 border-4 border-slate-100 shadow-lg rounded-2xl overflow-hidden">
                  <AvatarImage src={editForm.imageUrl} className="object-cover" />
                  <AvatarFallback className="bg-primary text-white text-3xl font-black">{editForm.name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center text-white">
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-[8px] font-black uppercase">Upload</span>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Photo</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Full Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="font-bold h-12" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Role</Label><Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdatePlayer} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl">Update Record</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
