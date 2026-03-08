
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, deleteDoc, where } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, History, Loader2, Zap, PlayCircle, ArrowLeftRight, RefreshCw, Swords, Target, Activity, Info, TrendingUp, Trash2, ChevronLeft, Calendar, Clock, UserCheck, ShieldCheck, List, CheckCircle2, MoreVertical, UserPlus, AlertCircle, Settings2, Rewind, RotateCcw, Download, Share2, Check, ChevronRight, Unlock, Edit2, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats, generateMatchReport } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();
  const [isMounted, setIsMounted] = useState(false);
  
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isNoBallDialogOpen, setIsNoBallDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
  
  const [assignmentForm, setAssignmentForm] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });
  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', extraType: 'none', runsCompleted: 0, fielderId: 'none' });
  const [correctionForm, setCorrectionForm] = useState<any>({ id: '', strikerId: '', nonStrikerId: '', bowlerId: '', runs: 0, extra: 'none', isWicket: false, wicketType: 'bowled', targetTimestamp: 0, targetInning: '' });

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

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || [], match?.team1SquadPlayerIds || []), [inn1Deliveries, match?.team1SquadPlayerIds]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || [], match?.team2SquadPlayerIds || []), [inn2Deliveries, match?.team2SquadPlayerIds]);

  const getPlayerName = (pid: string) => allPlayers?.find(p => p.id === pid)?.name || '---';
  const getTeamName = (tid: string) => allTeams?.find(t => t.id === tid)?.name || '---';

  const formatOverNotation = (totalLegalBalls: number) => {
    const completedOvers = Math.floor(totalLegalBalls / 6);
    const ballsInCurrentOver = totalLegalBalls % 6;
    return `${completedOvers}.${ballsInCurrentOver}`;
  };

  const getBallNumberLabel = (legalCount: number) => {
    const ov = Math.floor(legalCount / 6);
    const ball = (legalCount % 6) + 1;
    return `${ov}.${ball}`;
  };

  const inn1WithLabels = useMemo(() => {
    if (!inn1Deliveries) return [];
    let legal = 0;
    return inn1Deliveries.map(d => {
      const label = getBallNumberLabel(legal);
      if (d.extraType === 'none') legal++;
      return { ...d, ballLabel: label };
    });
  }, [inn1Deliveries]);

  const inn2WithLabels = useMemo(() => {
    if (!inn2Deliveries) return [];
    let legal = 0;
    return inn2Deliveries.map(d => {
      const label = getBallNumberLabel(legal);
      if (d.extraType === 'none') legal++;
      return { ...d, ballLabel: label };
    });
  }, [inn2Deliveries]);

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const currentDeliveries = match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;

  const groupedByOver = useMemo(() => {
    if (!currentDeliveries) return [];
    const groups: Record<number, any[]> = {};
    let legalBalls = 0;
    currentDeliveries.forEach(d => {
      const isLegal = d.extraType === 'none';
      const currentOverIdx = isLegal ? Math.floor(legalBalls / 6) + 1 : Math.floor(legalBalls / 6) + 1;
      if (isLegal) legalBalls++;
      if (!groups[currentOverIdx]) groups[currentOverIdx] = [];
      groups[currentOverIdx].push(d);
    });
    return Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [currentDeliveries]);

  const recalculateInningState = async (inningId: string) => {
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveriesList = snap.docs.map(d => d.data());
    
    let score = 0, wkts = 0, legal = 0;
    let sId = '', nsId = '';

    deliveriesList.forEach((d, idx) => {
      score += (d.totalRunsOnDelivery || 0);
      const isRetirement = d.dismissalType === 'retired';
      if (d.isWicket && !isRetirement) wkts++;
      if (d.extraType === 'none') legal++;

      // Professional Crease Sync
      if (idx === deliveriesList.length - 1) {
        sId = d.strikerPlayerId;
        nsId = d.nonStrikerPlayerId;
        const runs = d.runsScored || 0;
        const isLegal = d.extraType === 'none';
        
        if (runs % 2 !== 0) [sId, nsId] = [nsId, sId];
        if (legal % 6 === 0 && isLegal) [sId, nsId] = [nsId, sId];
        
        if (d.isWicket) {
          const outPid = d.batsmanOutPlayerId || d.strikerPlayerId;
          if (outPid === sId) sId = '';
          else if (outPid === nsId) nsId = '';
        }
      }
    });
    
    const updates: any = { 
      score, wickets: wkts, oversCompleted: Math.floor(legal / 6), ballsInCurrentOver: legal % 6,
      strikerPlayerId: sId,
      nonStrikerPlayerId: nsId
    };
    if (legal % 6 === 0 && legal > 0) updates.currentBowlerPlayerId = '';

    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates);
  };

  const handleRecordBall = async (runs: number, extra: any = 'none') => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const isLegal = extra === 'none';
    const totalLegalCount = (currentDeliveries?.filter(d => d.extraType === 'none').length || 0);
    const newTotalLegal = totalLegalCount + (isLegal ? 1 : 0);
    
    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = { 
      id: deliveryId, 
      overLabel: formatOverNotation(newTotalLegal), 
      strikerPlayerId: activeInningData.strikerPlayerId || '', 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || '',
      bowlerId: activeInningData.currentBowlerPlayerId || '', 
      runsScored: runs, 
      extraType: extra, 
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0), 
      isWicket: false, 
      timestamp: Date.now() 
    };
    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData, { merge: true });

    let nextS = activeInningData.strikerPlayerId, nextNS = activeInningData.nonStrikerPlayerId;
    if (runs % 2 !== 0) [nextS, nextNS] = [nextNS, nextS];
    if (newTotalLegal % 6 === 0 && isLegal) [nextS, nextNS] = [nextNS, nextS];

    const updates: any = { 
      score: activeInningData.score + dData.totalRunsOnDelivery, 
      oversCompleted: Math.floor(newTotalLegal / 6), 
      ballsInCurrentOver: newTotalLegal % 6, 
      strikerPlayerId: nextS || '', 
      nonStrikerPlayerId: nextNS || '' 
    };
    
    if (newTotalLegal % 6 === 0 && isLegal) updates.currentBowlerPlayerId = '';
    if (newTotalLegal >= match.totalOvers * 6) updates.isDeclaredFinished = true;

    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsNoBallDialogOpen(false);
  };

  const handleManualCorrection = async () => {
    if (!correctionForm.strikerId || !correctionForm.bowlerId || !correctionForm.targetInning) {
      toast({ title: "Validation Error", description: "Striker and Bowler are required.", variant: "destructive" });
      return;
    }
    
    const deliveryId = correctionForm.id || doc(collection(db, 'temp')).id;
    const runs = Number(correctionForm.runs) || 0;
    const extra = correctionForm.extra || 'none';
    const isWicket = !!correctionForm.isWicket;

    const dData: any = {
      id: deliveryId,
      strikerPlayerId: correctionForm.strikerId || '',
      nonStrikerPlayerId: correctionForm.nonStrikerId || '',
      bowlerId: correctionForm.bowlerId || '',
      runsScored: runs,
      extraType: extra,
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0),
      isWicket: isWicket,
      dismissalType: isWicket ? (correctionForm.wicketType || 'bowled') : '',
      batsmanOutPlayerId: isWicket ? (correctionForm.batterOutId || correctionForm.strikerId) : '',
      timestamp: correctionForm.targetTimestamp || Date.now()
    };

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', correctionForm.targetInning, 'deliveryRecords', deliveryId), dData, { merge: true });
    await recalculateInningState(correctionForm.targetInning);
    
    setIsCorrectionDialogOpen(false);
    toast({ title: correctionForm.id ? "Delivery Updated" : "Delivery Inserted" });
  };

  const currentPermanentlyOutIds = useMemo(() => {
    const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
    return stats.batting
      .filter(b => b.out && !b.dismissal.toLowerCase().includes('retired'))
      .map(b => b.id);
  }, [match?.currentInningNumber, stats1, stats2]);

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 relative px-1">
      <div className="fixed top-16 left-0 right-0 z-[90] bg-white text-slate-950 shadow-2xl px-6 py-4 border-b-4 border-slate-300">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="text-slate-950 hover:bg-slate-100 h-8 w-8 shrink-0"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3">
              <Link href={`/teams/${match?.team1Id}`} className="font-black uppercase text-[11px] text-slate-700 truncate max-w-[90px] hover:text-slate-900 tracking-tight">{getTeamName(match?.team1Id)}</Link>
              <span className="font-black text-2xl leading-none text-slate-950">{inn1?.score || 0}/{inn1?.wickets || 0}</span>
              <Badge variant="outline" className="text-[11px] font-black border-slate-400 h-6 text-slate-950 bg-slate-100 px-2">({inn1?.oversCompleted || 0}.{inn1?.ballsInCurrentOver || 0})</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/teams/${match?.team2Id}`} className="font-black uppercase text-[11px] text-slate-700 truncate max-w-[90px] hover:text-slate-900 tracking-tight">{getTeamName(match?.team2Id)}</Link>
              <span className="font-black text-2xl leading-none text-slate-950">{inn2?.score || 0}/{inn2?.wickets || 0}</span>
              <Badge variant="outline" className="text-[11px] font-black border-slate-400 h-6 text-slate-950 bg-slate-100 px-2">({inn2?.oversCompleted || 0}.{inn2?.ballsInCurrentOver || 0})</Badge>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            {match?.status === 'live' && <Badge variant="destructive" className="animate-pulse text-[10px] h-6 font-black uppercase px-3 shadow-md border-2 border-white ring-2 ring-destructive/20">LIVE</Badge>}
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{match?.currentInningNumber === 1 ? "1st INN" : "2nd INN"}</p>
          </div>
        </div>
      </div>

      <div className="pt-32">
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl mb-6 sticky top-[120px] z-[80] shadow-sm">
            <TabsTrigger value="live" className="font-black text-[9px] uppercase">Live</TabsTrigger>
            <TabsTrigger value="scorecard" className="font-black text-[9px] uppercase">Score</TabsTrigger>
            <TabsTrigger value="analysis" className="font-black text-[9px] uppercase">Analysis</TabsTrigger>
            <TabsTrigger value="overs" className="font-black text-[9px] uppercase">Overs</TabsTrigger>
            <TabsTrigger value="info" className="font-black text-[9px] uppercase">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            {isUmpire && !activeInningData?.isDeclaredFinished && match?.status === 'live' ? (
              <Card className="bg-slate-900 border-none rounded-3xl overflow-hidden shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-1 h-12 border-primary/20 text-primary font-black uppercase text-[9px] bg-white/5"><ShieldCheck className="w-4 h-4 mr-2" /> Match Actions</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 rounded-xl" align="end">
                        <DropdownMenuItem className="font-bold py-3" onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { isDeclaredFinished: true })}><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Finish Innings</DropdownMenuItem>
                        <DropdownMenuItem className="font-bold py-3" onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: match?.currentInningNumber === 1 ? 2 : 1 })}><Rewind className="w-4 h-4 mr-2 text-amber-500" /> Switch Active Scoring</DropdownMenuItem>
                        <DropdownMenuItem className="font-bold py-3" onClick={() => recalculateInningState(`inning_${match?.currentInningNumber}`)}><RefreshCw className="w-4 h-4 mr-2 text-primary" /> Force Sync Simulation</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="font-bold py-3 text-red-500" onClick={() => { if(confirm("DANGER: This will delete ALL delivery records for the current innings. Continue?")) { /* Hard reset logic */ } }}><RotateCcw className="w-4 h-4 mr-2" /> Hard Reset Innings</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={() => setIsPlayerAssignmentOpen(true)} className="flex-1 h-12 border-secondary/20 text-secondary font-black uppercase text-[9px] bg-white/5"><Settings2 className="w-4 h-4 mr-2" /> Assign</Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3, 4, 6].map(r => (
                      <Button key={r} disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl", r >= 4 ? "bg-primary text-white" : "bg-white/5 text-white")}>{r || '•'}</Button>
                    ))}
                    <Button onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { strikerPlayerId: activeInningData?.nonStrikerPlayerId || '', nonStrikerPlayerId: activeInningData?.strikerPlayerId || '' })} className="bg-secondary text-white h-14 font-black rounded-2xl"><ArrowLeftRight className="w-5 h-5"/></Button>
                    <Button variant="outline" onClick={() => { setWicketForm({...wicketForm, batterOutId: activeInningData?.strikerPlayerId || '', fielderId: 'none'}); setIsWicketDialogOpen(true); }} className="h-14 border-red-500/30 text-red-500 font-black rounded-2xl uppercase text-[10px] bg-white/5">Wicket</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px] bg-white/5">Wide</Button>
                    <Button variant="outline" onClick={() => setIsNoBallDialogOpen(true)} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px] bg-white/5">No Ball</Button>
                    <Button variant="outline" onClick={async () => { 
                      const currId = `inning_${match?.currentInningNumber}`;
                      const snap = await getDocs(query(collection(db, 'matches', matchId, 'innings', currId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1)));
                      if(!snap.empty) { await deleteDoc(snap.docs[0].ref); recalculateInningState(currId); }
                    }} className="h-12 border-white/10 text-slate-400 uppercase font-black text-[9px] bg-white/5">Undo</Button>
                  </div>
                </CardContent>
              </Card>
            ) : isUmpire && match?.status === 'live' && (
              <div className="space-y-4">
                <Button onClick={() => { /* Finish logic */ }} className="w-full h-20 bg-emerald-600 text-white font-black text-xl uppercase rounded-3xl shadow-2xl">
                  {match?.currentInningNumber === 1 ? "Finish 1st Innings" : "Finish Match"}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { isDeclaredFinished: false })} className="flex-1 h-12 border-amber-500/20 text-amber-600 font-black uppercase text-[9px] bg-amber-50"><Unlock className="w-4 h-4 mr-2" /> Re-open for Corrections</Button>
                  <Button variant="outline" onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: match?.currentInningNumber === 1 ? 2 : 1 })} className="flex-1 h-12 border-primary/20 text-primary font-black uppercase text-[9px] bg-primary/5"><Rewind className="w-4 h-4 mr-2" /> Switch Active Inning</Button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                <div className="p-3 bg-slate-100 flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Live Batting</span></div>
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[9px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">4s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">6s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[activeInningData?.strikerPlayerId, activeInningData?.nonStrikerPlayerId].map((pid, idx) => {
                      if (!pid || pid === 'none' || pid === '') return null;
                      const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
                      const b = stats.batting.find((p: any) => p?.id === pid) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                      return (
                        <TableRow key={pid} className={idx === 0 ? "bg-primary/5" : ""}>
                          <TableCell className="font-black text-xs uppercase truncate max-w-[100px] py-3"><Link href={`/players/${pid}`} className="hover:text-primary transition-colors">{getPlayerName(pid)}{idx === 0 ? '*' : ''}</Link></TableCell>
                          <TableCell className="text-right font-black">{b.runs}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-slate-500">{b.balls}</TableCell>
                          <TableCell className="text-right text-xs text-slate-400">{b.fours}</TableCell>
                          <TableCell className="text-right text-xs text-slate-400">{b.sixes}</TableCell>
                          <TableCell className="text-right text-[9px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                <div className="p-3 bg-slate-100 flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Live Bowling</span></div>
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[9px] font-black uppercase">Bowler</TableHead><TableHead className="text-right text-[9px] font-black uppercase">O</TableHead><TableHead className="text-right text-[9px] font-black uppercase">M</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">W</TableHead><TableHead className="text-right text-[9px] font-black uppercase">ER</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {activeInningData?.currentBowlerPlayerId ? (
                      <TableRow className="bg-secondary/5">
                        <TableCell className="font-black text-xs uppercase truncate max-w-[100px] py-3"><Link href={`/players/${activeInningData.currentBowlerPlayerId}`} className="hover:text-secondary transition-colors">{getPlayerName(activeInningData.currentBowlerPlayerId)}</Link></TableCell>
                        <TableCell className="text-right font-bold text-xs">{(match?.currentInningNumber === 1 ? stats1 : stats2).bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.oversDisplay || '0.0'}</TableCell>
                        <TableCell className="text-right text-xs">{(match?.currentInningNumber === 1 ? stats1 : stats2).bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.maidens || 0}</TableCell>
                        <TableCell className="text-right text-xs">{(match?.currentInningNumber === 1 ? stats1 : stats2).bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.runs || 0}</TableCell>
                        <TableCell className="text-right font-black text-secondary">{(match?.currentInningNumber === 1 ? stats1 : stats2).bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.wickets || 0}</TableCell>
                        <TableCell className="text-right text-[9px] font-bold text-slate-400">{(match?.currentInningNumber === 1 ? stats1 : stats2).bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.economy || '0.00'}</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Card>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest flex items-center gap-2"><Clock className="w-3 h-3" /> Recent Over History</h3>
                {groupedByOver.length > 0 ? groupedByOver.map(([overIdx, deliveries]) => (
                  <Card key={overIdx} className="border-none shadow-sm bg-white p-3 flex items-center justify-between rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="bg-slate-900 text-white text-[10px] font-black h-8 w-8 rounded-lg flex items-center justify-center shrink-0">OV {overIdx}</div>
                      <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-hide py-1">
                        {deliveries.map(d => {
                          let label = (d.totalRunsOnDelivery || 0).toString();
                          let color = "bg-slate-100 text-slate-600";
                          if (d.isWicket) { label = "W"; color = "bg-red-500 text-white"; }
                          else if (d.extraType === 'wide') { label = `${d.totalRunsOnDelivery || 1}wd`; color = "bg-amber-100 text-amber-700"; }
                          else if (d.extraType === 'noball') { label = `${d.totalRunsOnDelivery || 1}nb`; color = "bg-amber-100 text-amber-700"; }
                          else if (d.runsScored === 4) color = "bg-blue-500 text-white";
                          else if (d.runsScored === 6) color = "bg-primary text-white";
                          else if (d.runsScored === 0) label = "•";
                          return <div key={d.id} className={cn("min-w-[24px] h-6 px-1.5 rounded flex items-center justify-center text-[10px] font-black whitespace-nowrap", color)}>{label}</div>;
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2 border-l pl-3"><p className="text-[10px] font-black text-slate-900">{deliveries.reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0)} R</p></div>
                  </Card>
                )) : (
                  <div className="text-center py-8 border-2 border-dashed rounded-2xl bg-slate-50/50"><p className="text-[10px] font-black uppercase text-slate-300">Awaiting first delivery</p></div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="overs" className="space-y-4">
            <h2 className="text-lg font-black uppercase text-slate-900 px-2 flex items-center gap-2"><List className="w-5 h-5 text-primary" /> Delivery History</h2>
            <Tabs defaultValue="current" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-10 bg-slate-100 p-1 rounded-xl mb-4">
                <TabsTrigger value="current" className="text-[9px] font-black uppercase">Inning {match?.currentInningNumber}</TabsTrigger>
                <TabsTrigger value="other" className="text-[9px] font-black uppercase" disabled={!inn2 && match?.currentInningNumber === 1}>Inning {match?.currentInningNumber === 1 ? 2 : 1}</TabsTrigger>
              </TabsList>
              
              {[ 
                {id: 'current', deliveries: (match?.currentInningNumber === 1 ? inn1WithLabels : inn2WithLabels), innKey: `inning_${match?.currentInningNumber}`}, 
                {id: 'other', deliveries: (match?.currentInningNumber === 1 ? inn2WithLabels : inn1WithLabels), innKey: `inning_${match?.currentInningNumber === 1 ? 2 : 1}`} 
              ].map(tab => (
                <TabsContent key={tab.id} value={tab.id} className="space-y-1">
                  {tab.deliveries.slice().reverse().map((d, idx, arr) => {
                    const prevBallInLog = arr[idx + 1]; 
                    return (
                      <div key={d.id} className="space-y-1">
                        {isUmpire && (
                          <div className="flex justify-center py-1 group">
                            <Button variant="ghost" size="sm" onClick={() => {
                              const newTs = prevBallInLog ? (prevBallInLog.timestamp + d.timestamp) / 2 : d.timestamp - 1000;
                              setCorrectionForm({ id: '', strikerId: d.strikerPlayerId || '', nonStrikerId: d.nonStrikerPlayerId || '', bowlerId: d.bowlerId || '', runs: 0, extra: 'none', isWicket: false, targetTimestamp: newTs, targetInning: tab.innKey });
                              setIsCorrectionDialogOpen(true);
                            }} className="h-6 w-6 rounded-full bg-slate-50 text-slate-300 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all p-0">
                              <PlusCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        <Card className="border-none shadow-sm bg-white p-3 flex items-center justify-between rounded-xl group animate-in fade-in border-l-4 border-l-slate-100">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center min-w-[40px] border-r pr-3">
                              <span className="text-[10px] font-black text-slate-400">BALL</span>
                              <span className="text-xs font-black text-slate-900">{d.ballLabel}</span>
                            </div>
                            <div className={cn("w-10 h-10 rounded-full flex flex-col items-center justify-center font-black text-[10px] border shadow-sm shrink-0", d.isWicket ? "bg-red-500 text-white border-red-600" : d.extraType !== 'none' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-900 border-slate-100")}>
                              {d.isWicket ? "W" : (d.totalRunsOnDelivery || 0)}
                              {d.extraType === 'wide' && <span className="text-[6px] -mt-1">WD</span>}
                              {d.extraType === 'noball' && <span className="text-[6px] -mt-1">NB</span>}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-900 truncate max-w-[160px] uppercase">
                                {getPlayerName(d.strikerPlayerId)} <span className="text-[8px] text-slate-400 italic">vs</span> {getPlayerName(d.bowlerId)}
                              </p>
                              <p className={cn("text-[8px] font-bold uppercase", d.isWicket ? "text-red-500" : "text-slate-400")}>
                                {d.isWicket ? d.dismissalType : `${d.runsScored || 0} runs ${d.extraType !== 'none' ? `(${d.extraType})` : ''}`}
                              </p>
                            </div>
                          </div>
                          {isUmpire && (
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" onClick={() => { setCorrectionForm({ ...d, extra: d.extraType || 'none', runs: d.runsScored || 0, targetInning: tab.innKey }); setIsCorrectionDialogOpen(true); }} className="h-8 w-8 text-slate-300 hover:text-primary"><Edit2 className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="icon" onClick={async () => { if(confirm("Delete delivery? Score and simulation will recalculate.")) { await deleteDoc(doc(db, 'matches', matchId, 'innings', tab.innKey, 'deliveryRecords', d.id)); recalculateInningState(tab.innKey); } }} className="h-8 w-8 text-slate-300 hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          )}
                        </Card>
                      </div>
                    );
                  })}
                  {isUmpire && tab.deliveries && tab.deliveries.length > 0 && (
                    <div className="flex justify-center py-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const lastBall = tab.deliveries![tab.deliveries!.length - 1];
                        setCorrectionForm({ id: '', strikerId: lastBall.strikerPlayerId || '', nonStrikerId: lastBall.nonStrikerPlayerId || '', bowlerId: lastBall.bowlerId || '', runs: 0, extra: 'none', isWicket: false, targetTimestamp: lastBall.timestamp + 1000, targetInning: tab.innKey });
                        setIsCorrectionDialogOpen(true);
                      }} className="text-[10px] font-black uppercase text-slate-400 hover:text-primary"><PlusCircle className="w-4 h-4 mr-2" /> Append Ball</Button>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[151]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl text-amber-600">Ball Correction</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400">Modify delivery exactly where it occurred</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Striker</Label>
                <Select value={correctionForm.strikerId || ''} onValueChange={(v) => setCorrectionForm({...correctionForm, strikerId: v})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {allPlayers?.filter(p => (correctionForm.targetInning === 'inning_1' ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) || allPlayers.find(ap => ap.id === correctionForm.strikerId)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Bowler</Label>
                <Select value={correctionForm.bowlerId || ''} onValueChange={(v) => setCorrectionForm({...correctionForm, bowlerId: v})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {allPlayers?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Runs off Bat</Label>
                <Select value={(correctionForm.runs || 0).toString()} onValueChange={(v) => setCorrectionForm({...correctionForm, runs: parseInt(v)})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">{[0,1,2,3,4,6].map(r => <SelectItem key={r} value={r.toString()}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Extra</Label>
                <Select value={correctionForm.extra || 'none'} onValueChange={(v) => setCorrectionForm({...correctionForm, extra: v})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]"><SelectItem value="none">None</SelectItem><SelectItem value="wide">Wide</SelectItem><SelectItem value="noball">No Ball</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
              <Label className="text-[10px] font-black uppercase flex-1">Is it a Wicket?</Label>
              <Button variant={correctionForm.isWicket ? "destructive" : "outline"} size="sm" onClick={() => setCorrectionForm({...correctionForm, isWicket: !correctionForm.isWicket})} className="font-black h-8 uppercase text-[10px]">{correctionForm.isWicket ? "YES" : "NO"}</Button>
            </div>
            {correctionForm.isWicket && (
              <div className="space-y-3 animate-in slide-in-from-top-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase">Wicket Type</Label>
                  <Select value={correctionForm.wicketType || 'bowled'} onValueChange={(v) => setCorrectionForm({...correctionForm, wicketType: v})}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[200]"><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumped">Stumped</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase">Batter Out</Label>
                  <Select value={correctionForm.batterOutId || correctionForm.strikerId || ''} onValueChange={(v) => setCorrectionForm({...correctionForm, batterOutId: v})}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[200]"><SelectItem value={correctionForm.strikerId || 's'}>Striker</SelectItem><SelectItem value={correctionForm.nonStrikerId || 'ns'}>Non-Striker</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleManualCorrection} className="w-full h-14 bg-amber-600 font-black uppercase shadow-xl">Apply & Re-Simulate</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl bg-white z-[151]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-xl">Official Assignment</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400">Over Progress: {activeInningData?.ballsInCurrentOver || 0}/6 Legal Balls</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-900 ml-1">STRIKER</Label>
              <Select value={assignmentForm.strikerId || ''} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Striker" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {allPlayers?.filter(p => 
                    (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && 
                    p.id !== assignmentForm.nonStrikerId && 
                    p.id !== activeInningData?.currentBowlerPlayerId &&
                    !currentPermanentlyOutIds.includes(p.id)
                  ).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-900 ml-1">NON-STRIKER</Label>
              <Select value={assignmentForm.nonStrikerId || ''} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Non-Striker" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {allPlayers?.filter(p => 
                    (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && 
                    p.id !== assignmentForm.strikerId && 
                    p.id !== activeInningData?.currentBowlerPlayerId &&
                    !currentPermanentlyOutIds.includes(p.id)
                  ).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-black uppercase text-slate-900 ml-1">BOWLER</Label>
                {activeInningData?.ballsInCurrentOver !== 0 && activeInningData?.ballsInCurrentOver !== undefined && <Badge variant="outline" className="text-[8px] font-black border-amber-500 text-amber-600 bg-amber-50 uppercase">Over in Progress</Badge>}
              </div>
              <Select value={assignmentForm.bowlerId || ''} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Bowler" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {allPlayers?.filter(p => (activeInningData?.battingTeamId === match?.team1Id ? match?.team2SquadPlayerIds : match?.team1SquadPlayerIds)?.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { 
              const updates: any = {};
              if (assignmentForm.strikerId) updates.strikerPlayerId = assignmentForm.strikerId;
              if (assignmentForm.nonStrikerId) updates.nonStrikerPlayerId = assignmentForm.nonStrikerId;
              if (assignmentForm.bowlerId) updates.currentBowlerPlayerId = assignmentForm.bowlerId;
              updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), updates);
              setIsPlayerAssignmentOpen(false);
            }} className="w-full h-16 bg-primary font-black uppercase rounded-2xl shadow-xl">Confirm Assignment</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-destructive shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl text-destructive">Register Wicket</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label>
              <Select value={wicketForm.batterOutId || ''} onValueChange={(v) => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue placeholder="Select Batter" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)} (Striker)</SelectItem>}
                  {activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)} (Non-Striker)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Dismissal Type</Label>
              <Select value={wicketForm.type || 'bowled'} onValueChange={(v) => setWicketForm({...wicketForm, type: v, runsCompleted: 0, fielderId: 'none'})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]"><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumped">Stumped</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
              </Select>
            </div>
            {['caught', 'runout', 'stumped'].includes(wicketForm.type) && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label className="text-[10px] font-black uppercase text-slate-400">{wicketForm.type === 'runout' ? 'Effected By' : 'Fielder'}</Label>
                <Select value={wicketForm.fielderId || 'none'} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}>
                  <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue placeholder="Pick Fielder" /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="none">No Fielder (Direct)</SelectItem>
                    {allPlayers?.filter(p => (activeInningData?.battingTeamId === match?.team1Id ? match?.team2SquadPlayerIds : match?.team1SquadPlayerIds)?.includes(p.id)).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {wicketForm.type === 'runout' && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label className="text-[10px] font-black uppercase text-slate-400">Runs Completed?</Label>
                <Select value={(wicketForm.runsCompleted || 0).toString()} onValueChange={(v) => setWicketForm({...wicketForm, runsCompleted: parseInt(v)})}>
                  <SelectTrigger className="h-14 font-black border-2 rounded-xl border-amber-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">{[0, 1, 2, 3].map(r => <SelectItem key={r} value={r.toString()}>{r} Runs</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={async () => {
              if (!wicketForm.batterOutId) return;
              const currId = `inning_${match?.currentInningNumber}`;
              const totalLegal = (currentDeliveries?.filter(d => d.extraType === 'none').length || 0) + 1;
              const dId = doc(collection(db, 'temp')).id;
              await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currId, 'deliveryRecords', dId), { 
                id: dId, overLabel: formatOverNotation(totalLegal), strikerPlayerId: activeInningData?.strikerPlayerId || '', nonStrikerPlayerId: activeInningData?.nonStrikerPlayerId || '', bowlerId: activeInningData?.currentBowlerPlayerId || '', fielderPlayerId: wicketForm.fielderId || 'none', isWicket: true, dismissalType: wicketForm.type || 'bowled', batsmanOutPlayerId: wicketForm.batterOutId || '', extraType: 'none', runsScored: wicketForm.runsCompleted || 0, totalRunsOnDelivery: wicketForm.runsCompleted || 0, timestamp: Date.now() 
              }, { merge: true });
              updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currId), { 
                score: (activeInningData?.score || 0) + (wicketForm.runsCompleted || 0), wickets: (activeInningData?.wickets || 0) + (wicketForm.type === 'retired' ? 0 : 1), oversCompleted: Math.floor(totalLegal / 6), ballsInCurrentOver: totalLegal % 6, [wicketForm.batterOutId === activeInningData?.strikerPlayerId ? 'strikerPlayerId' : 'nonStrikerPlayerId']: '' 
              });
              setIsWicketDialogOpen(false);
              setAssignmentForm({ strikerId: wicketForm.batterOutId === activeInningData?.strikerPlayerId ? '' : activeInningData?.strikerPlayerId || '', nonStrikerId: wicketForm.batterOutId === activeInningData?.nonStrikerPlayerId ? '' : activeInningData?.nonStrikerPlayerId || '', bowlerId: activeInningData?.currentBowlerPlayerId || '' });
              setIsPlayerAssignmentOpen(true);
            }} disabled={!wicketForm.batterOutId} className="w-full h-16 bg-destructive text-white font-black uppercase rounded-2xl shadow-xl">Confirm Wicket</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoBallDialogOpen} onOpenChange={setIsNoBallDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl text-amber-600">No Ball Result</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {[0, 1, 2, 3, 4, 6].map(r => <Button key={r} onClick={() => handleRecordBall(r, 'noball')} variant="outline" className="h-16 font-black text-2xl border-amber-200">{r || '•'}</Button>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
