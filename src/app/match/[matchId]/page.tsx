
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
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
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';

const chartConfig = {
  inn1: { label: "1st Innings", color: "hsl(var(--primary))" },
  inn2: { label: "2nd Innings", color: "hsl(var(--secondary))" }
} satisfies ChartConfig;

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
  const [correctionForm, setCorrectionForm] = useState<any>({ id: '', strikerId: '', bowlerId: '', runs: 0, extra: 'none', isWicket: false, wicketType: 'bowled', targetTimestamp: 0, targetInning: '' });

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
      if (isLegal) legalBalls++;
      // Determine which over this ball belongs to
      const overNum = Math.ceil(legalBalls / 6) || (isLegal ? 1 : Math.ceil((legalBalls + 1) / 6));
      // Correcting over number logic for display:
      const currentOverIdx = isLegal ? Math.floor((legalBalls - 1) / 6) + 1 : Math.floor(legalBalls / 6) + 1;
      if (!groups[currentOverIdx]) groups[currentOverIdx] = [];
      groups[currentOverIdx].push({ ...d, computedOverLabel: `${Math.floor((legalBalls - (isLegal ? 1 : 0)) / 6)}.${(legalBalls - (isLegal ? 1 : 0)) % 6}` });
    });
    return Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [currentDeliveries]);

  const chartData = useMemo(() => {
    const data: any[] = [];
    const maxOvers = match?.totalOvers || 6;
    for (let i = 0; i <= maxOvers; i++) {
      const point: any = { over: i };
      const d1 = inn1Deliveries || [];
      let score1 = 0, legal1 = 0, wkts1 = 0;
      for (const d of d1) {
        score1 += d.totalRunsOnDelivery || 0;
        if (d.extraType === 'none') legal1++;
        if (legal1 > i * 6) break;
        if (d.isWicket && d.dismissalType !== 'retired') wkts1++;
      }
      if (legal1 > 0 || i === 0) { point.inn1 = score1; point.w1 = wkts1; }
      const d2 = inn2Deliveries || [];
      let score2 = 0, legal2 = 0, wkts2 = 0;
      for (const d of d2) {
        score2 += d.totalRunsOnDelivery || 0;
        if (d.extraType === 'none') legal2++;
        if (legal2 > i * 6) break;
        if (d.isWicket && d.dismissalType !== 'retired') wkts2++;
      }
      if (legal2 > 0 || (i === 0 && match?.currentInningNumber === 2)) { point.inn2 = score2; point.w2 = wkts2; }
      data.push(point);
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries, match]);

  const manhattanData = useMemo(() => {
    const data: any[] = [];
    const maxOvers = match?.totalOvers || 6;
    for (let i = 1; i <= maxOvers; i++) {
      const point: any = { over: i };
      const overRuns1 = (inn1Deliveries || []).filter((d, idx, arr) => {
        let l = 0; for(let j=0; j<=idx; j++) if(arr[j].extraType === 'none') l++;
        const o = Math.floor((l - (d.extraType === 'none' ? 1 : 0)) / 6) + 1;
        return o === i;
      }).reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
      point.inn1 = overRuns1;
      const overRuns2 = (inn2Deliveries || []).filter((d, idx, arr) => {
        let l = 0; for(let j=0; j<=idx; j++) if(arr[j].extraType === 'none') l++;
        const o = Math.floor((l - (d.extraType === 'none' ? 1 : 0)) / 6) + 1;
        return o === i;
      }).reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
      point.inn2 = overRuns2;
      data.push(point);
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries, match]);

  const recalculateInningState = async (inningId: string) => {
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveriesList = snap.docs.map(d => d.data());
    
    let score = 0, wkts = 0, legal = 0;
    // We need to simulate strike rotation to find the FINAL striker/non-striker after corrections
    const matchSnap = await getDocs(query(collection(db, 'matches'), where('id', '==', matchId)));
    const matchData = matchSnap.docs[0]?.data();
    const inningSnap = await getDocs(query(collection(db, 'matches', matchId, 'innings'), where('id', '==', inningId)));
    const inningData = inningSnap.docs[0]?.data();

    // Starting positions usually come from the very first assignment or the manual assignment logic
    // For simplicity, we preserve the current striker unless the simulation dictates otherwise
    let sId = inningData?.strikerPlayerId || '';
    let nsId = inningData?.nonStrikerPlayerId || '';

    deliveriesList.forEach((d, idx) => {
      score += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && d.dismissalType !== 'retired') wkts++;
      if (d.extraType === 'none') legal++;

      // Simulation of rotation for that specific ball
      const runs = d.runsScored || 0;
      const isLegal = d.extraType === 'none';
      
      // We only rotate if the ball is valid or if it was a run-out scenario
      // Note: Rotation on extras logic is handled in the scoring UI, here we just follow ball by ball
      // If we want a perfect sync, every ball record should store who faced it.
      // Our records already store strikerPlayerId and nonStrikerPlayerId at that time.
      // So the final state is just the LAST ball's state.
      if (idx === deliveriesList.length - 1) {
        sId = d.strikerPlayerId;
        nsId = d.nonStrikerPlayerId;
        
        // Final ball rotation logic
        if (runs % 2 !== 0) [sId, nsId] = [nsId, sId];
        if (legal % 6 === 0 && isLegal) [sId, nsId] = [nsId, sId];
        if (d.isWicket && d.dismissalType !== 'retired') {
          // If it was a wicket, the batter out is empty
          if (d.batsmanOutPlayerId === sId) sId = '';
          else if (d.batsmanOutPlayerId === nsId) nsId = '';
        }
      }
    });
    
    const isActuallyFinished = (legal >= (match?.totalOvers || 6) * 6) || (wkts >= 10);
    const updates: any = { 
      score, wickets: wkts, oversCompleted: Math.floor(legal / 6), ballsInCurrentOver: legal % 6,
      isDeclaredFinished: isActuallyFinished,
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
      strikerPlayerId: activeInningData.strikerPlayerId, 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerId: activeInningData.currentBowlerPlayerId, 
      runsScored: runs, 
      extraType: extra, 
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0), 
      isWicket: false, 
      timestamp: Date.now() 
    };
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData, { merge: true });

    let nextS = activeInningData.strikerPlayerId, nextNS = activeInningData.nonStrikerPlayerId;
    if (runs % 2 !== 0) [nextS, nextNS] = [nextNS, nextS];
    if (newTotalLegal % 6 === 0 && isLegal) [nextS, nextNS] = [nextNS, nextS];

    const updates: any = { 
      score: activeInningData.score + dData.totalRunsOnDelivery, 
      oversCompleted: Math.floor(newTotalLegal / 6), 
      ballsInCurrentOver: newTotalLegal % 6, 
      strikerPlayerId: nextS, 
      nonStrikerPlayerId: nextNS 
    };
    
    if (newTotalLegal % 6 === 0 && isLegal) updates.currentBowlerPlayerId = '';
    if (newTotalLegal >= match.totalOvers * 6 || updates.wickets >= 10) updates.isDeclaredFinished = true;
    if (match.currentInningNumber === 2 && inn1 && updates.score > inn1.score) updates.isDeclaredFinished = true;

    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsNoBallDialogOpen(false);
  };

  const handleManualCorrection = async () => {
    if (!correctionForm.strikerId || !correctionForm.bowlerId || !correctionForm.targetInning) return;
    
    const deliveryId = correctionForm.id || doc(collection(db, 'temp')).id;
    const dData = {
      id: deliveryId,
      strikerPlayerId: correctionForm.strikerId,
      nonStrikerPlayerId: correctionForm.nonStrikerId || '',
      bowlerId: correctionForm.bowlerId,
      runsScored: correctionForm.runs,
      extraType: correctionForm.extra,
      totalRunsOnDelivery: correctionForm.runs + (correctionForm.extra !== 'none' ? 1 : 0),
      isWicket: correctionForm.isWicket,
      dismissalType: correctionForm.isWicket ? correctionForm.wicketType : '',
      batsmanOutPlayerId: correctionForm.isWicket ? (correctionForm.batterOutId || correctionForm.strikerId) : '',
      timestamp: correctionForm.targetTimestamp || Date.now()
    };

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', correctionForm.targetInning, 'deliveryRecords', deliveryId), dData, { merge: true });
    await recalculateInningState(correctionForm.targetInning);
    
    setIsCorrectionDialogOpen(false);
    toast({ title: correctionForm.id ? "Delivery Updated" : "Delivery Inserted" });
  };

  const InningScorecard = ({ stats, teamId }: { stats: any, teamId: string }) => (
    <div className="space-y-6 pb-10">
      <Card className="border-none shadow-xl overflow-hidden rounded-2xl bg-white">
        <div className="p-4 bg-[#009688] text-white flex justify-between items-center">
          <span className="font-black uppercase tracking-tight text-sm">{getTeamName(teamId)}</span>
          <span className="font-black text-lg">{stats.total}-{stats.wickets} <span className="text-xs font-medium">({stats.overs} Ov)</span></span>
        </div>
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase text-slate-500">Batter</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">R</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">B</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">4s</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">6s</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">SR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.batting.map((b: any) => (
              <TableRow key={b?.id} className="group hover:bg-slate-50/50">
                <TableCell className="py-3">
                  <Link href={`/players/${b?.id}`} className="font-black text-xs uppercase text-blue-600 hover:underline transition-colors">{getPlayerName(b?.id)}</Link>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 italic">{b?.out ? b?.dismissal : 'not out'}</p>
                </TableCell>
                <TableCell className="text-right font-black text-sm">{b?.runs}</TableCell>
                <TableCell className="text-right text-xs text-slate-500 font-medium">{b?.balls}</TableCell>
                <TableCell className="text-right text-xs text-slate-500">{b?.fours}</TableCell>
                <TableCell className="text-right text-xs text-slate-500">{b?.sixes}</TableCell>
                <TableCell className="text-right text-[10px] font-black text-slate-400">{b?.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-slate-50/30 font-bold">
              <TableCell className="text-[10px] uppercase font-black">Extras</TableCell>
              <TableCell colSpan={5} className="text-right text-xs">
                {stats.extras.total} <span className="text-[9px] font-medium text-slate-400">(w {stats.extras.w}, nb {stats.extras.nb})</span>
              </TableCell>
            </TableRow>
            <TableRow className="bg-slate-50 font-black">
              <TableCell className="text-[10px] uppercase">Total</TableCell>
              <TableCell colSpan={5} className="text-right text-sm">
                {stats.total}-{stats.wickets} <span className="text-[10px] text-slate-400">({stats.overs} Overs, RR: {stats.rr})</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 relative px-1">
      <div className="fixed top-16 left-0 right-0 z-[90] bg-white text-slate-950 shadow-xl px-6 py-4 border-b-2 border-slate-200">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="text-slate-950 hover:bg-slate-100 h-8 w-8 shrink-0"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3">
              <Link href={`/teams/${match?.team1Id}`} className="font-black uppercase text-[10px] text-slate-600 truncate max-w-[80px] hover:text-slate-900">{getTeamName(match?.team1Id)}</Link>
              <span className={cn("font-black text-2xl leading-none text-slate-950")}>{inn1?.score || 0}/{inn1?.wickets || 0}</span>
              <Badge variant="outline" className="text-[10px] font-black border-slate-300 h-5 text-slate-950 bg-slate-100">({inn1?.oversCompleted || 0}.{inn1?.ballsInCurrentOver || 0})</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/teams/${match?.team2Id}`} className="font-black uppercase text-[10px] text-slate-600 truncate max-w-[80px] hover:text-slate-900">{getTeamName(match?.team2Id)}</Link>
              <span className={cn("font-black text-2xl leading-none text-slate-950")}>{inn2?.score || 0}/{inn2?.wickets || 0}</span>
              <Badge variant="outline" className="text-[10px] font-black border-slate-300 h-5 text-slate-950 bg-slate-100">({inn2?.oversCompleted || 0}.{inn2?.ballsInCurrentOver || 0})</Badge>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            {match?.status === 'live' && <Badge variant="destructive" className="animate-pulse text-[10px] h-5 font-black uppercase px-3 shadow-sm border-2 border-white">LIVE</Badge>}
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">{match?.currentInningNumber === 1 ? "1st Inn" : "2nd Inn"}</p>
          </div>
        </div>
      </div>

      <div className="pt-28">
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl mb-6 sticky top-[112px] z-[80] shadow-sm">
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
                    <Button onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { strikerPlayerId: activeInningData?.nonStrikerPlayerId, nonStrikerPlayerId: activeInningData?.strikerPlayerId })} className="bg-secondary text-white h-14 font-black rounded-2xl"><ArrowLeftRight className="w-5 h-5"/></Button>
                    <Button variant="outline" onClick={() => { setWicketForm({...wicketForm, batterOutId: activeInningData?.strikerPlayerId || '', fielderId: 'none'}); setIsWicketDialogOpen(true); }} className="h-14 border-red-500/30 text-red-500 font-black rounded-2xl uppercase text-[10px]">Wicket</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px]">Wide</Button>
                    <Button variant="outline" onClick={() => setIsNoBallDialogOpen(true)} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px]">No Ball</Button>
                    <Button variant="outline" onClick={async () => { 
                      const currId = `inning_${match?.currentInningNumber}`;
                      const snap = await getDocs(query(collection(db, 'matches', matchId, 'innings', currId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1)));
                      if(!snap.empty) { await deleteDoc(snap.docs[0].ref); recalculateInningState(currId); }
                    }} className="h-12 border-white/10 text-slate-400 uppercase font-black text-[9px]">Undo</Button>
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
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase">Batter</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">B</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">4s</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">6s</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[activeInningData?.strikerPlayerId, activeInningData?.nonStrikerPlayerId].map((pid, idx) => {
                      if (!pid || pid === 'none' || pid === '') return null;
                      const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
                      const b = stats.batting.find((p: any) => p?.id === pid) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                      return (
                        <TableRow key={pid} className={idx === 0 ? "bg-primary/5" : ""}>
                          <TableCell className="font-black text-xs uppercase truncate max-w-[100px] py-3">
                            <Link href={`/players/${pid}`} className="hover:text-primary transition-colors">{getPlayerName(pid)}{idx === 0 ? '*' : ''}</Link>
                          </TableCell>
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
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[9px] font-black uppercase">Bowler</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">O</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">M</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">W</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase">ER</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeInningData?.currentBowlerPlayerId ? (
                      <TableRow className="bg-secondary/5">
                        <TableCell className="font-black text-xs uppercase truncate max-w-[100px] py-3">
                          <Link href={`/players/${activeInningData.currentBowlerPlayerId}`} className="hover:text-secondary transition-colors">{getPlayerName(activeInningData.currentBowlerPlayerId)}</Link>
                        </TableCell>
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
                          let label = d.totalRunsOnDelivery.toString();
                          let color = "bg-slate-100 text-slate-600";
                          if (d.isWicket) { label = "W"; color = "bg-red-500 text-white"; }
                          else if (d.extraType === 'wide') { label = `${d.totalRunsOnDelivery}wd`; color = "bg-amber-100 text-amber-700"; }
                          else if (d.extraType === 'noball') { label = `${d.totalRunsOnDelivery}nb`; color = "bg-amber-100 text-amber-700"; }
                          else if (d.runsScored === 4) color = "bg-blue-500 text-white";
                          else if (d.runsScored === 6) color = "bg-primary text-white";
                          else if (d.runsScored === 0) label = "•";
                          return <div key={d.id} className={cn("min-w-[24px] h-6 px-1.5 rounded flex items-center justify-center text-[10px] font-black whitespace-nowrap", color)}>{label}</div>;
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2 border-l pl-3"><p className="text-[10px] font-black text-slate-900">{deliveries.reduce((acc, d) => acc + d.totalRunsOnDelivery, 0)} R</p></div>
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
              
              {[ {id: 'current', deliveries: currentDeliveries, innKey: `inning_${match?.currentInningNumber}`}, {id: 'other', deliveries: (match?.currentInningNumber === 1 ? inn2Deliveries : inn1Deliveries), innKey: `inning_${match?.currentInningNumber === 1 ? 2 : 1}`} ].map(tab => (
                <TabsContent key={tab.id} value={tab.id} className="space-y-1">
                  {tab.deliveries?.slice().reverse().map((d, idx, arr) => {
                    // Logic to find neighbor timestamps for insertion
                    const nextBallInLog = arr[idx - 1]; // chronologically AFTER
                    const prevBallInLog = arr[idx + 1]; // chronologically BEFORE
                    
                    return (
                      <div key={d.id} className="space-y-1">
                        {isUmpire && (
                          <div className="flex justify-center py-1 group">
                            <Button variant="ghost" size="sm" onClick={() => {
                              const targetInn = tab.innKey;
                              const currentDeliveriesList = tab.deliveries || [];
                              const dIdx = currentDeliveriesList.findIndex(ball => ball.id === d.id);
                              const prevBall = currentDeliveriesList[dIdx - 1];
                              const newTs = prevBall ? (prevBall.timestamp + d.timestamp) / 2 : d.timestamp - 1000;
                              setCorrectionForm({ id: '', strikerId: d.strikerPlayerId, nonStrikerId: d.nonStrikerPlayerId, bowlerId: d.bowlerId, runs: 0, extra: 'none', isWicket: false, targetTimestamp: newTs, targetInning: targetInn });
                              setIsCorrectionDialogOpen(true);
                            }} className="h-6 w-6 rounded-full bg-slate-50 text-slate-300 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all p-0">
                              <PlusCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        <Card className="border-none shadow-sm bg-white p-2 flex items-center justify-between rounded-xl group animate-in fade-in">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] border shadow-inner", d.isWicket ? "bg-red-500 text-white border-red-600" : "bg-slate-50 text-slate-900 border-slate-100")}>
                              {d.isWicket ? "W" : d.totalRunsOnDelivery}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-900 truncate max-w-[180px]">
                                {getPlayerName(d.strikerPlayerId)} <span className="text-[8px] text-slate-400">vs</span> {getPlayerName(d.bowlerId)}
                              </p>
                              {d.isWicket && <p className="text-[8px] font-black text-red-500 uppercase">{d.dismissalType}</p>}
                            </div>
                          </div>
                          {isUmpire && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => { setCorrectionForm({ ...d, extra: d.extraType, targetInning: tab.innKey }); setIsCorrectionDialogOpen(true); }} className="h-7 w-7 text-slate-300 hover:text-primary"><Edit2 className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="icon" onClick={async () => { if(confirm("Delete delivery? Score and simulation will recalculate.")) { await deleteDoc(doc(db, 'matches', matchId, 'innings', tab.innKey, 'deliveryRecords', d.id)); recalculateInningState(tab.innKey); } }} className="h-7 w-7 text-slate-300 hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          )}
                        </Card>
                      </div>
                    );
                  })}
                  {isUmpire && tab.deliveries && tab.deliveries.length > 0 && (
                    <div className="flex justify-center py-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const targetInn = tab.innKey;
                        const lastBall = tab.deliveries![tab.deliveries!.length - 1];
                        setCorrectionForm({ id: '', strikerId: lastBall.strikerPlayerId, nonStrikerId: lastBall.nonStrikerPlayerId, bowlerId: lastBall.bowlerId, runs: 0, extra: 'none', isWicket: false, targetTimestamp: lastBall.timestamp + 1000, targetInning: targetInn });
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

      {/* Manual Correction Dialog */}
      <Dialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[151]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl text-amber-600">Manual Ball Correction</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400">Correct details for a specific delivery</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Striker</Label>
                <Select value={correctionForm.strikerId} onValueChange={(v) => setCorrectionForm({...correctionForm, strikerId: v})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {allPlayers?.filter(p => (match?.team1Id === (correctionForm.targetInning === 'inning_1' ? match?.team1Id : match?.team2Id) || match?.team2Id === (correctionForm.targetInning === 'inning_1' ? match?.team1Id : match?.team2Id)) ).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Bowler</Label>
                <Select value={correctionForm.bowlerId} onValueChange={(v) => setCorrectionForm({...correctionForm, bowlerId: v})}>
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
                <Select value={correctionForm.runs.toString()} onValueChange={(v) => setCorrectionForm({...correctionForm, runs: parseInt(v)})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">{[0,1,2,3,4,6].map(r => <SelectItem key={r} value={r.toString()}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Extra</Label>
                <Select value={correctionForm.extra} onValueChange={(v) => setCorrectionForm({...correctionForm, extra: v})}>
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
                  <Select value={correctionForm.wicketType} onValueChange={(v) => setCorrectionForm({...correctionForm, wicketType: v})}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[200]"><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumped">Stumped</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase">Batter Out</Label>
                  <Select value={correctionForm.batterOutId || correctionForm.strikerId} onValueChange={(v) => setCorrectionForm({...correctionForm, batterOutId: v})}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[200]"><SelectItem value={correctionForm.strikerId}>Striker</SelectItem><SelectItem value={correctionForm.nonStrikerId || 'ns'}>Non-Striker</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleManualCorrection} className="w-full h-14 bg-amber-600 font-black uppercase shadow-xl">Apply Correction & Re-Simulate</Button></DialogFooter>
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
              <Select value={assignmentForm.strikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Striker" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== assignmentForm.nonStrikerId && p.id !== activeInningData?.currentBowlerPlayerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-900 ml-1">NON-STRIKER</Label>
              <Select value={assignmentForm.nonStrikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Non-Striker" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== assignmentForm.strikerId && p.id !== activeInningData?.currentBowlerPlayerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-black uppercase text-slate-900 ml-1">BOWLER</Label>
                {activeInningData?.ballsInCurrentOver !== 0 && activeInningData?.ballsInCurrentOver !== undefined && <Badge variant="outline" className="text-[8px] font-black border-amber-500 text-amber-600 bg-amber-50 uppercase">Over in Progress</Badge>}
              </div>
              <Select value={assignmentForm.bowlerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}>
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
              <Select value={wicketForm.batterOutId} onValueChange={(v) => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue placeholder="Select Batter" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)} (Striker)</SelectItem>}
                  {activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)} (Non-Striker)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Dismissal Type</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v, runsCompleted: 0, fielderId: 'none'})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]"><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumped">Stumped</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
              </Select>
            </div>
            {['caught', 'runout', 'stumped'].includes(wicketForm.type) && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label className="text-[10px] font-black uppercase text-slate-400">{wicketForm.type === 'runout' ? 'Effected By' : 'Fielder'}</Label>
                <Select value={wicketForm.fielderId} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}>
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
                <Select value={wicketForm.runsCompleted.toString()} onValueChange={(v) => setWicketForm({...wicketForm, runsCompleted: parseInt(v)})}>
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
                id: dId, overLabel: formatOverNotation(totalLegal), strikerPlayerId: activeInningData?.strikerPlayerId, nonStrikerPlayerId: activeInningData?.nonStrikerPlayerId, bowlerId: activeInningData?.currentBowlerPlayerId, fielderPlayerId: wicketForm.fielderId, isWicket: true, dismissalType: wicketForm.type, batsmanOutPlayerId: wicketForm.batterOutId, extraType: 'none', runsScored: wicketForm.runsCompleted, totalRunsOnDelivery: wicketForm.runsCompleted, timestamp: Date.now() 
              }, { merge: true });
              updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currId), { 
                score: activeInningData!.score + wicketForm.runsCompleted, wickets: activeInningData!.wickets + (wicketForm.type === 'retired' ? 0 : 1), oversCompleted: Math.floor(totalLegal / 6), ballsInCurrentOver: totalLegal % 6, [wicketForm.batterOutId === activeInningData?.strikerPlayerId ? 'strikerPlayerId' : 'nonStrikerPlayerId']: '' 
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
