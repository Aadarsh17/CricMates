
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, History, Loader2, Zap, PlayCircle, ArrowLeftRight, ShieldCheck, RefreshCw, Swords, Target, Activity, List, Info, BarChart3, TrendingUp, Trash2, UserPlus, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const chartConfig = {
  score: {
    label: "Runs",
    color: "hsl(var(--primary))",
  },
  rate: {
    label: "Run Rate",
    color: "hsl(var(--secondary))",
  }
} satisfies ChartConfig;

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
    if (totalLegalBalls <= 0) return "0.0";
    const completedOvers = Math.floor((totalLegalBalls - 1) / 6);
    const ballsInOver = ((totalLegalBalls - 1) % 6) + 1;
    return `${completedOvers}.${ballsInOver}`;
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
      score: Math.max(0, score), 
      wickets: Math.max(0, wkts), 
      oversCompleted: Math.floor(legal / 6), 
      ballsInCurrentOver: legal % 6,
      isDeclaredFinished: legal >= (match?.totalOvers || 0) * 6
    };
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates);
  };

  const handleRecordBall = async (runs: number, extra: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) {
      if (!activeInningData?.currentBowlerPlayerId && isUmpire) setIsPlayerAssignmentOpen(true);
      return;
    }
    const currentInningId = `inning_${match.currentInningNumber}`;
    const isLegal = extra === 'none' || extra === 'bye' || extra === 'legbye';
    const totalLegalCount = (currentDeliveries?.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length || 0);
    const newTotalLegal = totalLegalCount + (isLegal ? 1 : 0);
    
    if (newTotalLegal > match.totalOvers * 6) { 
      toast({ title: "Limit Reached", description: "Overs completed." }); 
      return; 
    }

    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = { 
      id: deliveryId, 
      overLabel: formatOverNotation(newTotalLegal),
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

  const wormData = useMemo(() => {
    const data: any[] = [{ over: 0, score: 0 }];
    let runningScore = 0;
    let currentLegal = 0;
    currentDeliveries?.forEach(d => {
      runningScore += d.totalRunsOnDelivery;
      if (d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye') {
        currentLegal++;
        if (currentLegal % 6 === 0) {
          data.push({ over: currentLegal / 6, score: runningScore });
        }
      }
    });
    if (currentLegal % 6 !== 0) {
      data.push({ over: parseFloat((Math.floor(currentLegal/6) + (currentLegal%6)/10).toFixed(1)), score: runningScore });
    }
    return data;
  }, [currentDeliveries]);

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  const currentOverNotation = formatOverNotation((activeInningData?.oversCompleted || 0) * 6 + (activeInningData?.ballsInCurrentOver || 0));

  const InningScorecard = ({ inning, stats, title }: { inning: any, stats: any, title: string }) => (
    <Card className="border-none shadow-xl overflow-hidden bg-white rounded-3xl mb-6">
      <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
        <span className="text-[10px] font-black uppercase text-slate-500">{title}</span>
        <Badge className="bg-primary/10 text-primary font-black text-[8px] uppercase">{getTeamName(inning?.battingTeamId)}</Badge>
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
              <TableRow key={b.id} className={cn(b.id === activeInningData?.strikerPlayerId ? "bg-primary/5" : "")}>
                <TableCell className="py-3">
                  <p className="font-black text-xs uppercase truncate max-w-[100px]">{getPlayerName(b.id)}</p>
                  <p className={cn("text-[8px] font-bold uppercase italic", b.out ? "text-red-500" : "text-slate-400")}>{b.out ? 'OUT' : 'Active'}</p>
                </TableCell>
                <TableCell className="text-right font-black text-sm">{b.runs}</TableCell>
                <TableCell className="text-right text-xs text-slate-500 font-bold">{b.balls}</TableCell>
                <TableCell className="text-right text-xs text-slate-500">{b.fours}</TableCell>
                <TableCell className="text-right text-xs text-slate-500">{b.sixes}</TableCell>
                <TableCell className="text-right text-[10px] font-black text-slate-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 px-1 relative">
      {/* Broadcast Header Strip */}
      <div className="fixed top-16 left-0 right-0 z-[90] bg-slate-950 text-white shadow-2xl px-6 py-4 border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-black uppercase text-[10px] text-slate-400">{getTeamName(match?.team1Id).substring(0,8)}</span>
              <span className={cn("font-black text-xl", match?.currentInningNumber === 1 ? "text-primary" : "text-slate-500")}>{Math.max(0, inn1?.score || 0)}/{inn1?.wickets || 0}</span>
              <Badge variant="outline" className="text-[8px] font-black border-white/10 h-4 text-slate-400">
                ({formatOverNotation((inn1?.oversCompleted || 0) * 6 + (inn1?.ballsInCurrentOver || 0))})
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black uppercase text-[10px] text-slate-400">{getTeamName(match?.team2Id).substring(0,8)}</span>
              <span className={cn("font-black text-xl", match?.currentInningNumber === 2 ? "text-secondary" : "text-slate-500")}>{Math.max(0, inn2?.score || 0)}/{inn2?.wickets || 0}</span>
              <Badge variant="outline" className="text-[8px] font-black border-white/10 h-4 text-slate-400">
                ({formatOverNotation((inn2?.oversCompleted || 0) * 6 + (inn2?.ballsInCurrentOver || 0))})
              </Badge>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <Badge variant="destructive" className="animate-pulse text-[8px] h-4 font-black uppercase">Live Center</Badge>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">
              {match?.currentInningNumber === 1 ? "1st Innings" : "2nd Innings"}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-28 space-y-6">
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl mb-6 sticky top-[112px] z-[80] shadow-sm">
            <TabsTrigger value="live" className="font-black text-[9px] uppercase">Live</TabsTrigger>
            <TabsTrigger value="scorecard" className="font-black text-[9px] uppercase">Score</TabsTrigger>
            <TabsTrigger value="analytics" className="font-black text-[9px] uppercase">Stats</TabsTrigger>
            <TabsTrigger value="overs" className="font-black text-[9px] uppercase">Overs</TabsTrigger>
            <TabsTrigger value="info" className="font-black text-[9px] uppercase">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
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
                <CardContent className="p-4 flex justify-between items-center relative z-10">
                  <div className="min-w-0"><p className="text-[9px] font-black uppercase text-primary tracking-widest mb-1 flex items-center gap-1.5"><Activity className="w-3 h-3"/> Active Striker</p><p className="font-black text-xl uppercase truncate text-slate-900">{getPlayerName(activeInningData?.strikerPlayerId || '')}</p></div>
                  <div className="flex gap-4 text-right">
                    <div className="bg-white/50 px-3 py-1 rounded-lg"><p className="text-xl font-black text-slate-900">{currentStats?.batting?.find((b: any) => b.id === activeInningData?.strikerPlayerId)?.runs || 0}</p><p className="text-[8px] text-slate-400 font-black uppercase">Runs</p></div>
                    <div className="bg-white/50 px-3 py-1 rounded-lg"><p className="text-xl font-black text-slate-900">{currentStats?.batting?.find((b: any) => b.id === activeInningData?.strikerPlayerId)?.balls || 0}</p><p className="text-[8px] text-slate-400 font-black uppercase">Balls</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-slate-200 bg-white rounded-2xl shadow-sm">
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="min-w-0"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Non-Striker</p><p className="font-black text-lg uppercase truncate text-slate-600">{getPlayerName(activeInningData?.nonStrikerPlayerId || '')}</p></div>
                  <div className="flex gap-4 text-right">
                    <div><p className="text-lg font-black text-slate-600">{currentStats?.batting?.find((b: any) => b.id === activeInningData?.nonStrikerPlayerId)?.runs || 0}</p><p className="text-[8px] text-slate-400 font-black uppercase">Runs</p></div>
                    <div><p className="text-lg font-black text-slate-600">{currentStats?.batting?.find((b: any) => b.id === activeInningData?.nonStrikerPlayerId)?.balls || 0}</p><p className="text-[8px] text-slate-400 font-black uppercase">Balls</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-black uppercase flex items-center gap-2 text-slate-900"><History className="w-5 h-5 text-primary" /> Recent Log</h2>
                <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200">Current Over</Badge>
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
                    <span className="text-[8px] font-black text-slate-400">{d.overLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scorecard" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {match?.currentInningNumber === 2 ? (
              <>
                <InningScorecard inning={inn2} stats={stats2} title="2nd Innings (Chasing)" />
                <InningScorecard inning={inn1} stats={stats1} title="1st Innings (Completed)" />
              </>
            ) : (
              <>
                <InningScorecard inning={inn1} stats={stats1} title="1st Innings" />
                {inn2 && <InningScorecard inning={inn2} stats={stats2} title="2nd Innings" />}
              </>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <Card className="border-none shadow-xl bg-white rounded-3xl p-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Worm Chart</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={wormData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="over" label={{ value: 'Overs', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 'bold' }} tick={{ fontSize: 10 }} />
                      <YAxis label={{ value: 'Runs', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' }} tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="overs" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black uppercase text-slate-900">Ball-by-Ball</h2>
              <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200">Historical Log</Badge>
            </div>
            <div className="space-y-2">
              {currentDeliveries?.slice().reverse().map(d => (
                <Card key={d.id} className="border shadow-sm bg-white overflow-hidden rounded-2xl group">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center font-black text-sm shadow-inner shrink-0",
                        d.isWicket ? "bg-red-500 text-white" : 
                        d.runsScored === 6 ? "bg-purple-600 text-white" :
                        d.runsScored === 4 ? "bg-emerald-500 text-white" :
                        "bg-slate-50 text-slate-600"
                      )}>
                        {d.isWicket ? "W" : d.totalRunsOnDelivery}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Over {d.overLabel}</p>
                        <p className="text-xs font-bold text-slate-600 truncate">{getPlayerName(d.strikerPlayerId)} to {getPlayerName(d.bowlerId)}</p>
                        {d.extraType !== 'none' && <Badge variant="outline" className="text-[8px] h-4 mt-1 border-amber-500 text-amber-600 font-black uppercase">{d.extraType}</Badge>}
                      </div>
                    </div>
                    {isUmpire && (
                      <Button variant="ghost" size="icon" onClick={() => { if(confirm("Delete this ball?")) { deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`, 'deliveryRecords', d.id)); recalculateInningState(`inning_${match?.currentInningNumber}`); toast({ title: "Historical Corrected" }); } }} className="text-slate-300 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card className="border-none shadow-xl bg-white rounded-3xl p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b pb-2 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Match Details</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Format</p><p className="font-black text-slate-900 uppercase">{match?.totalOvers} Overs League</p></div>
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Toss</p><p className="font-black text-slate-900 uppercase">{getTeamName(match?.tossWinnerTeamId)} ({match?.tossDecision})</p></div>
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Official</p><p className="font-black text-slate-900 uppercase">{match?.umpireId === 'anonymous' ? 'League Official' : 'Pro Umpire'}</p></div>
                  <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</p><Badge className="bg-primary/10 text-primary h-5 font-black uppercase text-[8px]">{match?.status}</Badge></div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
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

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl border-t-8 border-t-red-500 shadow-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl text-red-600">Register Dismissal</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Dismissal Type</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}>
                <SelectTrigger className="h-12 font-black border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bowled" className="font-black text-xs uppercase">Bowled</SelectItem>
                  <SelectItem value="caught" className="font-black text-xs uppercase">Caught</SelectItem>
                  <SelectItem value="runout" className="font-black text-xs uppercase">Run Out</SelectItem>
                  <SelectItem value="stumped" className="font-black text-xs uppercase">Stumped</SelectItem>
                  <SelectItem value="retired" className="font-black text-xs uppercase">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label>
              <Select value={wicketForm.batterOutId} onValueChange={(v) => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger className="h-12 font-black border-2"><SelectValue placeholder="Pick Player" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={activeInningData?.strikerPlayerId || 's'} className="font-black text-xs uppercase">{getPlayerName(activeInningData?.strikerPlayerId || '')} (Striker)</SelectItem>
                  <SelectItem value={activeInningData?.nonStrikerPlayerId || 'ns'} className="font-black text-xs uppercase">{getPlayerName(activeInningData?.nonStrikerPlayerId || '')} (Non-Striker)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { 
              const currentInningId = `inning_${match?.currentInningNumber}`;
              const totalLegal = (currentDeliveries?.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length || 0) + 1;
              const deliveryId = doc(collection(db, 'temp')).id;
              const dData = { 
                id: deliveryId, 
                overLabel: formatOverNotation(totalLegal),
                strikerPlayerId: activeInningData?.strikerPlayerId, 
                bowlerId: activeInningData?.currentBowlerPlayerId, 
                isWicket: true, 
                dismissalType: wicketForm.type, 
                batsmanOutPlayerId: wicketForm.batterOutId,
                timestamp: Date.now(),
                totalRunsOnDelivery: 0
              };
              setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData, { merge: true });
              
              const isRetired = wicketForm.type === 'retired';
              const updates: any = { 
                wickets: activeInningData!.wickets + (isRetired ? 0 : 1),
                oversCompleted: Math.floor(totalLegal / 6),
                ballsInCurrentOver: totalLegal % 6,
                [wicketForm.batterOutId === activeInningData?.strikerPlayerId ? 'strikerPlayerId' : 'nonStrikerPlayerId']: ''
              };
              if (totalLegal % 6 === 0) updates.currentBowlerPlayerId = '';
              if (totalLegal >= match!.totalOvers * 6) updates.isDeclaredFinished = true;
              
              updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
              setIsWicketDialogOpen(false);
              toast({ title: `OUT: ${wicketForm.type.toUpperCase()}` });
            }} className="w-full h-16 bg-red-600 text-white font-black uppercase rounded-2xl shadow-xl">Confirm Wicket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
