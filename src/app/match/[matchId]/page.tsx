
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, History, Loader2, Zap, PlayCircle, ArrowLeftRight, RefreshCw, Swords, Target, Activity, Info, TrendingUp, Trash2, ChevronLeft, Calendar, Clock, UserCheck, ShieldCheck, List, CheckCircle2, MoreVertical, UserPlus, AlertCircle, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';

const chartConfig = {
  score: { label: "Runs", color: "hsl(var(--primary))" },
  runs: { label: "Over Runs", color: "hsl(var(--secondary))" }
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
  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', extraType: 'none' });

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

  const currentDeliveries = match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;
  const currentStats = match?.currentInningNumber === 1 ? stats1 : stats2;

  const getPlayerName = (pid: string) => allPlayers?.find(p => p.id === pid)?.name || '---';
  const getTeamName = (tid: string) => allTeams?.find(t => t.id === tid)?.name || '---';

  const formatOverNotation = (totalLegalBalls: number) => {
    if (totalLegalBalls <= 0) return "0.0";
    const completedOvers = Math.floor(totalLegalBalls / 6);
    const ballsInCurrentOver = totalLegalBalls % 6;
    if (ballsInCurrentOver === 0 && completedOvers > 0) return `${completedOvers} Over${completedOvers > 1 ? 's' : ''}`;
    return `${completedOvers}.${ballsInCurrentOver}`;
  };

  const formatBallLabel = (legalBallIndex: number) => {
    const completed = Math.floor((legalBallIndex - 1) / 6);
    const ballNum = ((legalBallIndex - 1) % 6) + 1;
    return `${completed}.${ballNum}`;
  };

  const recalculateInningState = async (inningId: string) => {
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveries = snap.docs.map(d => d.data());
    let score = 0, wkts = 0, legal = 0;
    deliveries.forEach(d => { 
      score += d.totalRunsOnDelivery; 
      if (d.isWicket && d.dismissalType !== 'retired') wkts++; 
      if (['none', 'bye', 'legbye'].includes(d.extraType)) legal++; 
    });
    
    let isFinished = (legal >= (match?.totalOvers || 0) * 6) || (wkts >= 10 && !activeInningData?.isLastManActive);
    
    // Chasing detection during recalculation
    if (inningId === 'inning_2' && inn1 && score > inn1.score) {
      isFinished = true;
    }

    const updates: any = { 
      score: Math.max(0, score), wickets: Math.max(0, wkts), 
      oversCompleted: Math.floor(legal / 6), ballsInCurrentOver: legal % 6,
      isDeclaredFinished: isFinished
    };
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates);
    toast({ title: "Scoreboard Synced", description: "Records recalculated from ball-by-ball logs." });
  };

  const handleRecordBall = async (runs: number, extra: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) {
      if (!activeInningData?.currentBowlerPlayerId && isUmpire) {
        setAssignmentForm({
          strikerId: activeInningData?.strikerPlayerId || '',
          nonStrikerId: activeInningData?.nonStrikerPlayerId || '',
          bowlerId: ''
        });
        setIsPlayerAssignmentOpen(true);
      }
      return;
    }
    const currentInningId = `inning_${match.currentInningNumber}`;
    const isLegal = ['none', 'bye', 'legbye'].includes(extra);
    const totalLegalCount = (currentDeliveries?.filter(d => ['none', 'bye', 'legbye'].includes(d.extraType)).length || 0);
    const newTotalLegal = totalLegalCount + (isLegal ? 1 : 0);
    
    if (isLegal && newTotalLegal > match.totalOvers * 6) return;

    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = { 
      id: deliveryId, 
      overLabel: formatBallLabel(newTotalLegal), 
      strikerPlayerId: activeInningData.strikerPlayerId, 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', 
      bowlerId: activeInningData.currentBowlerPlayerId, 
      runsScored: extra === 'none' || extra === 'noball' ? runs : 0, 
      extraRuns: extra !== 'none' ? (extra === 'noball' ? 1 : runs + 1) : 0, 
      extraType: extra, 
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0), 
      isWicket: false, 
      timestamp: Date.now() 
    };
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData, { merge: true });

    let nextS = activeInningData.strikerPlayerId, nextNS = activeInningData.nonStrikerPlayerId;
    const totalRunsThisBall = dData.totalRunsOnDelivery;
    
    if (totalRunsThisBall % 2 !== 0) [nextS, nextNS] = [nextNS, nextS];
    if (newTotalLegal % 6 === 0 && isLegal) [nextS, nextNS] = [nextNS, nextS];

    const updates: any = { 
      score: activeInningData.score + dData.totalRunsOnDelivery, 
      oversCompleted: Math.floor(newTotalLegal / 6), 
      ballsInCurrentOver: newTotalLegal % 6, 
      strikerPlayerId: nextS, 
      nonStrikerPlayerId: nextNS 
    };
    if (newTotalLegal % 6 === 0 && isLegal) updates.currentBowlerPlayerId = '';
    if (newTotalLegal >= match.totalOvers * 6) updates.isDeclaredFinished = true;
    
    // Winning run detection
    if (match.currentInningNumber === 2 && inn1 && updates.score > inn1.score) {
      updates.isDeclaredFinished = true;
    }

    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsNoBallDialogOpen(false);
  };

  const handleEndInnings = async () => {
    if (!match) return;
    if (match.currentInningNumber === 1) {
      updateDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: 2 });
      const inn2BattingTeamId = match.team1Id === inn1?.battingTeamId ? match.team2Id : match.team1Id;
      const inn2BowlingTeamId = inn1?.battingTeamId;
      
      const inning2Data = {
        id: 'inning_2',
        matchId: matchId,
        inningNumber: 2,
        battingTeamId: inn2BattingTeamId,
        bowlingTeamId: inn2BowlingTeamId,
        score: 0,
        wickets: 0,
        oversCompleted: 0,
        ballsInCurrentOver: 0,
        strikerPlayerId: '',
        nonStrikerPlayerId: '',
        currentBowlerPlayerId: '',
        isDeclaredFinished: false,
        isLastManActive: false
      };
      await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), inning2Data, { merge: true });
      setAssignmentForm({ strikerId: '', nonStrikerId: '', bowlerId: '' });
      setIsPlayerAssignmentOpen(true);
      toast({ title: "1st Innings Finished", description: "Configure 2nd Innings openers." });
    } else {
      // Calculate final result with margin
      const t1Name = getTeamName(inn1?.battingTeamId);
      const t2Name = getTeamName(inn2?.battingTeamId);
      let resDesc = "Match Tied";
      
      if (inn1!.score > inn2!.score) {
        const margin = inn1!.score - inn2!.score;
        resDesc = `${t1Name} won by ${margin} run${margin !== 1 ? 's' : ''}`;
      } else if (inn2!.score > inn1!.score) {
        const wktsRemaining = 10 - (inn2?.wickets || 0);
        resDesc = `${t2Name} won by ${wktsRemaining} wicket${wktsRemaining !== 1 ? 's' : ''}`;
      }
      
      updateDocumentNonBlocking(doc(db, 'matches', matchId), { 
        status: 'completed', 
        resultDescription: resDesc 
      });
      toast({ title: "Match Finished", description: resDesc });
      router.push('/matches');
    }
  };

  const getWormData = (deliveries: any[]) => {
    const data: any[] = [{ over: 0, score: 0, isWicket: false }];
    let runningScore = 0; let currentLegal = 0;
    deliveries?.forEach(d => {
      runningScore += d.totalRunsOnDelivery;
      if (['none', 'bye', 'legbye'].includes(d.extraType)) {
        currentLegal++;
      }
      data.push({ 
        over: currentLegal / 6, 
        score: runningScore, 
        isWicket: d.isWicket,
        ballLabel: d.overLabel
      });
    });
    return data;
  };

  const getManhattanData = (deliveries: any[]) => {
    const overRuns: Record<number, number> = {};
    let currentLegal = 0;
    deliveries?.forEach(d => {
      const overNum = Math.floor(currentLegal / 6) + 1;
      overRuns[overNum] = (overRuns[overNum] || 0) + d.totalRunsOnDelivery;
      if (['none', 'bye', 'legbye'].includes(d.extraType)) {
        currentLegal++;
      }
    });
    return Object.entries(overRuns).map(([over, runs]) => ({ over: `O${over}`, runs }));
  };

  const renderWicketDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.isWicket) {
      return (
        <g key={`w-dot-${payload.over}-${payload.score}`}>
          <circle cx={cx} cy={cy} r={10} fill="#ef4444" stroke="#fff" strokeWidth={2} />
          <text x={cx} y={cy} dy={3.5} textAnchor="middle" fill="#fff" fontSize="10px" fontWeight="900">W</text>
        </g>
      );
    }
    return null;
  };

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  const InningScorecard = ({ inning, stats, title }: { inning: any, stats: any, title: string }) => (
    <div className="space-y-6 pb-20">
      <Card className="border-none shadow-xl overflow-hidden bg-white rounded-3xl">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
          <Badge className="bg-primary text-white font-black text-[10px] uppercase h-6 hover:bg-primary/80 transition-colors">
            <Link href={`/teams/${inning?.battingTeamId}`}>{getTeamName(inning?.battingTeamId)}</Link>
          </Badge>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader className="bg-slate-50/50">
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
              {stats?.batting?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="py-3">
                    <Link href={`/players/${b.id}`} className="font-black text-xs uppercase truncate max-w-[120px] hover:text-primary transition-colors block">{getPlayerName(b.id)}</Link>
                    <p className={cn("text-[8px] font-bold uppercase italic", b.out ? "text-red-500" : "text-slate-400")}>
                      {b.out ? `Out: ${b.dismissal}` : 'Not Out'}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-black text-sm">{b.runs}</TableCell>
                  <TableCell className="text-right text-xs text-slate-500 font-bold">{b.balls}</TableCell>
                  <TableCell className="text-right text-xs text-slate-500">{b.fours}</TableCell>
                  <TableCell className="text-right text-xs text-slate-500">{b.sixes}</TableCell>
                  <TableCell className="text-right text-[10px] font-black text-slate-400">
                    {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="border-none shadow-xl overflow-hidden bg-white rounded-3xl">
        <div className="p-4 bg-slate-100 flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black uppercase text-slate-500">Bowling History</span>
        </div>
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
            {stats?.bowling?.map((bw: any) => (
              <TableRow key={bw.id}>
                <TableCell className="font-black text-xs uppercase">
                  <Link href={`/players/${bw.id}`} className="hover:text-primary transition-colors">{getPlayerName(bw.id)}</Link>
                </TableCell>
                <TableCell className="text-right font-bold text-xs">{bw.oversDisplay}</TableCell>
                <TableCell className="text-right text-xs">{bw.maidens}</TableCell>
                <TableCell className="text-right font-black text-xs">{bw.runs}</TableCell>
                <TableCell className="text-right font-black text-xs text-secondary">{bw.wickets}</TableCell>
                <TableCell className="text-right text-[10px] font-bold text-slate-400">{bw.economy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {stats?.fow?.length > 0 && (
        <Card className="border-none shadow-sm p-4 bg-slate-50 rounded-2xl">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Fall of Wickets</h4>
          <div className="flex flex-wrap gap-2">
            {stats.fow.map((f: any) => (
              <Badge key={f.wicketNum} variant="outline" className="bg-white border-slate-200 h-10 px-3 flex gap-2 items-center rounded-xl">
                <span className="font-black text-slate-900">{f.wicketNum}-{f.scoreAtWicket}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">({getPlayerName(f.playerOutId).split(' ')[0]})</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {stats?.partnerships?.length > 0 && (
        <Card className="border-none shadow-sm p-4 bg-slate-50 rounded-2xl">
          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Key Partnerships</h4>
          <div className="space-y-2">
            {stats.partnerships.map((p: any, i: number) => (
              <div key={i} className="flex flex-col bg-white p-3 rounded-xl border border-slate-100 gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase truncate">{getPlayerName(p.batter1Id)} & {getPlayerName(p.batter2Id)}</span>
                  <span className="font-black text-xs text-primary">{p.runs} <span className="text-[8px] text-slate-400">({p.balls}b)</span></span>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t pt-2">
                  <div className="text-[8px] font-bold text-slate-400 uppercase">{getPlayerName(p.batter1Id).split(' ')[0]}: <span className="text-slate-900">{p.batter1Runs}({p.batter1Balls})</span></div>
                  <div className="text-[8px] font-bold text-slate-400 uppercase text-right">{getPlayerName(p.batter2Id).split(' ')[0]}: <span className="text-slate-900">{p.batter2Runs}({p.batter2Balls})</span></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 px-1 relative">
      {/* Broadcast Strip Header */}
      <div className="fixed top-16 left-0 right-0 z-[90] bg-slate-950 text-white shadow-2xl px-6 py-4 border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="text-white hover:bg-white/10 h-8 w-8 shrink-0"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3">
              <Link href={`/teams/${match?.team1Id}`} className="font-black uppercase text-[10px] text-slate-400 truncate max-w-[80px] hover:text-white transition-colors">{getTeamName(match?.team1Id)}</Link>
              <span className={cn("font-black text-xl", match?.currentInningNumber === 1 ? "text-primary" : "text-slate-500")}>{inn1?.score || 0}/{inn1?.wickets || 0}</span>
              <Badge variant="outline" className="text-[8px] font-black border-white/10 h-4 text-slate-400">({formatOverNotation((inn1?.oversCompleted || 0) * 6 + (inn1?.ballsInCurrentOver || 0))})</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/teams/${match?.team2Id}`} className="font-black uppercase text-[10px] text-slate-400 truncate max-w-[80px] hover:text-white transition-colors">{getTeamName(match?.team2Id)}</Link>
              <span className={cn("font-black text-xl", match?.currentInningNumber === 2 ? "text-secondary" : "text-slate-500")}>{inn2?.score || 0}/{inn2?.wickets || 0}</span>
              <Badge variant="outline" className="text-[8px] font-black border-white/10 h-4 text-slate-400">({formatOverNotation((inn2?.oversCompleted || 0) * 6 + (inn2?.ballsInCurrentOver || 0))})</Badge>
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
            {isUmpire && !activeInningData?.isDeclaredFinished && match?.status === 'live' ? (
              <Card className="bg-slate-900 border-none rounded-3xl overflow-hidden shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2 mb-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-1 h-12 border-primary/20 text-primary font-black uppercase text-[9px] bg-white/5">
                          <ShieldCheck className="w-4 h-4 mr-2" /> Match Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 rounded-xl border-t-4 border-t-primary" align="end">
                        <DropdownMenuItem className="font-bold py-3" onClick={() => {
                          if(confirm("Force finish this innings?")) {
                            updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { isDeclaredFinished: true });
                          }
                        }}>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Finish Innings Now
                        </DropdownMenuItem>
                        <DropdownMenuItem className="font-bold py-3" onClick={() => {
                          const currentInningId = `inning_${match?.currentInningNumber}`;
                          updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), { isLastManActive: !activeInningData?.isLastManActive });
                          toast({ title: `Last Man Mode: ${!activeInningData?.isLastManActive ? 'ON' : 'OFF'}` });
                        }}>
                          <UserCheck className="w-4 h-4 mr-2 text-primary" /> {activeInningData?.isLastManActive ? "Disable" : "Enable"} Last Man Standing
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="font-bold py-3" onClick={() => recalculateInningState(`inning_${match?.currentInningNumber}`)}>
                          <RefreshCw className="w-4 h-4 mr-2 text-slate-400" /> Force Sync Records
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setAssignmentForm({
                          strikerId: activeInningData?.strikerPlayerId || '',
                          nonStrikerId: activeInningData?.nonStrikerPlayerId || '',
                          bowlerId: activeInningData?.currentBowlerPlayerId || ''
                        });
                        setIsPlayerAssignmentOpen(true);
                      }}
                      className="flex-1 h-12 border-secondary/20 text-secondary font-black uppercase text-[9px] bg-white/5"
                    >
                      <Settings2 className="w-4 h-4 mr-2" /> Assign
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3, 4, 6].map(r => (
                      <Button key={r} disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl transition-all", r >= 4 ? "bg-primary text-white" : "bg-white/5 text-white")}>{r || '•'}</Button>
                    ))}
                    <Button onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { strikerPlayerId: activeInningData?.nonStrikerPlayerId, nonStrikerPlayerId: activeInningData?.strikerPlayerId })} className="bg-secondary text-white h-14 font-black rounded-2xl flex flex-col items-center justify-center"><ArrowLeftRight className="w-5 h-5"/><span className="text-[8px] uppercase mt-1">Swap</span></Button>
                    <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-14 border-red-500/30 text-red-500 font-black rounded-2xl uppercase text-[10px]">Wicket</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px]">Wide</Button>
                    <Button variant="outline" onClick={() => setIsNoBallDialogOpen(true)} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px]">No Ball</Button>
                    <Button variant="outline" onClick={async () => { 
                      const curr = `inning_${match?.currentInningNumber}`;
                      const s = await getDocs(query(collection(db, 'matches', matchId, 'innings', curr, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1)));
                      if(!s.empty) { deleteDocumentNonBlocking(s.docs[0].ref); recalculateInningState(curr); }
                    }} className="h-12 border-white/10 text-slate-400 uppercase font-black text-[9px]">Undo</Button>
                  </div>
                </CardContent>
              </Card>
            ) : isUmpire && match?.status === 'live' && (
              <Button onClick={handleEndInnings} className="w-full h-20 bg-emerald-600 text-white font-black text-xl uppercase rounded-3xl shadow-2xl border-4 border-white/20 animate-in zoom-in-95">
                {match?.currentInningNumber === 1 ? "Finish 1st Innings" : "Finish Match"}
              </Button>
            )}

            <div className="space-y-4">
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                <div className="p-3 bg-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500">Live Batting</span>
                  <Badge variant="outline" className="text-[8px] font-black uppercase">Legal: {activeInningData?.ballsInCurrentOver || 0}/6</Badge>
                </div>
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
                      const b = currentStats?.batting?.find((p: any) => p.id === pid);
                      if (!pid || pid === 'none') return null;
                      return (
                        <TableRow key={pid} className={idx === 0 ? "bg-primary/5" : ""}>
                          <TableCell className="font-black text-xs uppercase truncate max-w-[100px]">
                            <Link href={`/players/${pid}`} className="hover:text-primary transition-colors">{getPlayerName(pid)}</Link> {idx === 0 ? '*' : ''}
                          </TableCell>
                          <TableCell className="text-right font-black">{b?.runs || 0}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-slate-500">{b?.balls || 0}</TableCell>
                          <TableCell className="text-right text-xs text-slate-400">{b?.fours || 0}</TableCell>
                          <TableCell className="text-right text-xs text-slate-400">{b?.sixes || 0}</TableCell>
                          <TableCell className="text-right text-[9px] font-bold text-slate-400">
                            {b?.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              {activeInningData?.currentBowlerPlayerId && (
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                  <div className="p-3 bg-slate-100 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black uppercase text-slate-500">Live Bowling</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase">Bowler</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase">O</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase">W</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase">ER</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const bw = currentStats?.bowling?.find((p: any) => p.id === activeInningData.currentBowlerPlayerId);
                        return (
                          <TableRow>
                            <TableCell className="font-black text-xs uppercase">
                              <Link href={`/players/${activeInningData.currentBowlerPlayerId}`} className="hover:text-primary transition-colors">{getPlayerName(activeInningData.currentBowlerPlayerId)}</Link>
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs">{bw?.oversDisplay || '0.0'}</TableCell>
                            <TableCell className="text-right font-black">{bw?.runs || 0}</TableCell>
                            <TableCell className="text-right font-black text-secondary">{bw?.wickets || 0}</TableCell>
                            <TableCell className="text-right text-[9px] font-bold text-slate-400">{bw?.economy || '0.00'}</TableCell>
                          </TableRow>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-black uppercase flex items-center gap-2 text-slate-900"><History className="w-5 h-5 text-primary" /> Recent History</h2>
              <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {currentDeliveries?.slice().reverse().slice(0, 12).map(d => (
                  <div key={d.id} className="flex flex-col items-center gap-1 shrink-0">
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center font-black text-sm shadow-sm ring-4 ring-offset-2",
                      d.isWicket ? "bg-red-500 text-white ring-red-500" : 
                      d.runsScored === 6 ? "bg-purple-600 text-white ring-purple-600" :
                      d.runsScored === 4 ? "bg-emerald-500 text-white ring-emerald-500" : 
                      "bg-white text-slate-600 ring-slate-100"
                    )}>
                      {d.isWicket ? "W" : d.totalRunsOnDelivery}
                    </div>
                    <span className="text-[8px] font-black text-slate-400">{d.overLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scorecard" className="space-y-6">
            <Tabs defaultValue="inn1" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-10 bg-slate-50 p-1 rounded-xl">
                <TabsTrigger value="inn1" className="text-[9px] font-black uppercase">1st Innings</TabsTrigger>
                <TabsTrigger value="inn2" className="text-[9px] font-black uppercase" disabled={!inn2}>2nd Innings</TabsTrigger>
              </TabsList>
              <TabsContent value="inn1"><InningScorecard inning={inn1} stats={stats1} title="1st Innings" /></TabsContent>
              <TabsContent value="inn2">{inn2 && <InningScorecard inning={inn2} stats={stats2} title="2nd Innings" />}</TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Worm Chart (Match Flow)</h3>
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getWormData(currentDeliveries || [])}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="over" 
                      type="number"
                      domain={[0, match?.totalOvers || 6]}
                      tick={{ fontSize: 10 }} 
                      label={{ value: 'Overs', position: 'insideBottomRight', offset: -5 }} 
                    />
                    <YAxis tick={{ fontSize: 10 }} label={{ value: 'Runs', angle: -90, position: 'insideLeft' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={4} 
                      dot={renderWicketDot} 
                      activeDot={{ r: 6 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Card>

            <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><Activity className="w-4 h-4 text-secondary" /> Manhattan Graph (Runs Per Over)</h3>
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getManhattanData(currentDeliveries || [])}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="over" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="runs" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Card>
          </TabsContent>

          <TabsContent value="overs" className="space-y-4">
            <Tabs defaultValue="o_inn1" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 h-10 bg-slate-50 p-1 rounded-xl">
                <TabsTrigger value="o_inn1" className="text-[9px] font-black uppercase">1st Innings</TabsTrigger>
                <TabsTrigger value="o_inn2" className="text-[9px] font-black uppercase" disabled={!inn2}>2nd Innings</TabsTrigger>
              </TabsList>
              {[ {id: 'o_inn1', deliveries: inn1Deliveries}, {id: 'o_inn2', deliveries: inn2Deliveries} ].map(inn => (
                <TabsContent key={inn.id} value={inn.id} className="space-y-2 pb-20">
                  {inn.deliveries?.slice().reverse().map(d => (
                    <Card key={d.id} className="border shadow-sm bg-white overflow-hidden rounded-2xl group">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center font-black text-sm",
                            d.isWicket ? "bg-red-500 text-white" : "bg-slate-50 text-slate-600"
                          )}>{d.isWicket ? "W" : d.totalRunsOnDelivery}</div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Over {d.overLabel}</p>
                            <p className="text-xs font-bold text-slate-600 truncate">{getPlayerName(d.strikerPlayerId)} to {getPlayerName(d.bowlerId)}</p>
                          </div>
                        </div>
                        {isUmpire && <Button variant="ghost" size="icon" onClick={() => { 
                          if(confirm("Delete delivery?")) { 
                            const targetInningId = inn.id === 'o_inn1' ? 'inning_1' : 'inning_2';
                            deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', targetInningId, 'deliveryRecords', d.id)); 
                            recalculateInningState(targetInningId); 
                          } 
                        }} className="text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                    </Card>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="info" className="space-y-6">
            <Card className="border-none shadow-xl bg-white rounded-3xl p-6 space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b pb-2 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Match Metadata</h3>
              <div className="grid grid-cols-2 gap-6">
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Format</p><p className="font-black text-slate-900 uppercase">{match?.totalOvers} Overs League</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Toss Result</p><Link href={`/teams/${match?.tossWinnerTeamId}`} className="font-black text-slate-900 uppercase hover:text-primary transition-colors block">{getTeamName(match?.tossWinnerTeamId)}</Link></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Match Date</p><div className="flex items-center gap-1.5 font-bold text-xs"><Calendar className="w-3 h-3"/> {new Date(match?.matchDate || '').toLocaleDateString()}</div></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Entry Timestamp</p><div className="flex items-center gap-1.5 font-bold text-xs"><Clock className="w-3 h-3"/> {new Date(match?.matchDate || '').toLocaleTimeString()}</div></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Umpire</p><div className="flex items-center gap-1.5 font-bold text-xs"><UserCheck className="w-3 h-3"/> {match?.umpireId === 'anonymous' ? 'Official Panel' : `Umpire #${match?.umpireId?.substring(0,4)}`}</div></div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-[0.2em]">Verified Squads</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Link href={`/teams/${match?.team1Id}`} className="font-black text-[10px] text-primary hover:underline">{getTeamName(match?.team1Id)}</Link>
                    {match?.team1SquadPlayerIds?.map((pid: string) => <Link key={pid} href={`/players/${pid}`} className="text-[9px] font-medium text-slate-500 truncate block hover:text-primary">• {getPlayerName(pid)}</Link>)}
                  </div>
                  <div className="space-y-1">
                    <Link href={`/teams/${match?.team2Id}`} className="font-black text-[10px] text-secondary hover:underline">{getTeamName(match?.team2Id)}</Link>
                    {match?.team2SquadPlayerIds?.map((pid: string) => <Link key={pid} href={`/players/${pid}`} className="text-[9px] font-medium text-slate-500 truncate block hover:text-primary">• {getPlayerName(pid)}</Link>)}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl bg-white overflow-hidden p-0 z-[151]">
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto scrollbar-hide">
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-tight text-xl flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-primary" /> Official Assignment
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-8 py-2">
              {/* Batting Section */}
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest border-b pb-2">
                  <UserPlus className="w-4 h-4" /> BATTING PAIR
                </h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-900 ml-1">STRIKER</Label>
                    <Select value={assignmentForm.strikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}>
                      <SelectTrigger className="h-14 font-black bg-slate-50 border-2 rounded-2xl shadow-sm focus:ring-primary">
                        <SelectValue placeholder="Pick Striker" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== assignmentForm.nonStrikerId).map(p => (
                          <SelectItem key={p.id} value={p.id} className="font-black uppercase text-xs">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-900 ml-1">NON-STRIKER</Label>
                    <Select value={assignmentForm.nonStrikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v})}>
                      <SelectTrigger className="h-14 font-black bg-slate-50 border-2 rounded-2xl shadow-sm focus:ring-primary">
                        <SelectValue placeholder="Pick Non-Striker" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== assignmentForm.strikerId).map(p => (
                          <SelectItem key={p.id} value={p.id} className="font-black uppercase text-xs">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Bowling Section */}
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest border-b pb-2">
                  <Target className="w-4 h-4" /> BOWLING ATTACK
                </h4>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-900 ml-1">SELECT BOWLER</Label>
                  <Select value={assignmentForm.bowlerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}>
                    <SelectTrigger className="h-14 font-black bg-slate-50 border-2 rounded-2xl shadow-sm focus:ring-primary">
                      <SelectValue placeholder="Pick Bowler" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {allPlayers?.filter(p => (match?.team1Id === activeInningData?.bowlingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== assignmentForm.strikerId && p.id !== assignmentForm.nonStrikerId).map(p => (
                        <SelectItem key={p.id} value={p.id} className="font-black uppercase text-xs">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full text-[10px] font-black uppercase h-12 rounded-2xl border-dashed border-2 hover:bg-slate-50" 
                onClick={() => recalculateInningState(`inning_${match?.currentInningNumber}`)}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Force Sync Records
              </Button>
            </div>
          </div>
          <div className="p-6 bg-slate-100 border-t">
            <Button 
              onClick={() => { 
                const updates: any = {};
                if (assignmentForm.bowlerId) updates.currentBowlerPlayerId = assignmentForm.bowlerId;
                if (assignmentForm.strikerId) updates.strikerPlayerId = assignmentForm.strikerId;
                if (assignmentForm.nonStrikerId) updates.nonStrikerPlayerId = assignmentForm.nonStrikerId;
                
                if (assignmentForm.strikerId && assignmentForm.nonStrikerId) {
                  updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), updates); 
                  setIsPlayerAssignmentOpen(false); 
                  setAssignmentForm({ strikerId: '', nonStrikerId: '', bowlerId: '' });
                } else {
                  toast({ title: "Selection Missing", description: "Please assign both Striker and Non-Striker.", variant: "destructive" });
                }
              }} 
              className="w-full h-16 bg-primary text-white font-black uppercase rounded-2xl shadow-xl text-lg tracking-widest"
            >
              Confirm Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoBallDialogOpen} onOpenChange={setIsNoBallDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[151]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-xl text-amber-600">No Ball Results</DialogTitle>
            <DialogDescription className="font-bold uppercase text-[10px]">Select runs scored on this illegal delivery (+1 penalty will be added)</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-4">
            {[0, 1, 2, 4, 6].map(r => (
              <Button key={`nb-${r}`} onClick={() => handleRecordBall(r, 'noball')} variant="outline" className="h-16 font-black text-xl border-amber-200 shadow-sm">{r === 0 ? "•" : r}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl border-t-8 border-t-red-500 shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl text-red-600">Register Wicket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Type</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}>
                <SelectTrigger className="h-12 font-black border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bowled">Bowled</SelectItem>
                  <SelectItem value="caught">Caught</SelectItem>
                  <SelectItem value="runout">Run Out</SelectItem>
                  <SelectItem value="lbw">LBW</SelectItem>
                  <SelectItem value="stumped">Stumped</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label>
              <Select value={wicketForm.batterOutId} onValueChange={(v) => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger className="h-12 font-black border-2"><SelectValue placeholder="Pick Player" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={activeInningData?.strikerPlayerId || 's'}>{getPlayerName(activeInningData?.strikerPlayerId || '')} (S)</SelectItem>
                  <SelectItem value={activeInningData?.nonStrikerPlayerId || 'ns'}>{getPlayerName(activeInningData?.nonStrikerPlayerId || '')} (NS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Delivery Status</Label>
              <Select value={wicketForm.extraType} onValueChange={(v) => setWicketForm({...wicketForm, extraType: v})}>
                <SelectTrigger className="h-12 font-black border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Legal Delivery</SelectItem>
                  <SelectItem value="noball">No Ball</SelectItem>
                  <SelectItem value="wide">Wide</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={async () => { 
            if (!wicketForm.batterOutId) { toast({ title: "Error", description: "Select batter who is out.", variant: "destructive" }); return; }
            const cur = `inning_${match?.currentInningNumber}`;
            const isLegal = wicketForm.extraType === 'none';
            const totalLegalCount = (currentDeliveries?.filter(d => ['none', 'bye', 'legbye'].includes(d.extraType)).length || 0);
            const leg = totalLegalCount + (isLegal ? 1 : 0);
            
            const deliveryId = doc(collection(db, 'temp')).id;
            const dData = { 
              id: deliveryId, 
              overLabel: formatBallLabel(leg), 
              strikerPlayerId: activeInningData?.strikerPlayerId, 
              bowlerId: activeInningData?.currentBowlerPlayerId, 
              isWicket: true, 
              dismissalType: wicketForm.type, 
              batsmanOutPlayerId: wicketForm.batterOutId, 
              extraType: wicketForm.extraType,
              totalRunsOnDelivery: wicketForm.extraType !== 'none' ? 1 : 0,
              timestamp: Date.now() 
            };
            setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', cur, 'deliveryRecords', deliveryId), dData, { merge: true });
            
            const updates: any = { 
              wickets: activeInningData!.wickets + (wicketForm.type === 'retired' ? 0 : 1), 
              score: activeInningData!.score + dData.totalRunsOnDelivery,
              oversCompleted: Math.floor(leg / 6), 
              ballsInCurrentOver: leg % 6, 
              [wicketForm.batterOutId === activeInningData?.strikerPlayerId ? 'strikerPlayerId' : 'nonStrikerPlayerId']: '' 
            };
            if (leg % 6 === 0 && isLegal) updates.currentBowlerPlayerId = '';
            if (leg >= match!.totalOvers * 6 || (updates.wickets >= 10 && !activeInningData?.isLastManActive)) updates.isDeclaredFinished = true;
            
            // Winning detection during wicket (e.g. run out on winning run but score was already met)
            if (match!.currentInningNumber === 2 && inn1 && updates.score > inn1.score) {
              updates.isDeclaredFinished = true;
            }

            updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', cur), updates);
            setIsWicketDialogOpen(false);
            if (updates.wickets < 10 && !updates.isDeclaredFinished) {
              setAssignmentForm({
                strikerId: updates.strikerPlayerId || activeInningData?.strikerPlayerId || '',
                nonStrikerId: updates.nonStrikerPlayerId || activeInningData?.nonStrikerPlayerId || '',
                bowlerId: updates.currentBowlerPlayerId || activeInningData?.currentBowlerPlayerId || ''
              });
              setIsPlayerAssignmentOpen(true);
            }
          }} className="w-full h-16 bg-red-600 text-white font-black uppercase rounded-2xl shadow-xl">Confirm Wicket</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
