
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collectionGroup, query, where, collection, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Flag, Edit2, ShieldCheck, Star, Info as InfoIcon, Loader2, Trophy, Medal, ArrowLeftRight, Users, Target, Zap, FileText, Calendar } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import Link from 'next/link';

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();

  const [isMounted, setIsMounted] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [comparePlayerId, setComparePlayerId] = useState<string>('');
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    battingStyle: '',
    isWicketKeeper: false
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const playerRef = useMemoFirebase(() => {
    if (!db || !playerId) return null;
    return doc(db, 'players', playerId);
  }, [db, playerId]);
  const { data: player, isLoading: isPlayerLoading } = useDoc(playerRef);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: allMatches } = useCollection(allMatchesQuery);

  // Group Queries with strict playerId guard
  const battingQuery = useMemoFirebase(() => {
    if (!db || !playerId || !isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'), where('strikerPlayerId', '==', playerId));
  }, [db, playerId, isMounted]);
  const { data: battingDeliveries, isLoading: isBattingLoading } = useCollection(battingQuery);

  const bowlingQuery = useMemoFirebase(() => {
    if (!db || !playerId || !isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'), where('bowlerPlayerId', '==', playerId));
  }, [db, playerId, isMounted]);
  const { data: bowlingDeliveries, isLoading: isBowlingLoading } = useCollection(bowlingQuery);

  const fielderQuery = useMemoFirebase(() => {
    if (!db || !playerId || !isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'), where('fielderPlayerId', '==', playerId));
  }, [db, playerId, isMounted]);
  const { data: fieldingActions } = useCollection(fielderQuery);

  useEffect(() => {
    if (player) {
      setEditForm({
        name: player.name || '',
        role: player.role || 'Batsman',
        battingStyle: player.battingStyle || 'Right Handed Bat',
        isWicketKeeper: player.isWicketKeeper || false
      });
    }
  }, [player]);

  const matchWiseLog = useMemo(() => {
    if (!isMounted || !player) return [];
    const logs: Record<string, any> = {};

    const getLog = (mId: string) => {
      if (!logs[mId]) {
        const m = allMatches?.find(match => match.id === mId);
        const playerTeamId = player?.teamId;
        const opponentTeamId = m?.team1Id === playerTeamId ? m?.team2Id : m?.team1Id;
        const opponentTeam = allTeams?.find(t => t.id === opponentTeamId);

        logs[mId] = {
          matchId: mId,
          matchName: opponentTeam ? `vs ${opponentTeam.name}` : 'League Match',
          date: m?.matchDate || '',
          batting: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0 },
          bowling: { wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0 },
          fielding: { catches: 0, stumpings: 0, runOuts: 0 }
        };
      }
      return logs[mId];
    };

    battingDeliveries?.forEach(d => {
      const mId = d.__fullPath?.split('/')[1];
      if (!mId) return;
      const log = getLog(mId);
      log.batting.runs += d.runsScored || 0;
      if (d.extraType !== 'wide') log.batting.ballsFaced += 1;
      log.batting.fours += d.runsScored === 4 ? 1 : 0;
      log.batting.sixes += d.runsScored === 6 ? 1 : 0;
    });

    bowlingDeliveries?.forEach(d => {
      const mId = d.__fullPath?.split('/')[1];
      if (!mId) return;
      const log = getLog(mId);
      log.bowling.runsConceded += d.totalRunsOnDelivery || 0;
      if (d.extraType !== 'wide' && d.extraType !== 'noball') log.bowling.ballsBowled += 1;
      if (d.isWicket && d.dismissalType !== 'runout') log.bowling.wickets += 1;
    });

    fieldingActions?.forEach(d => {
      const mId = d.__fullPath?.split('/')[1];
      if (!mId) return;
      const log = getLog(mId);
      if (d.dismissalType === 'caught') log.fielding.catches += 1;
      if (d.dismissalType === 'stumped') log.fielding.stumpings += 1;
      if (d.dismissalType === 'runout') log.fielding.runOuts += 1;
    });

    return Object.values(logs).map(log => {
      let batPts = log.batting.runs + log.batting.fours + (log.batting.sixes * 2);
      if (log.batting.ballsFaced >= 10) {
        const sr = (log.batting.runs / log.batting.ballsFaced) * 100;
        if (sr > 170) batPts += 6; else if (sr < 50) batPts -= 2;
      }
      let bowlPts = log.bowling.wickets * 15;
      if (log.bowling.wickets >= 4) bowlPts += 10; else if (log.bowling.wickets >= 2) bowlPts += 4;
      if (log.bowling.ballsBowled >= 12) {
        const econ = log.bowling.runsConceded / (log.bowling.ballsBowled / 6);
        if (econ < 5) bowlPts += 6; else if (econ <= 6) bowlPts += 4; else if (econ >= 10 && econ <= 11) bowlPts -= 2; else if (econ > 12) bowlPts -= 4;
      }
      const fieldPts = (log.fielding.catches + log.fielding.stumpings + log.fielding.runOuts) * 4;
      return {
        ...log,
        cvp: { batting: batPts, bowling: bowlPts, fielding: fieldPts, total: batPts + bowlPts + fieldPts + 1 }
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [battingDeliveries, bowlingDeliveries, fieldingActions, allMatches, player, allTeams, isMounted]);

  const historyStats = useMemo(() => {
    const stats = {
      runs: 0, ballsFaced: 0, fours: 0, sixes: 0,
      battingInnings: 0, matchesPlayed: 0,
      fifties: 0, hundreds: 0, wickets: 0, ballsBowled: 0, runsConceded: 0,
      bowlingInnings: 0, maidens: 0, threeWktHauls: 0,
      catches: 0, stumpings: 0, runOuts: 0, careerCVP: 0
    };

    matchWiseLog.forEach(log => {
      stats.matchesPlayed += 1;
      stats.careerCVP += log.cvp.total;
      
      if (log.batting.ballsFaced > 0) {
        stats.battingInnings += 1;
        stats.runs += log.batting.runs;
        stats.ballsFaced += log.batting.ballsFaced;
        stats.fours += log.batting.fours;
        stats.sixes += log.batting.sixes;
        if (log.batting.runs >= 100) stats.hundreds += 1;
        else if (log.batting.runs >= 50) stats.fifties += 1;
      }

      if (log.bowling.ballsBowled > 0) {
        stats.bowlingInnings += 1;
        stats.wickets += log.bowling.wickets;
        stats.ballsBowled += log.bowling.ballsBowled;
        stats.runsConceded += log.bowling.runsConceded;
        if (log.bowling.wickets >= 3) stats.threeWktHauls += 1;
      }

      stats.catches += log.fielding.catches;
      stats.stumpings += log.fielding.stumpings;
      stats.runOuts += log.fielding.runOuts;
    });

    return {
      ...stats,
      strikeRate: stats.ballsFaced > 0 ? ((stats.runs / stats.ballsFaced) * 100).toFixed(2) : '0.00',
      economy: stats.ballsBowled > 0 ? (stats.runsConceded / (stats.ballsBowled / 6)).toFixed(2) : '0.00'
    };
  }, [matchWiseLog]);

  const headToHead = useMemo(() => {
    if (!comparePlayerId || !isMounted) return null;
    const vsStats = { asBatter: { runs: 0, balls: 0, outs: 0 }, asBowler: { runs: 0, balls: 0, wickets: 0 } };
    battingDeliveries?.forEach(d => {
      if (d.bowlerPlayerId === comparePlayerId) {
        vsStats.asBatter.runs += d.runsScored || 0;
        if (d.extraType !== 'wide') vsStats.asBatter.balls += 1;
        if (d.isWicket && (d.batsmanOutPlayerId === playerId || !d.batsmanOutPlayerId)) vsStats.asBatter.outs += 1;
      }
    });
    bowlingDeliveries?.forEach(d => {
      if (d.strikerPlayerId === comparePlayerId) {
        vsStats.asBowler.runs += d.totalRunsOnDelivery || 0;
        if (d.extraType !== 'wide' && d.extraType !== 'noball') vsStats.asBowler.balls += 1;
        if (d.isWicket && d.dismissalType !== 'runout' && (d.batsmanOutPlayerId === comparePlayerId || !d.batsmanOutPlayerId)) vsStats.asBowler.wickets += 1;
      }
    });
    return vsStats;
  }, [comparePlayerId, battingDeliveries, bowlingDeliveries, playerId, isMounted]);

  const handleUpdateProfile = () => {
    if (!editForm.name.trim()) return;
    updateDocumentNonBlocking(doc(db, 'players', playerId), { name: editForm.name, role: editForm.role, battingStyle: editForm.battingStyle, isWicketKeeper: editForm.isWicketKeeper });
    setIsEditOpen(false);
    toast({ title: "Profile Updated" });
  };

  const isLoading = !isMounted || isPlayerLoading || isBattingLoading || isBowlingLoading;

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Syncing Career Statistics...</p>
    </div>
  );

  if (!player) return <div className="p-20 text-center">Player not found.</div>;

  const comparePlayer = allPlayers?.find(p => p.id === comparePlayerId);

  return (
    <div className="max-w-4xl mx-auto pb-24 px-0 bg-white min-h-screen">
      <div className="bg-primary text-white p-4 pt-8 shadow-inner">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 shrink-0"><ArrowLeft className="w-6 h-6"/></Button>
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2">
                <span className="font-black text-2xl tracking-tighter uppercase truncate">{player.name}</span>
                {isUmpire && <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"><Edit2 className="w-4 h-4" /></Button>}
             </div>
            <div className="flex items-center gap-2 mt-0.5 opacity-70"><Flag className="w-3 h-3" /><span className="text-[10px] font-black uppercase tracking-widest">{player.role}</span></div>
          </div>
        </div>
        <div className="flex items-end gap-6 pb-2">
           <Avatar className="w-24 h-24 border-4 border-white/20 rounded-2xl shadow-xl shrink-0 overflow-hidden"><AvatarImage src={player.imageUrl} className="object-cover" /><AvatarFallback className="text-3xl font-black bg-white/10 text-white/50">{player.name[0]}</AvatarFallback></Avatar>
           <div className="flex-1 grid grid-cols-2 gap-2 mb-2">
              <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center"><p className="text-[8px] font-black uppercase text-white/50">Career CVP</p><p className="text-xl font-black">{historyStats.careerCVP.toFixed(1)}</p></div>
              <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center"><p className="text-[8px] font-black uppercase text-white/50">Matches</p><p className="text-xl font-black">{historyStats.matchesPlayed}</p></div>
           </div>
        </div>
      </div>

      <div className="px-4 py-4 flex gap-4 overflow-x-auto scrollbar-hide">
         <div className="flex items-center gap-2 bg-slate-50 border px-3 py-2 rounded-xl shrink-0"><Medal className="w-4 h-4 text-amber-500" /><span className="text-xs font-black uppercase">{historyStats.hundreds} Hundreds</span></div>
         <div className="flex items-center gap-2 bg-slate-50 border px-3 py-2 rounded-xl shrink-0"><Star className="w-4 h-4 text-blue-500" /><span className="text-xs font-black uppercase">{historyStats.fifties} Fifties</span></div>
         <div className="flex items-center gap-2 bg-slate-50 border px-3 py-2 rounded-xl shrink-0"><Trophy className="w-4 h-4 text-secondary" /><span className="text-xs font-black uppercase">{historyStats.threeWktHauls} 3+ Wkts</span></div>
      </div>

      <Tabs defaultValue="batting" className="w-full">
        <div className="bg-primary px-2 border-t border-white/10 sticky top-16 z-40 shadow-md">
          <TabsList className="bg-transparent h-12 flex justify-start gap-2 p-0 w-full overflow-x-auto scrollbar-hide">
            {['Batting', 'Bowling', 'Match Log', 'Comparison', 'Info'].map((tab) => (
              <TabsTrigger key={tab} value={tab.toLowerCase()} className="text-white/60 font-black data-[state=active]:text-white data-[state=active]:bg-transparent border-b-4 border-transparent data-[state=active]:border-white rounded-none px-6 h-full uppercase text-[11px] tracking-widest transition-all whitespace-nowrap">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="batting" className="p-0">
           <Table><TableBody>{[
             { label: 'Innings', value: historyStats.battingInnings },
             { label: 'Runs Scored', value: historyStats.runs },
             { label: 'Balls Faced', value: historyStats.ballsFaced },
             { label: 'Strike Rate', value: historyStats.strikeRate },
             { label: '4s / 6s', value: `${historyStats.fours} / ${historyStats.sixes}` },
             { label: '50s / 100s', value: `${historyStats.fifties} / ${historyStats.hundreds}` },
           ].map((row, idx) => (<TableRow key={row.label} className={cn("hover:bg-slate-50", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}><TableCell className="text-[11px] font-black text-slate-400 py-3.5 pl-4 w-32 uppercase tracking-tighter">{row.label}</TableCell><TableCell className="text-right text-[11px] font-black text-slate-900 pr-4">{row.value}</TableCell></TableRow>))}</TableBody></Table>
        </TabsContent>

        <TabsContent value="bowling" className="p-0">
           <Table><TableBody>{[
             { label: 'Innings', value: historyStats.bowlingInnings },
             { label: 'Wickets', value: historyStats.wickets },
             { label: 'Balls Bowled', value: historyStats.ballsBowled },
             { label: 'Runs Conceded', value: historyStats.runsConceded },
             { label: 'Economy', value: historyStats.economy },
             { label: '3+ Wkt Hauls', value: historyStats.threeWktHauls },
           ].map((row, idx) => (<TableRow key={row.label} className={cn("hover:bg-slate-50", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}><TableCell className="text-[11px] font-black text-slate-400 py-3.5 pl-4 w-32 uppercase tracking-tighter">{row.label}</TableCell><TableCell className="text-right text-[11px] font-black text-slate-900 pr-4">{row.value}</TableCell></TableRow>))}</TableBody></Table>
        </TabsContent>

        <TabsContent value="match log" className="p-0">
           <div className="overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Match/Date</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Bat CVP</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Bowl CVP</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Field CVP</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Total</TableHead></TableRow></TableHeader>
                 <TableBody>
                    {matchWiseLog.length > 0 ? matchWiseLog.map((log) => (
                       <TableRow key={log.matchId} className="hover:bg-slate-50">
                          <TableCell className="py-3"><p className="text-[10px] font-black truncate max-w-[100px]">{log.matchName}</p><div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold uppercase"><Calendar className="w-2.5 h-2.5" />{log.date ? new Date(log.date).toLocaleDateString('en-GB') : '---'}</div></TableCell>
                          <TableCell className="text-right font-bold text-[10px] text-slate-600">{log.cvp.batting.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-bold text-[10px] text-slate-600">{log.cvp.bowling.toFixed(1)}</TableCell>
                          <TableCell className="text-right font-bold text-[10px] text-slate-600">{log.cvp.fielding.toFixed(1)}</TableCell>
                          <TableCell className="text-right"><Badge variant="secondary" className="font-black text-[10px] h-5">{log.cvp.total.toFixed(1)}</Badge></TableCell>
                       </TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="py-12 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">No match history</TableCell></TableRow>}
                 </TableBody>
              </Table>
           </div>
        </TabsContent>

        <TabsContent value="comparison" className="p-4 space-y-6">
           <Card className="border-t-4 border-t-secondary shadow-sm">
              <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-secondary" /> Head-to-Head Engine</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Select Rival Player</Label><Select value={comparePlayerId} onValueChange={setComparePlayerId}><SelectTrigger className="font-bold h-12 shadow-sm"><SelectValue placeholder="Choose a player..." /></SelectTrigger><SelectContent>{allPlayers?.filter(p => p.id !== playerId).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>
                 {headToHead ? (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                       <div className="p-6 bg-slate-50 rounded-2xl border flex flex-col items-center gap-6 shadow-inner">
                          <div className="flex items-center justify-between w-full gap-4">
                             <div className="flex flex-col items-center text-center flex-1"><Avatar className="h-16 w-16 mb-2 border-4 border-primary shadow-lg"><AvatarImage src={player.imageUrl}/></Avatar><p className="text-[10px] font-black uppercase text-slate-900 line-clamp-1">{player.name}</p></div>
                             <div className="flex flex-col items-center"><Zap className="w-8 h-8 text-amber-500 fill-amber-500" /><span className="text-[10px] font-black text-slate-300 uppercase mt-2">VS</span></div>
                             <div className="flex flex-col items-center text-center flex-1"><Avatar className="h-16 w-16 mb-2 border-4 border-secondary shadow-lg"><AvatarImage src={comparePlayer?.imageUrl}/></Avatar><p className="text-[10px] font-black uppercase text-slate-900 line-clamp-1">{comparePlayer?.name || 'Rival'}</p></div>
                          </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card className="bg-primary/5 border-primary/20"><CardHeader className="p-4 pb-0"><CardTitle className="text-[10px] font-black uppercase text-primary tracking-widest">Batting vs {comparePlayer?.name?.split(' ')[0]}</CardTitle></CardHeader><CardContent className="p-4 pt-4"><div className="grid grid-cols-3 gap-2 text-center"><div><p className="text-[8px] font-black text-slate-400 uppercase">Runs</p><p className="text-xl font-black text-primary">{headToHead.asBatter.runs}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase">Balls</p><p className="text-xl font-black text-primary">{headToHead.asBatter.balls}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase">Outs</p><p className="text-xl font-black text-destructive">{headToHead.asBatter.outs}</p></div></div></CardContent></Card>
                          <Card className="bg-secondary/5 border-secondary/20"><CardHeader className="p-4 pb-0"><CardTitle className="text-[10px] font-black uppercase text-secondary tracking-widest">Bowling to {comparePlayer?.name?.split(' ')[0]}</CardTitle></CardHeader><CardContent className="p-4 pt-4"><div className="grid grid-cols-3 gap-2 text-center"><div><p className="text-[8px] font-black text-slate-400 uppercase">Runs</p><p className="text-xl font-black text-secondary">{headToHead.asBowler.runs}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase">Balls</p><p className="text-xl font-black text-secondary">{headToHead.asBowler.balls}</p></div><div><p className="text-[8px] font-black text-secondary uppercase">Wkts</p><p className="text-xl font-black text-secondary">{headToHead.asBowler.wickets}</p></div></div></CardContent></Card>
                       </div>
                    </div>
                 ) : <div className="py-12 text-center text-slate-400 text-[10px] font-bold uppercase border-2 border-dashed rounded-xl bg-slate-50/50"><Users className="w-10 h-10 mx-auto mb-3 opacity-20" />Select a player for Head-to-Head analytics</div>}
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="info" className="p-4 space-y-6">
           <Card className="rounded-2xl bg-slate-50 border-none shadow-sm"><CardContent className="p-6"><div className="grid grid-cols-2 gap-6"><div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Batting Style</p><p className="text-sm font-bold">{player.battingStyle}</p></div><div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Wicket Keeper</p><p className="text-sm font-bold">{player.isWicketKeeper ? 'Yes' : 'No'}</p></div><div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fielding: Catches</p><p className="text-sm font-bold">{historyStats.catches}</p></div><div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Stumpings/RO</p><p className="text-sm font-bold">{historyStats.stumpings} / {historyStats.runOuts}</p></div></div></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-primary"><DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-primary">Edit Player Profile</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Full Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="font-bold h-12" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Role</Label><Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem><SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Batting Style</Label><Select value={editForm.battingStyle} onValueChange={(v) => setEditForm({...editForm, battingStyle: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Right Handed Bat">Right Handed Bat</SelectItem><SelectItem value="Left Handed Bat">Left Handed Bat</SelectItem></SelectContent></Select></div><div className="flex items-center gap-2 pt-2"><Label className="text-[10px] font-black uppercase text-slate-400">Wicket Keeper?</Label><input type="checkbox" checked={editForm.isWicketKeeper} onChange={(e) => setEditForm({...editForm, isWicketKeeper: e.target.checked})} className="h-4 w-4" /></div></div><DialogFooter><Button onClick={handleUpdateProfile} className="w-full h-12 font-black uppercase tracking-widest">Save Changes</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
