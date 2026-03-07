
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, History, Loader2, Zap, PlayCircle, ArrowLeftRight, ShieldCheck, RefreshCw, Swords, Target, Activity, LogOut, ChevronRight, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();
  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  
  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', fielderId: 'none' });
  const [assignmentForm, setAssignmentForm] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });

  useEffect(() => { setIsMounted(true); }, []);

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);
  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_1'), [db, matchId]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_2'), [db, matchId]);
  const { data: inn2 } = useDoc(inn2Ref);

  const inn1DeliveriesQuery = useMemoFirebase(() => query(collection(db, 'matches', matchId, 'innings', 'inning_1', 'deliveryRecords'), orderBy('timestamp', 'asc')), [db, matchId]);
  const { data: inn1Deliveries } = useCollection(inn1DeliveriesQuery);
  const inn2DeliveriesQuery = useMemoFirebase(() => query(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'), orderBy('timestamp', 'asc')), [db, matchId]);
  const { data: inn2Deliveries } = useCollection(inn2DeliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);
  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || []), [inn1Deliveries]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || []), [inn2Deliveries]);

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const currentStats = match?.currentInningNumber === 1 ? stats1 : stats2;
  const currentDeliveries = match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;

  const getPlayerName = (pid: string) => allPlayers?.find(p => p.id === pid)?.name || '---';
  const getTeamName = (tid: string) => allTeams?.find(t => t.id === tid)?.name || '---';

  const formatOverNotation = (totalLegalBalls: number) => {
    if (totalLegalBalls === 0) return "0.0";
    const overs = Math.floor((totalLegalBalls - 1) / 6);
    const balls = ((totalLegalBalls - 1) % 6) + 1;
    return `${overs}.${balls}`;
  };

  const recalculateInningState = async (inningId: string) => {
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveries = snap.docs.map(d => d.data());
    let score = 0, wkts = 0, legal = 0;
    deliveries.forEach(d => { 
      score += d.totalRunsOnDelivery; 
      if (d.isWicket && d.dismissalType !== 'retired') wkts++; 
      if (d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye') legal++; 
    });
    const updates: any = { 
      score, 
      wickets: wkts, 
      oversCompleted: Math.floor(legal / 6), 
      ballsInCurrentOver: legal % 6,
      isDeclaredFinished: legal >= (match?.totalOvers || 0) * 6
    };
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates);
  };

  const handleRecordBall = async (runs: number, extra: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) {
      if (!activeInningData?.currentBowlerPlayerId) setIsPlayerAssignmentOpen(true);
      return;
    }
    const currentInningId = `inning_${match.currentInningNumber}`;
    const isLegal = extra === 'none' || extra === 'bye' || extra === 'legbye';
    const totalLegal = (currentDeliveries?.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length || 0) + (isLegal ? 1 : 0);
    
    if (totalLegal > match.totalOvers * 6) { 
      toast({ title: "Over Limit Reached", description: "Innings must be declared finished." }); 
      return; 
    }

    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = { 
      id: deliveryId, 
      overNumber: Math.floor((totalLegal - 1) / 6), 
      ballNumberInOver: ((totalLegal - 1) % 6) + 1, 
      strikerPlayerId: activeInningData.strikerPlayerId, 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', 
      bowlerId: activeInningData.currentBowlerPlayerId, 
      runsScored: extra === 'none' ? runs : 0, 
      extraRuns: extra !== 'none' ? runs + 1 : 0, 
      extraType: extra, 
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0), 
      isWicket: false, 
      timestamp: Date.now() 
    };
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData, { merge: true });

    let nextS = activeInningData.strikerPlayerId, nextNS = activeInningData.nonStrikerPlayerId;
    if (runs % 2 !== 0) [nextS, nextNS] = [nextNS, nextS];
    if (totalLegal % 6 === 0 && isLegal) [nextS, nextNS] = [nextNS, nextS];

    const updates: any = { 
      score: activeInningData.score + dData.totalRunsOnDelivery, 
      oversCompleted: Math.floor(totalLegal / 6), 
      ballsInCurrentOver: totalLegal % 6, 
      strikerPlayerId: nextS, 
      nonStrikerPlayerId: nextNS 
    };
    if (totalLegal % 6 === 0 && isLegal) updates.currentBowlerPlayerId = '';
    if (totalLegal >= match.totalOvers * 6) updates.isDeclaredFinished = true;
    
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
  };

  const handleEndInnings = () => {
    if (!match) return;
    if (match.currentInningNumber === 1) {
      updateDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: 2 });
      const battingTeamId = match.team1Id === inn1?.battingTeamId ? match.team2Id : match.team1Id;
      const inning2Data = {
        id: 'inning_2',
        inningNumber: 2,
        battingTeamId,
        bowlingTeamId: inn1?.battingTeamId,
        score: 0,
        wickets: 0,
        oversCompleted: 0,
        ballsInCurrentOver: 0,
        isDeclaredFinished: false,
        strikerPlayerId: '',
        nonStrikerPlayerId: '',
        currentBowlerPlayerId: ''
      };
      setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), inning2Data, { merge: true });
      setIsPlayerAssignmentOpen(true);
    } else {
      const result = inn2!.score > inn1!.score ? `${getTeamName(inn2!.battingTeamId)} won` : (inn2!.score === inn1!.score ? "Match Tied" : `${getTeamName(inn1!.battingTeamId)} won`);
      updateDocumentNonBlocking(doc(db, 'matches', matchId), { status: 'completed', resultDescription: result });
      router.push('/matches');
    }
  };

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 px-1 relative">
      {/* Sticky Broadcast Strip */}
      <div className="fixed top-16 left-0 right-0 z-[90] bg-slate-950 text-white shadow-2xl px-6 py-4 border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-black uppercase text-[10px] text-slate-400">{getTeamName(match?.team1Id).substring(0,8)}</span>
              <span className={cn("font-black text-xl", match?.currentInningNumber === 1 ? "text-primary" : "text-slate-500")}>{inn1?.score || 0}/{inn1?.wickets || 0}</span>
              <Badge variant="outline" className="text-[8px] font-black border-white/10 h-4 text-slate-400">
                ({formatOverNotation((inn1?.oversCompleted || 0) * 6 + (inn1?.ballsInCurrentOver || 0))})
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black uppercase text-[10px] text-slate-400">{getTeamName(match?.team2Id).substring(0,8)}</span>
              <span className={cn("font-black text-xl", match?.currentInningNumber === 2 ? "text-secondary" : "text-slate-500")}>{inn2?.score || 0}/{inn2?.wickets || 0}</span>
              <Badge variant="outline" className="text-[8px] font-black border-white/10 h-4 text-slate-400">
                ({formatOverNotation((inn2?.oversCompleted || 0) * 6 + (inn2?.ballsInCurrentOver || 0))})
              </Badge>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <Badge variant="destructive" className="animate-pulse text-[8px] h-4 font-black uppercase">Live Broadcast</Badge>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">
              {match?.currentInningNumber === 1 ? "1st Innings" : "Chasing Target"}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-28 space-y-6">
        {isUmpire && !activeInningData?.isDeclaredFinished ? (
          <Card className="bg-slate-900 border-none rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3, 4, 6].map(r => (
                  <Button key={r} disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl transition-all active:scale-95", r >= 4 ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 text-white hover:bg-white/10")}>{r || '•'}</Button>
                ))}
                <Button onClick={() => { updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { strikerPlayerId: activeInningData?.nonStrikerPlayerId, nonStrikerPlayerId: activeInningData?.strikerPlayerId }); toast({ title: "Strike Swapped" }); }} className="bg-secondary text-white h-14 font-black rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-secondary/20"><ArrowLeftRight className="w-5 h-5"/><span className="text-[8px] uppercase mt-1">Swap</span></Button>
                <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-14 border-red-500/30 bg-red-500/5 text-red-500 font-black rounded-2xl uppercase text-[10px] hover:bg-red-500 hover:text-white transition-all">Wicket</Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px] tracking-widest">Wide</Button>
                <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px] tracking-widest">No Ball</Button>
                <Button variant="outline" onClick={() => { 
                  const currentInningId = `inning_${match?.currentInningNumber}`;
                  getDocs(query(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1))).then(s => { 
                    if(!s.empty) { 
                      deleteDocumentNonBlocking(s.docs[0].ref); 
                      recalculateInningState(currentInningId); 
                      toast({ title: "Action Undone" });
                    } 
                  }); 
                }} className="h-12 border-white/10 text-slate-400 uppercase font-black text-[9px] tracking-widest">Undo</Button>
              </div>
            </CardContent>
          </Card>
        ) : isUmpire && (
          <Button onClick={handleEndInnings} className="w-full h-20 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xl uppercase rounded-3xl shadow-2xl">
            {match?.currentInningNumber === 1 ? "End 1st Innings" : "Finish Match"}
          </Button>
        )}

        <div className="grid grid-cols-1 gap-4">
          <Card className="border-2 border-primary bg-primary/5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-5"><Target className="w-12 h-12" /></div>
            <CardContent className="p-4 flex justify-between items-center relative z-10">
              <div className="min-w-0"><p className="text-[9px] font-black uppercase text-primary tracking-widest mb-1 flex items-center gap-1.5"><Activity className="w-3 h-3"/> Active Striker</p><p className="font-black text-xl uppercase truncate text-slate-900">{getPlayerName(activeInningData?.strikerPlayerId || '')}</p></div>
              <div className="flex gap-4 text-right">
                <div className="bg-white/50 px-3 py-1 rounded-lg"><p className="text-xl font-black text-slate-900">{currentStats?.batting?.find(b => b.id === activeInningData?.strikerPlayerId)?.runs || 0}</p><p className="text-[8px] text-slate-400 font-black uppercase">Runs</p></div>
                <div className="bg-white/50 px-3 py-1 rounded-lg"><p className="text-xl font-black text-slate-900">{currentStats?.batting?.find(b => b.id === activeInningData?.strikerPlayerId)?.balls || 0}</p><p className="text-[8px] text-slate-400 font-black uppercase">Balls</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 text-slate-900"><History className="w-5 h-5 text-primary" /> Recent Log</h2>
            <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200">Ball-by-Ball</Badge>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide px-2">
            {currentDeliveries?.slice().reverse().slice(0, 12).map(d => (
              <div key={d.id} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center font-black text-xs shadow-sm ring-2 ring-offset-1",
                  d.isWicket ? "bg-red-500 text-white ring-red-500 animate-pulse" : 
                  d.runsScored === 6 ? "bg-purple-600 text-white ring-purple-600" :
                  d.runsScored === 4 ? "bg-emerald-500 text-white ring-emerald-500" :
                  "bg-slate-50 text-slate-600 ring-slate-100"
                )}>
                  {d.isWicket ? "W" : d.totalRunsOnDelivery}
                </div>
                <span className="text-[8px] font-black text-slate-400">{d.overNumber}.{d.ballNumberInOver}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2 text-slate-900"><Swords className="w-5 h-5 text-secondary" /> Scorecard</h2>
          <Card className="border-none shadow-xl overflow-hidden bg-white rounded-3xl">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Innings {match?.currentInningNumber} Performance</span>
              <Badge className="bg-primary/10 text-primary font-black text-[8px] uppercase">{getTeamName(activeInningData?.battingTeamId)} BAT</Badge>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase">Batter</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">B</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentStats?.batting?.map(b => (
                    <TableRow key={b.id} className={cn(b.id === activeInningData?.strikerPlayerId ? "bg-primary/5" : "")}>
                      <TableCell className="py-3">
                        <p className="font-black text-xs uppercase truncate max-w-[100px]">{getPlayerName(b.id)}</p>
                        <p className={cn("text-[8px] font-bold uppercase italic", b.out ? "text-red-500" : "text-slate-400")}>{b.out ? 'OUT' : 'Active'}</p>
                      </TableCell>
                      <TableCell className="text-right font-black text-sm">{b.runs}</TableCell>
                      <TableCell className="text-right text-xs text-slate-500 font-bold">{b.balls}</TableCell>
                      <TableCell className="text-right text-[10px] font-black text-slate-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl border-t-8 border-t-primary shadow-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl">Coordinate Play</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Select Next Bowler</Label>
              <Select value={assignmentForm.bowlerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-2xl"><SelectValue placeholder="Pick Bowler" /></SelectTrigger>
                <SelectContent>
                  {allPlayers?.filter(p => (match?.team1Id === activeInningData?.bowlingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.nonStrikerPlayerId).map(p => (<SelectItem key={p.id} value={p.id} className="font-black uppercase text-xs">{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="w-full text-[10px] font-black uppercase h-12 rounded-2xl border-dashed border-2" onClick={() => recalculateInningState(`inning_${match?.currentInningNumber}`)}><RefreshCw className="w-4 h-4 mr-2" /> Force Sync Current Score</Button>
          </div>
          <DialogFooter><Button onClick={() => { updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { currentBowlerPlayerId: assignmentForm.bowlerId }); setIsPlayerAssignmentOpen(false); toast({ title: "Position Updated" }); }} className="w-full h-16 bg-primary text-white font-black uppercase rounded-2xl shadow-xl text-lg tracking-widest transition-transform active:scale-95">Confirm Assignment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
