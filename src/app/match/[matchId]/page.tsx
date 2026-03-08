
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, History, Loader2, Zap, PlayCircle, ArrowLeftRight, RefreshCw, Swords, Target, Activity, Info, TrendingUp, Trash2, ChevronLeft, Calendar, Clock, UserCheck, ShieldCheck, List, CheckCircle2, MoreVertical, UserPlus, AlertCircle, Settings2, Rewind, RotateCcw, Download, Share2, Check, ChevronRight } from 'lucide-react';
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
  const [assignmentForm, setAssignmentForm] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });
  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', extraType: 'none', runsCompleted: 0 });

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
    currentDeliveries.forEach(d => {
      const parts = d.overLabel.split('.');
      const completed = parseInt(parts[0]);
      const current = parseInt(parts[1]);
      const overNum = current === 0 ? completed : completed + 1;
      if (!groups[overNum]) groups[overNum] = [];
      groups[overNum].push(d);
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
      
      const overRuns1 = (inn1Deliveries || [])
        .filter(d => {
          const parts = d.overLabel.split('.');
          const comp = parseInt(parts[0]);
          const curr = parseInt(parts[1]);
          const o = curr === 0 ? comp : comp + 1;
          return o === i;
        })
        .reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
      point.inn1 = overRuns1;

      const overRuns2 = (inn2Deliveries || [])
        .filter(d => {
          const parts = d.overLabel.split('.');
          const comp = parseInt(parts[0]);
          const curr = parseInt(parts[1]);
          const o = curr === 0 ? comp : comp + 1;
          return o === i;
        })
        .reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
      point.inn2 = overRuns2;

      data.push(point);
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries, match]);

  const handleDownloadReport = () => {
    if (!match || !allTeams || !allPlayers) return;
    const teamMap: Record<string, string> = {};
    allTeams.forEach(t => teamMap[t.id] = t.name);
    const playerMap: Record<string, string> = {};
    allPlayers.forEach(p => playerMap[p.id] = p.name);
    const reportHtml = generateMatchReport(match, teamMap, playerMap, inn1, inn2, stats1, stats2);
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `CricMates_ProReport_${matchId.substring(0,6)}.html`; a.click();
    toast({ title: "Report Downloaded" });
  };

  const handleShareSummary = () => {
    if (!match) return;
    const summary = `CricMates Pro League\n${getTeamName(match.team1Id)} vs ${getTeamName(match.team2Id)}\nResult: ${match.resultDescription}\nScoreboard: ${window.location.href}`;
    navigator.clipboard.writeText(summary);
    toast({ title: "Broadcast Summary Copied" });
  };

  const recalculateInningState = async (inningId: string) => {
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveriesList = snap.docs.map(d => d.data());
    let score = 0, wkts = 0, legal = 0;
    deliveriesList.forEach(d => { 
      score += d.totalRunsOnDelivery; 
      if (d.isWicket && d.dismissalType !== 'retired') wkts++; 
      if (d.extraType === 'none') legal++; 
    });
    
    const isActuallyFinished = (legal >= (match?.totalOvers || 6) * 6) || (wkts >= 10);
    const updates = { 
      score, wickets: wkts, oversCompleted: Math.floor(legal / 6), ballsInCurrentOver: legal % 6,
      isDeclaredFinished: isActuallyFinished
    };
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates);
  };

  const handleHardReset = async () => {
    if (!isUmpire || !match) return;
    if (!confirm("DANGER: This will delete ALL delivery records for the current innings and reset the score to 0. Continue?")) return;
    
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords');
    const snap = await getDocs(deliveriesRef);
    
    toast({ title: "Performing Hard Reset..." });
    
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }

    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), {
      score: 0,
      wickets: 0,
      oversCompleted: 0,
      ballsInCurrentOver: 0,
      isDeclaredFinished: false,
      strikerPlayerId: '',
      nonStrikerPlayerId: '',
      currentBowlerPlayerId: ''
    });

    toast({ title: "Innings Reset Complete", description: "Scoreboard cleared." });
    setIsPlayerAssignmentOpen(true);
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

  const handleEndInnings = async () => {
    if (!match) return;
    if (match.currentInningNumber === 1) {
      updateDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: 2 });
      const inn2BatId = match.team1Id === inn1?.battingTeamId ? match.team2Id : match.team1Id;
      await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), { id: 'inning_2', battingTeamId: inn2BatId, score: 0, wickets: 0, oversCompleted: 0, ballsInCurrentOver: 0, isDeclaredFinished: false }, { merge: true });
      setIsPlayerAssignmentOpen(true);
    } else {
      let resDesc = "Match Tied";
      if (inn1!.score > inn2!.score) resDesc = `${getTeamName(inn1?.battingTeamId)} won by ${inn1!.score - inn2!.score} runs`;
      else if (inn2!.score > inn1!.score) resDesc = `${getTeamName(inn2?.battingTeamId)} won by ${10 - (inn2?.wickets || 0)} wickets`;
      updateDocumentNonBlocking(doc(db, 'matches', matchId), { status: 'completed', resultDescription: resDesc });
    }
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
        {stats.didNotBat.length > 0 && (
          <div className="p-4 border-t bg-white">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Did not Bat</p>
            <div className="flex flex-wrap gap-2">
              {stats.didNotBat.map((id: string) => (
                <Link key={id} href={`/players/${id}`} className="text-[10px] font-black text-blue-600 hover:underline uppercase">{getPlayerName(id)}</Link>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="border-none shadow-xl overflow-hidden rounded-2xl bg-white">
        <div className="p-3 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest">Bowling Analysis</div>
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase">Bowler</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">O</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">M</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">R</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">W</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">ER</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.bowling.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-black text-xs uppercase">{getPlayerName(b.id)}</TableCell>
                <TableCell className="text-right text-xs">{b.oversDisplay}</TableCell>
                <TableCell className="text-right text-xs">{b.maidens || 0}</TableCell>
                <TableCell className="text-right text-xs">{b.runs}</TableCell>
                <TableCell className="text-right font-black text-secondary">{b.wickets}</TableCell>
                <TableCell className="text-right text-[10px] text-slate-400 font-bold">{b.economy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-lg rounded-2xl bg-white p-4">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Fall of Wickets</h4>
          <div className="space-y-2">
            {stats.fow.map((f: any) => (
              <div key={f.wicketNum} className="flex justify-between text-[10px] font-bold border-b pb-1">
                <span className="text-slate-900">{f.wicketNum}-{f.scoreAtWicket} <span className="text-slate-400 font-normal">({getPlayerName(f.playerOutId)})</span></span>
                <span className="text-slate-400">{f.over} ov</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="border-none shadow-lg rounded-2xl bg-white p-4">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Key Partnerships</h4>
          <div className="space-y-2">
            {stats.partnerships.map((p: any, i: number) => (
              <div key={i} className="flex justify-between text-[10px] font-bold border-b pb-1">
                <span className="text-slate-900 truncate max-w-[150px]">{p.batters.map((id: string) => getPlayerName(id).split(' ')[0]).join(' - ')}</span>
                <span className="text-primary">{p.runs} <span className="text-[8px] opacity-50">Runs</span></span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const CustomWormDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props;
    const isWicket = dataKey === 'inn1' ? (payload.w1 > (chartData[payload.over - 1]?.w1 || 0)) : (payload.w2 > (chartData[payload.over - 1]?.w2 || 0));
    if (isWicket) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={6} fill="red" stroke="white" strokeWidth={2} />
          <text x={cx} y={cy + 3} textAnchor="middle" fill="white" fontSize="8px" fontWeight="black">W</text>
        </g>
      );
    }
    return <circle cx={cx} cy={cy} r={2} fill={props.stroke} />;
  };

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 relative px-1">
      {/* Broadcast Strip */}
      <div className="fixed top-16 left-0 right-0 z-[90] bg-slate-950 text-white shadow-2xl px-6 py-4 border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="text-white hover:bg-white/10 h-8 w-8 shrink-0"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3">
              <Link href={`/teams/${match?.team1Id}`} className="font-black uppercase text-[10px] text-slate-400 truncate max-w-[80px] hover:text-white">{getTeamName(match?.team1Id)}</Link>
              <span className={cn("font-black text-xl", match?.currentInningNumber === 1 ? "text-primary" : "text-slate-500")}>{inn1?.score || 0}/{inn1?.wickets || 0}</span>
              <Badge variant="outline" className="text-[8px] font-black border-white/10 h-4 text-slate-400">({inn1?.oversCompleted || 0}.{inn1?.ballsInCurrentOver || 0})</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/teams/${match?.team2Id}`} className="font-black uppercase text-[10px] text-slate-400 truncate max-w-[80px] hover:text-white">{getTeamName(match?.team2Id)}</Link>
              <span className={cn("font-black text-xl", match?.currentInningNumber === 2 ? "text-secondary" : "text-slate-500")}>{inn2?.score || 0}/{inn2?.wickets || 0}</span>
              <Badge variant="outline" className="text-[8px] font-black border-white/10 h-4 text-slate-400">({inn2?.oversCompleted || 0}.{inn2?.ballsInCurrentOver || 0})</Badge>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            {match?.status === 'live' && <Badge variant="destructive" className="animate-pulse text-[8px] h-4 font-black uppercase">LIVE</Badge>}
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
            {match?.status === 'completed' && (
              <Card className="bg-slate-900 border-none rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
                <div className="p-6 text-center space-y-6">
                  <div className="bg-emerald-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-lg"><Trophy className="w-8 h-8 text-white" /></div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Official Summary</h2>
                    <p className="text-emerald-400 font-black uppercase text-xs tracking-widest">{match.resultDescription}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={handleDownloadReport} className="h-14 font-black uppercase tracking-widest text-[10px] bg-white text-slate-900 shadow-xl"><Download className="w-4 h-4 mr-2" /> Report</Button>
                    <Button onClick={handleShareSummary} variant="outline" className="h-14 font-black uppercase tracking-widest text-[10px] border-white/20 text-white bg-white/5"><Share2 className="w-4 h-4 mr-2" /> Share</Button>
                  </div>
                  {isUmpire && <Button onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId), { status: 'live' })} variant="ghost" className="text-[10px] font-black uppercase text-amber-500 w-full"><RotateCcw className="w-4 h-4 mr-2" /> Re-open for Scoring</Button>}
                </div>
              </Card>
            )}

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
                        <DropdownMenuItem className="font-bold py-3" onClick={() => recalculateInningState(`inning_${match?.currentInningNumber}`)}><RefreshCw className="w-4 h-4 mr-2" /> Force Sync Records</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="font-bold py-3 text-red-500" onClick={handleHardReset}><RotateCcw className="w-4 h-4 mr-2" /> Hard Reset Innings</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={() => setIsPlayerAssignmentOpen(true)} className="flex-1 h-12 border-secondary/20 text-secondary font-black uppercase text-[9px] bg-white/5"><Settings2 className="w-4 h-4 mr-2" /> Assign</Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3, 4, 6].map(r => (
                      <Button key={r} disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl", r >= 4 ? "bg-primary text-white" : "bg-white/5 text-white")}>{r || '•'}</Button>
                    ))}
                    <Button onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { strikerPlayerId: activeInningData?.nonStrikerPlayerId, nonStrikerPlayerId: activeInningData?.strikerPlayerId })} className="bg-secondary text-white h-14 font-black rounded-2xl"><ArrowLeftRight className="w-5 h-5"/></Button>
                    <Button variant="outline" onClick={() => { setWicketForm({...wicketForm, batterOutId: activeInningData?.strikerPlayerId || ''}); setIsWicketDialogOpen(true); }} className="h-14 border-red-500/30 text-red-500 font-black rounded-2xl uppercase text-[10px]">Wicket</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px]">Wide</Button>
                    <Button variant="outline" onClick={() => setIsNoBallDialogOpen(true)} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px]">No Ball</Button>
                    <Button variant="outline" onClick={async () => { 
                      const currId = `inning_${match?.currentInningNumber}`;
                      const snap = await getDocs(query(collection(db, 'matches', matchId, 'innings', currId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1)));
                      if(!snap.empty) { deleteDocumentNonBlocking(snap.docs[0].ref); recalculateInningState(currId); }
                    }} className="h-12 border-white/10 text-slate-400 uppercase font-black text-[9px]">Undo</Button>
                  </div>
                </CardContent>
              </Card>
            ) : isUmpire && match?.status === 'live' && (
              <Button onClick={handleEndInnings} className="w-full h-20 bg-emerald-600 text-white font-black text-xl uppercase rounded-3xl shadow-2xl">
                {match?.currentInningNumber === 1 ? "Finish 1st Innings" : "Finish Match"}
              </Button>
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
                      <TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[activeInningData?.strikerPlayerId, activeInningData?.nonStrikerPlayerId].map((pid, idx) => {
                      if (!pid || pid === 'none' || pid === '') return null;
                      const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
                      const b = stats.batting.find((p: any) => p?.id === pid) || { runs: 0, balls: 0 };
                      return (
                        <TableRow key={pid} className={idx === 0 ? "bg-primary/5" : ""}>
                          <TableCell className="font-black text-xs uppercase truncate max-w-[100px]">
                            <Link href={`/players/${pid}`} className="hover:text-primary transition-colors">
                              {getPlayerName(pid)}{idx === 0 ? '*' : ''}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-black">{b.runs}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-slate-500">{b.balls}</TableCell>
                          <TableCell className="text-right text-[9px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* Over-wise Ball History */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Recent Over History
                </h3>
                {groupedByOver.length > 0 ? groupedByOver.map(([overIdx, deliveries]) => (
                  <Card key={overIdx} className="border-none shadow-sm bg-white p-3 flex items-center justify-between rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="bg-slate-900 text-white text-[10px] font-black h-8 w-8 rounded-lg flex items-center justify-center shrink-0">
                        OV {overIdx}
                      </div>
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

                          return (
                            <div key={d.id} className={cn("min-w-[24px] h-6 px-1.5 rounded flex items-center justify-center text-[10px] font-black whitespace-nowrap", color)}>
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2 border-l pl-3">
                      <p className="text-[10px] font-black text-slate-900">{deliveries.reduce((acc, d) => acc + d.totalRunsOnDelivery, 0)} R</p>
                    </div>
                  </Card>
                )) : (
                  <div className="text-center py-8 border-2 border-dashed rounded-2xl bg-slate-50/50">
                    <p className="text-[10px] font-black uppercase text-slate-300">Awaiting first delivery</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scorecard" className="space-y-6">
            <Tabs defaultValue="inn1" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-10 bg-slate-50 p-1 rounded-xl">
                <TabsTrigger value="inn1" className="text-[9px] font-black uppercase">1st Innings</TabsTrigger>
                <TabsTrigger value="inn2" className="text-[9px] font-black uppercase" disabled={!inn2}>2nd Innings</TabsTrigger>
              </TabsList>
              <TabsContent value="inn1"><InningScorecard stats={stats1} teamId={inn1?.battingTeamId} /></TabsContent>
              <TabsContent value="inn2">{inn2 && <InningScorecard stats={stats2} teamId={inn2?.battingTeamId} />}</TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Unified Worm Chart</h3>
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="over" tick={{ fontSize: 10, fontWeight: 'bold' }} label={{ value: 'Overs', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 'black' }} />
                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="inn1" stroke="hsl(var(--primary))" strokeWidth={3} dot={<CustomWormDot />} />
                    <Line type="monotone" dataKey="inn2" stroke="hsl(var(--secondary))" strokeWidth={3} dot={<CustomWormDot />} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Card>

            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><Activity className="w-4 h-4 text-secondary" /> Manhattan Over-by-Over</h3>
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={manhattanData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="over" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="inn1" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="inn2" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Card>
          </TabsContent>

          <TabsContent value="overs" className="space-y-4">
            <h2 className="text-lg font-black uppercase text-slate-900 px-2 flex items-center gap-2"><List className="w-5 h-5 text-primary" /> Delivery Log</h2>
            <div className="space-y-3">
              {(match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries)?.slice().reverse().map((d, i) => (
                <Card key={d.id} className="border-none shadow-sm bg-white p-4 flex items-center justify-between rounded-2xl group">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-inner", d.isWicket ? "bg-red-500 text-white border-red-600" : "bg-slate-50 text-slate-900 border-slate-100")}>
                      {d.isWicket ? "W" : d.totalRunsOnDelivery}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400">Over {d.overLabel}</p>
                      <p className="text-xs font-bold text-slate-900 truncate max-w-[150px]">{getPlayerName(d.strikerPlayerId)} vs {getPlayerName(d.bowlerId)}</p>
                    </div>
                  </div>
                  {isUmpire && (
                    <Button variant="ghost" size="icon" onClick={() => { if(confirm("Delete delivery? Score will recalculate.")) { deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`, 'deliveryRecords', d.id)); recalculateInningState(`inning_${match?.currentInningNumber}`); } }} className="h-8 w-8 text-slate-200 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></Button>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl bg-white z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl">Official Assignment</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-900 ml-1">STRIKER</Label>
              <Select value={assignmentForm.strikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Striker" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-900 ml-1">NON-STRIKER</Label>
              <Select value={assignmentForm.nonStrikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Non-Striker" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== assignmentForm.strikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-900 ml-1">BOWLER</Label>
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
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl text-destructive">Register Wicket</DialogTitle></DialogHeader>
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
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v, runsCompleted: 0})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="bowled">Bowled</SelectItem>
                  <SelectItem value="caught">Caught</SelectItem>
                  <SelectItem value="runout">Run Out</SelectItem>
                  <SelectItem value="stumped">Stumped</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {wicketForm.type === 'runout' && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label className="text-[10px] font-black uppercase text-slate-400">Runs Completed?</Label>
                <Select value={wicketForm.runsCompleted.toString()} onValueChange={(v) => setWicketForm({...wicketForm, runsCompleted: parseInt(v)})}>
                  <SelectTrigger className="h-14 font-black border-2 rounded-xl border-amber-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {[0, 1, 2, 3].map(r => <SelectItem key={r} value={r.toString()}>{r} Runs</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={async () => {
              if (!wicketForm.batterOutId) return;
              const currId = `inning_${match?.currentInningNumber}`;
              const totalLegal = (currentDeliveries?.filter(d => d.extraType === 'none').length || 0) + 1;
              const dId = doc(collection(db, 'temp')).id;
              
              await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currId, 'deliveryRecords', dId), { 
                id: dId, 
                overLabel: formatOverNotation(totalLegal), 
                strikerPlayerId: activeInningData?.strikerPlayerId, 
                nonStrikerPlayerId: activeInningData?.nonStrikerPlayerId,
                bowlerId: activeInningData?.currentBowlerPlayerId, 
                isWicket: true, 
                dismissalType: wicketForm.type, 
                batsmanOutPlayerId: wicketForm.batterOutId, 
                extraType: 'none', 
                runsScored: wicketForm.runsCompleted,
                totalRunsOnDelivery: wicketForm.runsCompleted, 
                timestamp: Date.now() 
              }, { merge: true });

              updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currId), { 
                score: activeInningData!.score + wicketForm.runsCompleted,
                wickets: activeInningData!.wickets + (wicketForm.type === 'retired' ? 0 : 1), 
                oversCompleted: Math.floor(totalLegal / 6), 
                ballsInCurrentOver: totalLegal % 6, 
                [wicketForm.batterOutId === activeInningData?.strikerPlayerId ? 'strikerPlayerId' : 'nonStrikerPlayerId']: '' 
              });
              
              setIsWicketDialogOpen(false);
              setIsPlayerAssignmentOpen(true);
            }} disabled={!wicketForm.batterOutId} className="w-full h-16 bg-destructive text-white font-black uppercase rounded-2xl shadow-xl">Confirm Wicket</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoBallDialogOpen} onOpenChange={setIsNoBallDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[151]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-xl text-amber-600">No Ball Result</DialogTitle>
            <DialogDescription className="font-bold uppercase text-[10px]">How many runs were taken off the bat?</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {[0, 1, 2, 3, 4, 6].map(r => (
              <Button key={r} onClick={() => handleRecordBall(r, 'noball')} variant="outline" className="h-16 font-black text-2xl border-amber-200">
                {r || '•'}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
