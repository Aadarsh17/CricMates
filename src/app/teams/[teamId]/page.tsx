
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, doc, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, ArrowLeft, Trophy, Activity, History as HistoryIcon, Loader2, Edit2, Camera, Users, Scale, Crown, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { cn, formatTeamName } from '@/lib/utils';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';

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

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers, isLoading: isAllPlayersLoading } = useCollection(allPlayersQuery);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: allMatches, isLoading: isMatchesLoading } = useCollection(allMatchesQuery);

  const squadDeliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(squadDeliveriesQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const activeMatchIds = useMemo(() => new Set(allMatches?.map(m => m.id) || []), [allMatches]);

  const activeSquad = useMemo(() => allPlayers?.filter(p => p.teamId === teamId) || [], [allPlayers, teamId]);

  const allDeliveries = useMemo(() => {
    if (!rawDeliveries || !allMatches || allMatches.length === 0) return [];
    return rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && activeMatchIds.has(matchId);
    });
  }, [rawDeliveries, allMatches, activeMatchIds]);

  const standingsForThisTeam = useMemo(() => {
    if (!teamId || !allMatches || !allMatches.length) return { played: 0, won: 0, lost: 0, drawn: 0, nrr: 0 };
    
    let forR = 0, forB = 0, agR = 0, agB = 0;
    let played = 0, won = 0, lost = 0, drawn = 0;

    allMatches.forEach(m => {
      if (m.status !== 'completed' || (m.team1Id !== teamId && m.team2Id !== teamId)) return;
      played++;
      
      const winnerId = m.winnerTeamId;
      if (winnerId) {
        if (winnerId === teamId) won++;
        else if (m.isTie) drawn++;
        else if (winnerId !== 'none') lost++;
        else drawn++;
      } else {
        const res = m.resultDescription?.toLowerCase() || '';
        const t1 = allTeams?.find(t => t.id === m.team1Id);
        const t2 = allTeams?.find(t => t.id === m.team2Id);
        
        if (m.isTie || res.includes('tied') || res.includes('drawn')) drawn++;
        else if (t1 && res.includes(t1.name.toLowerCase())) {
          if (m.team1Id === teamId) won++; else lost++;
        } else if (t2 && res.includes(t2.name.toLowerCase())) {
          if (m.team2Id === teamId) won++; else lost++;
        } else drawn++;
      }
    });

    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const match = allMatches.find(m => m.id === matchId);
      if (!match) return;
      const innNum = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
      const inn1BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id) : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
      const battingTeamId = innNum === 1 ? inn1BatId : (inn1BatId === match.team1Id ? match.team2Id : match.team1Id);
      const bowlingTeamId = battingTeamId === teamId ? match.team2Id : match.team1Id;

      if (battingTeamId === teamId) {
        forR += (d.totalRunsOnDelivery || 0);
        if (d.extraType === 'none') forB += 1;
      } else if (bowlingTeamId === teamId) {
        agR += (d.totalRunsOnDelivery || 0);
        if (d.extraType === 'none') agB += 1;
      }
    });

    const forRR = forB > 0 ? (forR / (forB / 6)) : 0;
    const agRR = agB > 0 ? (agR / (agB / 6)) : 0;

    return { played, won, lost, drawn, nrr: forRR - agRR };
  }, [allMatches, teamId, allDeliveries, allTeams]);

  const squadStats = useMemo(() => {
    if (!allPlayers || allPlayers.length === 0) return {};
    const careerTotals: Record<string, any> = {};
    const pMatchStats: Record<string, Record<string, any>> = {};
    
    allPlayers.forEach(p => { 
      careerTotals[p.id] = { id: p.id, name: p.name, runs: 0, wickets: 0, cvp: 0 }; 
    });

    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const sId = d.strikerPlayerId; 
      const bId = d.bowlerId || d.bowlerPlayerId; 
      const fId = d.fielderPlayerId;
      
      const involvedIds = [sId, bId, fId].filter(id => id && id !== 'none' && careerTotals[id]);
      involvedIds.forEach(pid => {
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId!]) { 
          pMatchStats[pid][matchId!] = { id: pid, name: '', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 }; 
        }
      });

      if (careerTotals[sId] && pMatchStats[sId]?.[matchId!]) {
        const sStats = pMatchStats[sId][matchId!]; 
        sStats.runs += d.runsScored || 0;
        careerTotals[sId].runs += d.runsScored || 0;
      }
      if (bId && careerTotals[bId] && pMatchStats[bId]?.[matchId!]) {
        const bStats = pMatchStats[bId][matchId!]; 
        bStats.runsConceded += d.totalRunsOnDelivery || 0;
        if (d.extraType === 'none') bStats.ballsBowled += 1;
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) { 
          bStats.wickets += 1; careerTotals[bId].wickets += 1; 
        }
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
      Object.values(matchHistory).forEach(ms => { totalCvp += calculatePlayerCVP(ms as any); });
      careerTotals[id].cvp = totalCvp;
    });
    return careerTotals;
  }, [allPlayers, allDeliveries]);

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [newPlayer, setNewPlayer] = useState({ name: '', role: 'Batsman' });
  const [teamNameForm, setTeamNameForm] = useState('');
  const [captainIdForm, setCaptainIdForm] = useState('');
  const [vcIdForm, setVcIdForm] = useState('');
  const [wkIdForm, setWkIdForm] = useState('');
  
  const [editForm, setEditForm] = useState({ 
    name: '', 
    role: 'Batsman', 
    imageUrl: '', 
    battingStyle: 'Right Handed Bat',
    isWicketKeeper: false
  });

  const defaultAvatar = PlaceHolderImages.find(img => img.id === 'player-avatar')?.imageUrl || '';

  useEffect(() => {
    if (team) {
      setTeamNameForm(team.name);
      setCaptainIdForm(team.captainId || '');
      setVcIdForm(team.viceCaptainId || '');
      setWkIdForm(team.wicketKeeperId || '');
    }
  }, [team]);

  const handleUpdateTeam = () => {
    if (!teamId || !teamNameForm.trim()) return;
    updateDocumentNonBlocking(doc(db, 'teams', teamId), { 
      name: teamNameForm,
      captainId: captainIdForm === 'none' ? '' : captainIdForm,
      viceCaptainId: vcIdForm === 'none' ? '' : vcIdForm,
      wicketKeeperId: wkIdForm === 'none' ? '' : wkIdForm
    });
    setIsEditTeamOpen(false);
    toast({ title: "Franchise Updated" });
  };

  const handleAddPlayer = () => {
    if (!user || !newPlayer.name.trim()) return;
    const playerId = doc(collection(db, 'players')).id;
    const playerData = { 
      id: playerId, 
      name: newPlayer.name, 
      teamId, 
      ownerId: user.uid, 
      role: newPlayer.role, 
      battingStyle: 'Right Handed Bat', 
      isWicketKeeper: false, 
      isRetired: false, 
      matchesPlayed: 0, 
      runsScored: 0, 
      wicketsTaken: 0, 
      highestScore: 0, 
      bestBowlingFigures: '0/0', 
      careerCVP: 0, 
      imageUrl: defaultAvatar 
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
      imageUrl: player.imageUrl || '',
      battingStyle: player.battingStyle || 'Right Handed Bat',
      isWicketKeeper: !!player.isWicketKeeper
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
    if (confirm(`Release ${name} from squad?`)) { 
      deleteDocumentNonBlocking(doc(db, 'players', id)); 
      toast({ title: "Player Released" }); 
    } 
  };

  if (!isMounted || isTeamLoading || isDeliveriesLoading || isMatchesLoading || isAllPlayersLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Team Center...</p>
    </div>
  );

  if (!team) return <div className="p-8 text-center font-black uppercase tracking-widest text-slate-400">Franchise Not Found</div>;

  return (
    <div className="space-y-10 pb-32 px-1 md:px-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-5 h-5"/></Button>
        <Avatar className="w-16 h-16 border-4 border-primary rounded-2xl shadow-lg"><AvatarImage src={team.logoUrl} className="object-cover" /><AvatarFallback className="bg-primary text-white font-black text-2xl">{team.name[0]}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-4xl font-black truncate uppercase tracking-tighter">{formatTeamName(team.name)}</h1>
            {user && <Button variant="ghost" size="icon" onClick={() => setIsEditTeamOpen(true)} className="h-8 w-8 text-slate-300 hover:text-primary"><Edit2 className="w-4 h-4" /></Button>}
          </div>
          <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Franchise Dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Wins', value: standingsForThisTeam.won, icon: Trophy, color: 'text-secondary' },
          { label: 'Losses', value: standingsForThisTeam.lost, icon: Activity, color: 'text-destructive' },
          { label: 'NR/Ties', value: standingsForThisTeam.drawn, icon: Scale, color: 'text-amber-500' },
          { label: 'NRR', value: (standingsForThisTeam.nrr || 0).toFixed(3), icon: HistoryIcon, color: 'text-primary' },
          { label: 'Played', value: standingsForThisTeam.played, icon: Users, color: 'text-slate-600' },
        ].map((stat, i) => (
          <Card key={i} className="shadow-xl border-none overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-slate-50 rounded-xl"><stat.icon className={cn("w-5 h-5", stat.color)}/></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p><p className="text-xl font-black">{stat.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center gap-4 px-2">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-primary" /> Active Squad</h2>
          {user && (
            <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 font-black uppercase text-[10px] h-10 px-6"><UserPlus className="mr-2 h-4 w-4"/> Register Player</Button></DialogTrigger>
              <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl">
                <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl">Official Registration</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Full Name</Label><Input value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} className="font-bold h-12 shadow-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Primary Role</Label><Select value={newPlayer.role} onValueChange={(v) => setNewPlayer({...newPlayer, role: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Batsman" className="font-bold uppercase text-xs">Batsman</SelectItem><SelectItem value="Bowler" className="font-bold uppercase text-xs">Bowler</SelectItem><SelectItem value="All-rounder" className="font-bold uppercase text-xs">All-rounder</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button onClick={handleAddPlayer} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl bg-primary">Commit Registration</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {activeSquad.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSquad.map(player => {
              const stats = squadStats[player.id] || { runs: 0, wickets: 0, cvp: 0 };
              const isCaptain = player.id === team.captainId;
              const isVC = player.id === team.viceCaptainId;
              const isWK = player.id === team.wicketKeeperId;
              
              return (
                <Card key={player.id} className={cn("border-l-8 shadow-lg hover:translate-y-[-2px] transition-all group rounded-2xl bg-white overflow-hidden", isCaptain ? "border-l-amber-500" : isVC ? "border-l-slate-600" : "border-l-primary")}>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Avatar className="w-16 h-16 rounded-2xl shadow-md border-2 border-white overflow-hidden ring-4 ring-slate-50"><AvatarImage src={player.imageUrl} className="object-cover" /><AvatarFallback className="font-black text-slate-400 bg-slate-50">{player.name[0]}</AvatarFallback></Avatar>
                          {user && <button onClick={() => openEditDialog(player)} className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-lg border shadow-sm text-primary hover:scale-110 transition-transform z-10"><Edit2 className="w-3 h-3" /></button>}
                        </div>
                        <Link href={`/players/${player.id}`} className="min-w-0">
                          <p className="font-black text-sm truncate max-w-[140px] uppercase tracking-tight text-slate-900 group-hover:text-primary transition-colors">{player.name} {isCaptain && '(C)'} {isVC && '(VC)'}</p>
                          <div className="flex gap-1 items-center mt-1">
                            <Badge variant="secondary" className="text-[8px] font-black uppercase px-2 h-5 bg-primary/10 text-primary border-none">{player.role}</Badge>
                            {isWK && <Badge className="bg-secondary text-white text-[7px] font-black h-5 px-1.5">WK</Badge>}
                          </div>
                        </Link>
                      </div>
                      {user && <Button variant="ghost" size="icon" onClick={() => handleDeletePlayer(player.id, player.name)} className="h-8 w-8 text-slate-200 hover:text-destructive"><Trash2 className="w-4 h-4"/></Button>}
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2 border-t pt-4 text-center bg-slate-50/50 -mx-5 -mb-5 p-5">
                      <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Runs</p><p className="font-black text-sm text-slate-900">{stats.runs}</p></div>
                      <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Wkts</p><p className="font-black text-sm text-slate-900">{stats.wickets}</p></div>
                      <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">CVP</p><p className="font-black text-sm text-primary">{stats.cvp.toFixed(1)}</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-slate-50/50 mx-2 flex flex-col items-center">
            <Users className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No active players registered in squad</p>
            {user && <Button variant="outline" onClick={() => setIsAddPlayerOpen(true)} className="mt-4 font-black uppercase text-[9px] border-primary/30 text-primary">Register First Player</Button>}
          </div>
        )}
      </div>

      <Dialog open={isEditTeamOpen} onOpenChange={setIsEditTeamOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Franchise Details</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Franchise Name</Label><Input value={teamNameForm} onChange={(e) => setTeamNameForm(e.target.value)} className="font-bold h-12" /></div>
            <div className="space-y-4 pt-2 border-t">
              <p className="text-[10px] font-black uppercase text-slate-500">Leadership</p>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Official Captain</Label>
                <Select value={captainIdForm || 'none'} onValueChange={setCaptainIdForm}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Assign Leader" /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-[250px]">
                    <SelectItem value="none" className="font-bold uppercase text-xs">No Captain</SelectItem>
                    {activeSquad.map(p => <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Vice-Captain</Label>
                <Select value={vcIdForm || 'none'} onValueChange={setVcIdForm}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Assign VC" /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-[250px]">
                    <SelectItem value="none" className="font-bold uppercase text-xs">No Vice-Captain</SelectItem>
                    {activeSquad.map(p => <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Wicket-Keeper</Label>
                <Select value={wkIdForm || 'none'} onValueChange={setWkIdForm}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Assign WK" /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-[250px]">
                    <SelectItem value="none" className="font-bold uppercase text-xs">No Wicket-Keeper</SelectItem>
                    {activeSquad.map(p => <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateTeam} className="w-full h-14 font-black uppercase tracking-widest shadow-xl bg-primary">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Player Profile</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="w-28 h-28 border-4 border-white shadow-xl rounded-3xl overflow-hidden ring-4 ring-slate-100">
                <AvatarImage src={editForm.imageUrl || defaultAvatar} className="object-cover" />
                <AvatarFallback className="bg-primary text-white text-4xl font-black">{editForm.name?.[0] || '?'}</AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Official Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="font-bold h-12 shadow-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase">Role</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}>
                    <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase">Batting Style</Label>
                  <Select value={editForm.battingStyle} onValueChange={(v) => setEditForm({...editForm, battingStyle: v})}>
                    <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Right Handed Bat">RHB</SelectItem><SelectItem value="Left Handed Bat">LHB</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-xl border">
                <Checkbox id="wk-edit" checked={editForm.isWicketKeeper} onCheckedChange={(c) => setEditForm({...editForm, isWicketKeeper: !!c})} />
                <Label htmlFor="wk-edit" className="text-xs font-black uppercase">Wicket Keeper</Label>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdatePlayer} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl bg-primary">Commit Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
