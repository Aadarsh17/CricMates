
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useDoc, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, ArrowLeft, Trophy, Activity, History as HistoryIcon, ArrowLeftRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { calculatePlayerCVP } from '@/lib/cvp-utils';

export default function TeamDetailsPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const teamRef = useMemoFirebase(() => doc(db, 'teams', teamId), [db, teamId]);
  const { data: team, isLoading: isTeamLoading } = useDoc(teamRef);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), where('teamId', '==', teamId)), [db, teamId]);
  const { data: players, isLoading: isPlayersLoading } = useCollection(playersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: allMatches = [] } = useCollection(matchesQuery);

  // Dynamic history stats for all players in this squad
  const squadDeliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: allDeliveries, isLoading: isDeliveriesLoading } = useCollection(squadDeliveriesQuery);

  const squadStats = useMemo(() => {
    if (!players || !allDeliveries) return {};
    const stats: Record<string, any> = {};
    players.forEach(p => {
      stats[p.id] = { runs: 0, wickets: 0, cvp: 0, ballsFaced: 0, fours: 0, sixes: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0, maidens: 0 };
    });

    allDeliveries.forEach(d => {
      if (stats[d.strikerPlayerId]) {
        stats[d.strikerPlayerId].runs += d.runsScored || 0;
        if (d.extraType !== 'wide') stats[d.strikerPlayerId].ballsFaced += 1;
      }
      if (stats[d.bowlerPlayerId]) {
        stats[d.bowlerPlayerId].runsConceded += d.totalRunsOnDelivery || 0;
        if (d.extraType !== 'wide' && d.extraType !== 'noball') stats[d.bowlerPlayerId].ballsBowled += 1;
        if (d.isWicket && d.dismissalType !== 'runout') stats[d.bowlerPlayerId].wickets += 1;
      }
      if (d.fielderPlayerId && stats[d.fielderPlayerId]) {
        if (d.dismissalType === 'caught') stats[d.fielderPlayerId].catches += 1;
        if (d.dismissalType === 'stumped') stats[d.fielderPlayerId].stumpings += 1;
        if (d.dismissalType === 'runout') stats[d.fielderPlayerId].runOuts += 1;
      }
    });

    Object.keys(stats).forEach(id => {
      stats[id].cvp = calculatePlayerCVP({ ...stats[id], id, name: '' });
    });
    return stats;
  }, [players, allDeliveries]);

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', role: 'Batsman' });
  const [h2hTeamId, setH2hTeamId] = useState<string>('');

  const h2hStats = useMemo(() => {
    if (!h2hTeamId || !allMatches.length) return null;
    let played = 0, won = 0, lost = 0, drawn = 0;
    const filtered = allMatches.filter(m => (m.team1Id === teamId && m.team2Id === h2hTeamId) || (m.team1Id === h2hTeamId && m.team2Id === teamId));
    filtered.forEach(m => {
        played++;
        const result = m.resultDescription?.toLowerCase() || '';
        const teamName = team?.name.toLowerCase() || '';
        if (result.includes(teamName) && result.includes('won')) won++;
        else if (result.includes('drawn') || result.includes('tied')) drawn++;
        else lost++;
    });
    return { played, won, lost, drawn };
  }, [h2hTeamId, allMatches, teamId, team?.name]);

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

  const handleDeletePlayer = (id: string, name: string) => {
    if (confirm(`Remove ${name}?`)) {
      deleteDocumentNonBlocking(doc(db, 'players', id));
      toast({ title: "Player Released" });
    }
  };

  if (!isMounted || isTeamLoading || isDeliveriesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Team History...</p>
    </div>
  );

  if (!team) return <div className="p-8 text-center">Not found.</div>;

  return (
    <div className="space-y-6 pb-24 px-1 md:px-4 max-w-5xl mx-auto animate-in fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0"><ArrowLeft className="w-5 h-5"/></Button>
        <Avatar className="w-12 h-12 border-2 border-primary"><AvatarImage src={team.logoUrl}/><AvatarFallback>{team.name[0]}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <h1 className="text-xl md:text-3xl font-black font-headline truncate">{team.name}</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Squad Management</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Won', value: team.matchesWon, icon: Trophy, color: 'text-secondary' },
          { label: 'Lost', value: team.matchesLost, icon: Activity, color: 'text-destructive' },
          { label: 'NRR', value: (team.netRunRate || 0).toFixed(3), icon: HistoryIcon },
          { label: 'Played', value: (team.matchesWon||0)+(team.matchesLost||0)+(team.matchesDrawn||0), icon: HistoryIcon },
        ].map((stat, i) => (
          <Card key={i} className="shadow-none border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-1.5 bg-slate-50 rounded"><stat.icon className={cn("w-4 h-4", stat.color)}/></div>
              <div><p className="text-[9px] font-black text-slate-400 uppercase">{stat.label}</p><p className="text-lg font-black">{stat.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-t-4 border-t-secondary">
        <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> Head-to-Head Comparison</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-black uppercase">Opponent Team</Label>
                    <Select value={h2hTeamId} onValueChange={setH2hTeamId}>
                        <SelectTrigger><SelectValue placeholder="Choose opponent" /></SelectTrigger>
                        <SelectContent>{allTeams?.filter(t => t.id !== teamId).map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
            </div>
            {h2hStats ? (
                <div className="p-6 bg-slate-50 rounded-2xl border flex flex-col items-center gap-6">
                    <div className="flex items-center gap-12 w-full justify-center">
                        <div className="text-center">
                            <Avatar className="h-16 w-16 mb-2 border-2 border-primary"><AvatarImage src={team.logoUrl}/></Avatar>
                            <p className="text-sm font-black">{team.name}</p>
                            <p className="text-3xl font-black text-primary mt-2">{h2hStats.won}</p>
                            <p className="text-[10px] font-black uppercase text-slate-400">Wins</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-black text-slate-300 uppercase">Played</p>
                            <p className="text-xl font-black text-slate-400">{h2hStats.played}</p>
                        </div>
                        <div className="text-center">
                            <Avatar className="h-16 w-16 mb-2 border-2 border-secondary"><AvatarImage src={allTeams?.find(t => t.id === h2hTeamId)?.logoUrl}/></Avatar>
                            <p className="text-sm font-black">{allTeams?.find(t => t.id === h2hTeamId)?.name}</p>
                            <p className="text-3xl font-black text-secondary mt-2">{h2hStats.lost}</p>
                            <p className="text-[10px] font-black uppercase text-slate-400">Wins</p>
                        </div>
                    </div>
                </div>
            ) : h2hTeamId && <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase border-2 border-dashed rounded-xl">No history found</div>}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center gap-4">
        <h2 className="text-lg md:text-2xl font-black">Active Squad</h2>
        <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
          <DialogTrigger asChild><Button className="bg-secondary hover:bg-secondary/90 font-bold"><UserPlus className="mr-2 h-4 w-4"/> Add Player</Button></DialogTrigger>
          <DialogContent className="max-w-[90vw] sm:max-w-md">
            <DialogHeader><DialogTitle>Register Player</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1"><Label>Full Name</Label><Input value={newPlayer.name} onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})} placeholder="e.g. Jasprit Bumrah" /></div>
              <div className="space-y-1"><Label>Role</Label><Select value={newPlayer.role} onValueChange={(v) => setNewPlayer({...newPlayer, role: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem><SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button onClick={handleAddPlayer} className="w-full h-12 font-black uppercase">Confirm Registration</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players?.map(player => {
          const stats = squadStats[player.id] || { runs: 0, wickets: 0, cvp: 0 };
          return (
            <Card key={player.id} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all group">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <Link href={`/players/${player.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <Avatar className="w-10 h-10"><AvatarImage src={player.imageUrl} /><AvatarFallback>{player.name[0]}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate max-w-[120px] group-hover:text-primary transition-colors">{player.name}</p>
                      <Badge variant="outline" className="text-[8px] font-black uppercase">{player.role}</Badge>
                    </div>
                  </Link>
                  {user?.uid === player.ownerId && <Button variant="ghost" size="icon" onClick={() => handleDeletePlayer(player.id, player.name)} className="h-8 w-8 text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4"/></Button>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Runs</p><p className="font-black text-xs">{stats.runs}</p></div>
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Wkts</p><p className="font-black text-xs">{stats.wickets}</p></div>
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">CVP</p><p className="font-black text-xs text-primary">{stats.cvp.toFixed(1)}</p></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
