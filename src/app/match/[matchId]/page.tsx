
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, serverTimestamp, getDoc, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { History, CheckCircle2, Trophy, Star, ShieldAlert, UserPlus, Info, ChevronRight, AlertCircle, Edit2, Save, Settings2, ShieldCheck, PenTool, BarChart3, LineChart as LineChartIcon, Flag, User, Target, Zap, PlayCircle, Undo2, Users2, ArrowLeftRight, Clock, Calendar, BarChart, TrendingUp, Users, ChevronDown, ChevronUp, RefreshCw, Trash2, Download, FileText, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart as ReBarChart, Bar } from "recharts";
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { generateHTMLReport, getExtendedInningStats } from '@/lib/report-utils';
import { calculatePlayerCVP } from '@/lib/cvp-utils';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isEditFullMatchOpen, setIsEditFullMatchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activeInningView, setActiveInningView] = useState<number>(1);
  const [openOvers, setOpenOvers] = useState<Record<number, boolean>>({});
  const [isDownloading, setIsDownloading] = useState(false);

  const [editForm, setEditForm] = useState({
    status: 'live',
    matchDate: '',
    tossWinner: '',
    tossDecision: 'bat',
    inn1Score: 0,
    inn1Wickets: 0,
    inn1Overs: 0,
    inn1Balls: 0,
    inn2Score: 0,
    inn2Wickets: 0,
    inn2Overs: 0,
    inn2Balls: 0,
    resultDescription: '',
    strikerId: '',
    nonStrikerId: '',
    bowlerId: '',
    potmPlayerId: ''
  });

  const [wicketForm, setWicketForm] = useState({
    type: 'bowled',
    batterOutId: '',
    fielderId: 'none'
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_1'), [db, matchId]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_2'), [db, matchId]);
  const { data: inn2 } = useDoc(inn2Ref);

  const activeInningData = match?.currentInningNumber === 1 ? inn1 : (match?.currentInningNumber === 2 ? inn2 : null);

  useEffect(() => {
    if (match?.currentInningNumber && isMounted) {
      setActiveInningView(match.currentInningNumber);
    }
  }, [match?.currentInningNumber, isMounted]);

  useEffect(() => {
    if (match && inn1) {
      setEditForm({
        status: match.status,
        matchDate: match.matchDate ? match.matchDate.split('T')[0] : new Date().toISOString().split('T')[0],
        tossWinner: match.tossWinnerTeamId || '',
        tossDecision: match.tossDecision || 'bat',
        inn1Score: inn1.score || 0,
        inn1Wickets: inn1.wickets || 0,
        inn1Overs: inn1.oversCompleted || 0,
        inn1Balls: inn1.ballsInCurrentOver || 0,
        inn2Score: inn2?.score || 0,
        inn2Wickets: inn2?.wickets || 0,
        inn2Overs: inn2?.oversCompleted || 0,
        inn2Balls: inn2?.ballsInCurrentOver || 0,
        resultDescription: match.resultDescription || '',
        strikerId: activeInningData?.strikerPlayerId || '',
        nonStrikerId: activeInningData?.nonStrikerPlayerId || '',
        bowlerId: activeInningData?.currentBowlerPlayerId || '',
        potmPlayerId: match.potmPlayerId || ''
      });
    }
  }, [match, inn1, inn2, activeInningData]);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const getPlayer = (pid: string) => pid && pid !== 'none' ? allPlayers?.find(p => p.id === pid) : null;
  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none' || pid === '') return '---';
    const p = getPlayer(pid);
    return p ? p.name : '---';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    const t = allTeams?.find(t => t.id === tid);
    return t ? t.name : 'Unknown Team';
  };

  const inn1DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_1', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn1Deliveries } = useCollection(inn1DeliveriesQuery);

  const inn2DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn2Deliveries } = useCollection(inn2DeliveriesQuery);

  const deliveriesByOver = useMemo(() => {
    const deliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;
    if (!deliveries) return {};
    const grouped: Record<number, any[]> = {};
    deliveries.forEach(d => {
        if (!grouped[d.overNumber]) grouped[d.overNumber] = [];
        grouped[d.overNumber].push(d);
    });
    return grouped;
  }, [activeInningView, inn1Deliveries, inn2Deliveries]);

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || []), [inn1Deliveries]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || []), [inn2Deliveries]);

  const playerCVPList = useMemo(() => {
    if (!allPlayers) return [];
    
    const playerStats: Record<string, any> = {};
    
    // Combine stats from both innings
    [stats1, stats2].forEach(stats => {
      stats.batting.forEach((b: any) => {
        if (!playerStats[b.id]) playerStats[b.id] = { id: b.id, name: getPlayerName(b.id), runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
        playerStats[b.id].runs += b.runs;
        playerStats[b.id].ballsFaced += b.balls;
        playerStats[b.id].fours += b.fours;
        playerStats[b.id].sixes += b.sixes;
      });
      stats.bowling.forEach((b: any) => {
        if (!playerStats[b.id]) playerStats[b.id] = { id: b.id, name: getPlayerName(b.id), runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
        playerStats[b.id].wickets += b.wickets;
        playerStats[b.id].maidens += b.maidens;
        playerStats[b.id].ballsBowled += b.balls;
        playerStats[b.id].runsConceded += b.runs;
      });
    });

    return Object.values(playerStats).map(ps => ({
      ...ps,
      cvp: calculatePlayerCVP(ps as any)
    })).sort((a, b) => b.cvp - a.cvp);
  }, [stats1, stats2, allPlayers]);

  const topCVPPlayer = playerCVPList[0];

  const currentInningStats = useMemo(() => {
    return activeInningView === 1 ? stats1 : stats2;
  }, [activeInningView, stats1, stats2]);

  const dismissedPlayerIds = useMemo(() => {
    const activeStats = match?.currentInningNumber === 1 ? stats1 : stats2;
    return activeStats.batting.filter(b => b.out).map(b => b.id);
  }, [match?.currentInningNumber, stats1, stats2]);

  const chartData = useMemo(() => {
    const data: any[] = [];
    const maxOvers = match?.totalOvers || 20;
    
    let inn1Cum = 0;
    let inn2Cum = 0;

    for (let i = 0; i <= maxOvers; i++) {
      const inn1Over = inn1Deliveries?.filter(d => d.overNumber === i);
      const inn2Over = inn2Deliveries?.filter(d => d.overNumber === i);

      const inn1Runs = inn1Over?.reduce((acc, curr) => acc + curr.totalRunsOnDelivery, 0) || 0;
      const inn2Runs = inn2Over?.reduce((acc, curr) => acc + curr.totalRunsOnDelivery, 0) || 0;

      const inn1Wkts = inn1Over?.filter(d => d.isWicket).length || 0;
      const inn2Wkts = inn2Over?.filter(d => d.isWicket).length || 0;

      inn1Cum += inn1Runs;
      inn2Cum += inn2Runs;

      data.push({
        over: i,
        inn1Cum: i === 0 ? 0 : (inn1Deliveries?.some(d => d.overNumber >= i) ? inn1Cum : null),
        inn2Cum: i === 0 ? 0 : (inn2Deliveries?.some(d => d.overNumber >= i) ? inn2Cum : null),
        inn1Runs,
        inn2Runs,
        inn1Wkts: inn1Wkts > 0 ? 5 : null,
        inn2Wkts: inn2Wkts > 0 ? 5 : null,
      });
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries, match]);

  const chartConfig = {
    inn1Cum: { label: getTeamName(match?.team1Id || ''), color: "hsl(var(--primary))" },
    inn2Cum: { label: getTeamName(match?.team2Id || ''), color: "hsl(var(--secondary))" },
    inn1Runs: { label: getTeamName(match?.team1Id || ''), color: "hsl(var(--primary))" },
    inn2Runs: { label: getTeamName(match?.team2Id || ''), color: "hsl(var(--secondary))" },
  } satisfies ChartConfig;

  const calculateResult = (i1?: any, i2?: any) => {
    const data1 = i1 || inn1;
    const data2 = i2 || inn2;
    if (!data1 || !data2) return "Match in Progress";
    
    const score1 = data1.score || 0;
    const score2 = data2.score || 0;
    const wickets2 = data2.wickets || 0;
    
    const team1Name = getTeamName(data1.battingTeamId);
    const team2Name = getTeamName(data2.battingTeamId);

    if (score1 > score2) {
      return `${team1Name} won by ${score1 - score2} runs`;
    } else if (score2 > score1) {
      const wicketsLeft = 10 - wickets2;
      return `${team2Name} won by ${wicketsLeft} wickets`;
    } else {
      return "Match Tied";
    }
  };

  const handleDownloadReport = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    toast({ title: "Generating Report", description: "Calculating all-innings stats..." });
    
    try {
      const html = generateHTMLReport(match, inn1, inn2, stats1, stats2, allTeams || [], allPlayers || []);
      
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CricMates_Report_${match?.id}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: "Report Ready", description: "Match details exported successfully." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Could not export report.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire) return;

    if (!activeInningData.strikerPlayerId || !activeInningData.nonStrikerPlayerId || !activeInningData.currentBowlerPlayerId) {
      setIsPlayerAssignmentOpen(true);
      toast({ title: "Assignments Missing", description: "Select Striker, Non-Striker, and Bowler first.", variant: "destructive" });
      return;
    }

    const currentInningId = `inning_${match.currentInningNumber}`;
    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    
    let ballRuns = runs;
    let extraRuns = 0;
    let isLegalBall = true;

    if (extraType === 'wide') {
      extraRuns = runs + 1;
      ballRuns = 0;
      isLegalBall = false;
    } else if (extraType === 'noball') {
      extraRuns = 1;
      isLegalBall = false;
    } else if (extraType === 'bye' || extraType === 'legbye') {
      extraRuns = runs;
      ballRuns = 0;
    }

    const totalRunsOnDelivery = ballRuns + extraRuns;
    const newScore = activeInningData.score + totalRunsOnDelivery;
    let newBalls = activeInningData.ballsInCurrentOver + (isLegalBall ? 1 : 0);
    let newOvers = activeInningData.oversCompleted;

    if (newBalls === 6) {
      newOvers += 1;
      newBalls = 0;
    }

    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords')).id;
    const deliveryData = {
      id: deliveryId,
      overNumber: newBalls === 0 && isLegalBall ? newOvers : newOvers + 1,
      ballNumberInOver: newBalls === 0 && isLegalBall ? 6 : newBalls,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerPlayerId: activeInningData.currentBowlerPlayerId,
      runsScored: ballRuns,
      extraRuns: extraRuns,
      extraType,
      totalRunsOnDelivery,
      isWicket: false,
      timestamp: Date.now()
    };

    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    updateDocumentNonBlocking(inningRef, {
      score: newScore,
      oversCompleted: newOvers,
      ballsInCurrentOver: newBalls,
      strikerPlayerId: runs % 2 !== 0 ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId,
      nonStrikerPlayerId: runs % 2 !== 0 ? activeInningData.strikerPlayerId : activeInningData.nonStrikerPlayerId
    });

    if (newBalls === 0 && isLegalBall) {
      setIsPlayerAssignmentOpen(true);
      toast({ title: "Over Complete", description: "Assign next bowler." });
    }
  };

  const handleUpdateFullMatch = async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), {
      status: editForm.status,
      matchDate: new Date(editForm.matchDate).toISOString(),
      tossWinnerTeamId: editForm.tossWinner,
      tossDecision: editForm.tossDecision,
      resultDescription: editForm.resultDescription,
      potmPlayerId: editForm.potmPlayerId,
      potmCvpScore: playerCVPList.find(p => p.id === editForm.potmPlayerId)?.cvp || 0
    });
    batch.update(doc(db, 'matches', matchId, 'innings', 'inning_1'), {
      score: editForm.inn1Score,
      wickets: editForm.inn1Wickets,
      oversCompleted: editForm.inn1Overs,
      ballsInCurrentOver: editForm.inn1Balls
    });
    if (inn2) {
      batch.update(doc(db, 'matches', matchId, 'innings', 'inning_2'), {
        score: editForm.inn2Score,
        wickets: editForm.inn2Wickets,
        oversCompleted: editForm.inn2Overs,
        ballsInCurrentOver: editForm.inn2Balls
      });
    }
    const currentInningId = `inning_${match?.currentInningNumber || 1}`;
    batch.update(doc(db, 'matches', matchId, 'innings', currentInningId), {
      strikerPlayerId: editForm.strikerId === 'none' ? '' : editForm.strikerId,
      nonStrikerPlayerId: editForm.nonStrikerId === 'none' ? '' : editForm.nonStrikerId,
      currentBowlerPlayerId: editForm.bowlerId === 'none' ? '' : editForm.bowlerId
    });
    await batch.commit();
    setIsEditFullMatchOpen(false);
    toast({ title: "Match Corrections Saved" });
  };

  const handleEndMatch = async () => {
    if (!match || !isUmpire) return;
    const resStr = calculateResult();
    const potmId = topCVPPlayer?.id || '';
    const potmName = topCVPPlayer?.name || 'Top Performer';

    if (confirm(`End match and finalize result: "${resStr}"?\n\nAutomatic POTM suggested: ${potmName}`)) {
        updateDocumentNonBlocking(doc(db, 'matches', matchId), { 
          status: 'completed',
          resultDescription: resStr,
          potmPlayerId: potmId,
          potmCvpScore: topCVPPlayer?.cvp || 0
        });
        toast({ title: "Match Completed", description: resStr });
    }
  };

  const handleWicket = async () => {
    if (!match || !activeInningData || !isUmpire || !wicketForm.batterOutId) return;

    const currentInningId = `inning_${match.currentInningNumber}`;
    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    
    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords')).id;
    const deliveryData = {
      id: deliveryId,
      overNumber: activeInningData.ballsInCurrentOver === 5 ? activeInningData.oversCompleted + 1 : activeInningData.oversCompleted + 1,
      ballNumberInOver: activeInningData.ballsInCurrentOver + 1,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerPlayerId: activeInningData.currentBowlerPlayerId,
      runsScored: 0,
      extraRuns: 0,
      extraType: 'none',
      totalRunsOnDelivery: 0,
      isWicket: true,
      dismissalType: wicketForm.type,
      batsmanOutPlayerId: wicketForm.batterOutId,
      fielderPlayerId: wicketForm.fielderId,
      timestamp: Date.now()
    };

    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);

    const newWickets = activeInningData.wickets + 1;
    let newBalls = activeInningData.ballsInCurrentOver + 1;
    let newOvers = activeInningData.oversCompleted;

    if (newBalls === 6) {
      newOvers += 1;
      newBalls = 0;
    }

    updateDocumentNonBlocking(inningRef, {
      wickets: newWickets,
      oversCompleted: newOvers,
      ballsInCurrentOver: newBalls,
      strikerPlayerId: wicketForm.batterOutId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId,
      nonStrikerPlayerId: wicketForm.batterOutId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId
    });

    setIsWicketDialogOpen(false);
    toast({ title: "OUT!", variant: "destructive" });
    setIsPlayerAssignmentOpen(true);
  };

  const handleDeleteBall = async (inningId: string, ballId: string) => {
    if (confirm('Delete this ball record? This will revert the score but you may need to manually fix assignments in Umpire Tools.')) {
        deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords', ballId));
        toast({ title: "Ball Deleted" });
    }
  };

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center font-black animate-pulse">LOADING...</div>;
  if (!match) return <div className="p-20 text-center">Match missing.</div>;

  const currentBattingSquadIds = match.currentInningNumber === 1 
    ? (inn1?.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds)
    : (inn2?.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds);

  const currentBowlingSquadIds = match.currentInningNumber === 1
    ? (inn1?.bowlingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds)
    : (inn2?.bowlingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds);

  const battingPlayers = allPlayers?.filter(p => currentBattingSquadIds?.includes(p.id)) || [];
  const bowlingPlayers = allPlayers?.filter(p => currentBowlingSquadIds?.includes(p.id)) || [];

  const availableBattingPlayers = battingPlayers.filter(p => !dismissedPlayerIds.includes(p.id));

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="border-b bg-white p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-black truncate">{getTeamName(match.team1Id)} <span className="text-slate-300">VS</span> {getTeamName(match.team2Id)}</h1>
            <p className="text-[10px] font-black uppercase text-primary tracking-widest">{match.status === 'completed' ? match.resultDescription : `Innings ${match.currentInningNumber} Live`}</p>
            {match.status === 'completed' && match.potmPlayerId && (
                <div className="mt-1 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">POTM: {getPlayerName(match.potmPlayerId)}</span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 text-secondary border-secondary hover:bg-secondary/5 font-black text-[10px] uppercase px-3" onClick={handleDownloadReport} disabled={isDownloading}>
              <Download className={cn("w-3 h-3 mr-1.5", isDownloading && "animate-bounce")} />
              <span className="hidden sm:inline">Download Report</span>
              <span className="sm:hidden">Report</span>
            </Button>
            {isUmpire && (
              <Button size="sm" variant="outline" onClick={() => setIsEditFullMatchOpen(true)} className="rounded-full h-8 px-3 font-black text-[10px] uppercase border-primary text-primary hover:bg-primary/5">
                <ShieldCheck className="w-3 h-3 mr-1" /> Umpire Tools
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-50 bg-white border-b shadow-sm overflow-x-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-start rounded-none bg-transparent h-auto p-0 scrollbar-hide">
            {['Info', 'Live', 'Scorecard', 'Overs', 'Charts'].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase()} className="flex-1 px-4 py-4 text-xs font-black rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary uppercase tracking-widest whitespace-nowrap">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab}>
        <TabsContent value="info" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest">Match Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {match.status === 'completed' && match.potmPlayerId && (
                <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-2xl flex flex-col md:flex-row items-center gap-6 shadow-md transform hover:scale-[1.01] transition-transform">
                    <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center border-4 border-amber-400 shadow-xl shrink-0">
                        <Trophy className="w-10 h-10 text-amber-600" />
                    </div>
                    <div className="text-center md:text-left">
                        <p className="text-[12px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">Player of the Match</p>
                        <h4 className="font-black text-3xl text-slate-900 leading-tight mb-2">{getPlayerName(match.potmPlayerId)}</h4>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
                           <div className="bg-white px-3 py-1 rounded-full border border-amber-200 shadow-sm flex items-center gap-2">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span className="text-xs font-black text-amber-700">{match.potmCvpScore?.toFixed(1) || '0.0'} CVP Points</span>
                           </div>
                           <div className="bg-amber-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Top Performer</div>
                        </div>
                    </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</p>
                  <p className="text-sm font-bold">{new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Flag className="w-3 h-3" /> Format</p>
                  <p className="text-sm font-bold">{match.totalOvers} Overs</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Clock className="w-3 h-3" /> Status</p>
                  <Badge variant={match.status === 'live' ? 'destructive' : 'default'} className="uppercase text-[9px] px-1.5 h-4">{match.status}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Trophy className="w-3 h-3" /> Toss</p>
                  <p className="text-xs font-medium">{getTeamName(match.tossWinnerTeamId)} won & chose to {match.tossDecision}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
                 <p className="text-[10px] font-black uppercase text-secondary tracking-widest flex items-center gap-2">
                    <Share2 className="w-3 h-3" /> Export & Share
                 </p>
                 <div className="flex gap-3">
                    <Button onClick={handleDownloadReport} disabled={isDownloading} className="bg-secondary hover:bg-secondary/90 font-bold text-xs h-10 px-6">
                       <FileText className="w-4 h-4 mr-2" /> Download Full Scorecard (HTML)
                    </Button>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
                 <div>
                    <h3 className="font-black text-xs uppercase text-primary mb-3 flex items-center gap-2"><Users className="w-3 h-3"/> {getTeamName(match.team1Id)} Squad</h3>
                    <div className="flex flex-wrap gap-2">
                       {match.team1SquadPlayerIds.map(pid => (
                          <Link key={pid} href={`/players/${pid}`}>
                            <Badge variant="outline" className="text-[9px] font-bold hover:border-primary transition-colors cursor-pointer">{getPlayerName(pid)}</Badge>
                          </Link>
                       ))}
                    </div>
                 </div>
                 <div>
                    <h3 className="font-black text-xs uppercase text-primary mb-3 flex items-center gap-2"><Users className="w-3 h-3"/> {getTeamName(match.team2Id)} Squad</h3>
                    <div className="flex flex-wrap gap-2">
                       {match.team2SquadPlayerIds.map(pid => (
                          <Link key={pid} href={`/players/${pid}`}>
                            <Badge variant="outline" className="text-[9px] font-bold hover:border-primary transition-colors cursor-pointer">{getPlayerName(pid)}</Badge>
                          </Link>
                       ))}
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inn1 && <div className={cn("p-4 rounded-xl border flex justify-between", match.currentInningNumber === 1 ? "bg-primary/5 border-primary shadow-sm" : "bg-slate-50 opacity-60")}><div><p className="text-[10px] font-black text-slate-400 uppercase">{getTeamName(inn1.battingTeamId)}</p><h4 className="font-black text-xl">{inn1.score || 0}/{inn1.wickets || 0}</h4></div><div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Overs</p><h4 className="font-bold">{(inn1.oversCompleted || 0)}.{(inn1.ballsInCurrentOver || 0)}</h4></div></div>}
              {inn2 && <div className={cn("p-4 rounded-xl border flex justify-between", match.currentInningNumber === 2 ? "bg-primary/5 border-primary shadow-sm" : "bg-slate-50 opacity-60")}><div><p className="text-[10px] font-black text-slate-400 uppercase">{getTeamName(inn2.battingTeamId)}</p><h4 className="font-black text-xl">{inn2.score || 0}/{inn2.wickets || 0}</h4></div><div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Overs</p><h4 className="font-bold">{(inn2.oversCompleted || 0)}.{(inn2.ballsInCurrentOver || 0)}</h4></div></div>}
            </div>

            {isUmpire && match.status === 'live' && activeInningData && (
              <div className="space-y-6">
                <div className="bg-slate-900 text-white p-4 rounded-xl relative shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-3 items-center">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center font-black text-xs shrink-0">BAT</div>
                        <div className="cursor-pointer hover:opacity-80" onClick={() => setIsPlayerAssignmentOpen(true)}>
                            <p className="text-[9px] font-black text-primary uppercase">On Strike</p>
                            <p className="text-sm font-black">{getPlayerName(activeInningData.strikerPlayerId)}*</p>
                            <p className="text-[9px] text-slate-400 font-bold">Non-Strike: {getPlayerName(activeInningData.nonStrikerPlayerId)}</p>
                        </div>
                    </div>
                    <div className="text-right cursor-pointer hover:opacity-80" onClick={() => setIsPlayerAssignmentOpen(true)}>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Current Bowler</p>
                        <p className="text-sm font-black">{getPlayerName(activeInningData.currentBowlerPlayerId)}</p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setIsEditFullMatchOpen(true)} className="text-amber-500 hover:text-amber-400 hover:bg-white/5 h-7 px-2 font-black text-[9px] uppercase"><Edit2 className="w-3 h-3 mr-1" /> Quick Edit</Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2, 3, 4, 6].map(r => (
                    <Button key={r} onClick={() => handleRecordBall(r)} className="h-16 font-black text-2xl bg-white text-slate-900 border-2 border-slate-200 hover:border-primary/50 shadow-sm transition-all active:scale-95">{r === 0 ? "•" : r}</Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-14 font-black text-amber-700 bg-amber-50 uppercase tracking-widest text-xs">WIDE</Button>
                  <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-14 font-black text-amber-700 bg-amber-50 uppercase tracking-widest text-xs">NO BALL</Button>
                  <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-14 font-black text-red-700 bg-red-50 uppercase tracking-widest text-xs">WICKET</Button>
                  <Button variant="outline" onClick={handleEndMatch} className="h-14 font-black text-secondary bg-secondary/5 uppercase tracking-widest text-xs shadow-md border-secondary/20">FINISH MATCH</Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="scorecard" className="space-y-6 pt-4">
          {[1, 2].map(innNum => {
            const inning = innNum === 1 ? inn1 : inn2;
            if (!inning) return null;
            const stats = innNum === 1 ? stats1 : stats2;
            return (
              <div key={innNum} className="space-y-6">
                <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
                  <h3 className="font-black text-xs uppercase tracking-widest">{getTeamName(inning.battingTeamId)} Inning</h3>
                  <p className="font-black text-xl">{(inning.score || 0)}/{(inning.wickets || 0)} <span className="text-xs text-slate-400 ml-1">({(inning.oversCompleted || 0)}.{(inning.ballsInCurrentOver || 0)})</span></p>
                </div>
                
                <Collapsible defaultOpen>
                   <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full flex justify-between items-center bg-slate-50 p-4 border rounded-xl hover:bg-slate-100 transition-colors">
                        <span className="text-xs font-black uppercase text-primary tracking-widest">Batting Statistics</span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </Button>
                   </CollapsibleTrigger>
                   <CollapsibleContent className="pt-2">
                      <Card className="rounded-xl overflow-hidden shadow-sm">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="text-[10px] font-black uppercase">Batter</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">R</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">B</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">4s</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">6s</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">SR</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                             {stats.batting.map(b => (
                               <TableRow key={b.id}>
                                 <TableCell className="text-xs font-bold">
                                    <Link href={`/players/${b.id}`} className="text-primary hover:underline">{getPlayerName(b.id)}</Link>
                                    {b.out && <span className="block text-[8px] text-slate-400 uppercase font-black">({b.dismissal})</span>}
                                 </TableCell>
                                 <TableCell className="text-right text-xs font-black">{b.runs}</TableCell>
                                 <TableCell className="text-right text-xs text-slate-500 font-bold">{b.balls}</TableCell>
                                 <TableCell className="text-right text-xs text-slate-500">{b.fours}</TableCell>
                                 <TableCell className="text-right text-xs text-slate-500">{b.sixes}</TableCell>
                                 <TableCell className="text-right text-xs text-slate-400 font-black">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                               </TableRow>
                             ))}
                          </TableBody>
                        </Table>
                      </Card>
                   </CollapsibleContent>
                </Collapsible>

                <Collapsible defaultOpen>
                   <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full flex justify-between items-center bg-slate-50 p-4 border rounded-xl hover:bg-slate-100 transition-colors">
                        <span className="text-xs font-black uppercase text-primary tracking-widest">Bowling Statistics</span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </Button>
                   </CollapsibleTrigger>
                   <CollapsibleContent className="pt-2">
                      <Card className="rounded-xl overflow-hidden shadow-sm">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="text-[10px] font-black uppercase">Bowler</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">O</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">M</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">R</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">W</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">Econ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                             {stats.bowling.map(b => (
                               <TableRow key={b.id}>
                                 <TableCell className="text-xs font-bold">
                                    <Link href={`/players/${b.id}`} className="text-primary hover:underline">{getPlayerName(b.id)}</Link>
                                 </TableCell>
                                 <TableCell className="text-right text-xs font-bold">{b.oversDisplay}</TableCell>
                                 <TableCell className="text-right text-xs font-bold">{b.maidens || 0}</TableCell>
                                 <TableCell className="text-right text-xs font-black">{b.runs}</TableCell>
                                 <TableCell className="text-right text-xs font-black text-primary">{b.wickets}</TableCell>
                                 <TableCell className="text-right text-xs font-black text-slate-400">
                                    {b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}
                                 </TableCell>
                               </TableRow>
                             ))}
                          </TableBody>
                        </Table>
                      </Card>
                   </CollapsibleContent>
                </Collapsible>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="rounded-xl overflow-hidden shadow-sm">
                        <CardHeader className="bg-slate-50 py-3 px-4 border-b">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest">Fall of Wickets</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableBody>
                                    {stats.fow.map((f, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="text-[10px] font-black text-slate-400 w-8">{f.wicketNum}</TableCell>
                                            <TableCell className="text-xs font-bold">{f.scoreAtWicket}/{f.wicketNum} <span className="text-slate-400 font-medium">({f.overs} ov)</span></TableCell>
                                            <TableCell className="text-right text-[10px] font-black text-primary">{getPlayerName(f.playerOutId)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl overflow-hidden shadow-sm">
                        <CardHeader className="bg-slate-50 py-3 px-4 border-b">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest">Partnerships</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableBody>
                                    {stats.partnerships.map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="py-3 px-4">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold truncate max-w-[80px]">{getPlayerName(p.batter1Id)}</span>
                                                    <span className="text-[10px] font-black text-primary">{p.runs} ({p.balls})</span>
                                                    <span className="text-[10px] font-bold truncate max-w-[80px] text-right">{getPlayerName(p.batter2Id)}</span>
                                                </div>
                                                <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-slate-100">
                                                    <div className="bg-primary h-full" style={{ width: `${(p.batter1Runs / (p.runs || 1)) * 100}%` }} />
                                                    <div className="bg-secondary h-full" style={{ width: `${(p.batter2Runs / (p.runs || 1)) * 100}%` }} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="overs" className="pt-4 space-y-4">
           <div className="flex justify-between items-center px-2">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Inning History</p>
                <Select value={activeInningView.toString()} onValueChange={v => setActiveInningView(parseInt(v))}>
                    <SelectTrigger className="w-32 h-8 text-[10px] font-black uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">Innings 1</SelectItem>
                        {inn2 && <SelectItem value="2">Innings 2</SelectItem>}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-4">
                {Object.keys(deliveriesByOver).sort((a, b) => Number(b) - Number(a)).map(overNumStr => {
                    const overNum = Number(overNumStr);
                    const overBalls = deliveriesByOver[overNum];
                    const isOverOpen = openOvers[overNum] ?? false;

                    return (
                        <Collapsible 
                            key={overNum} 
                            open={isOverOpen} 
                            onOpenChange={(open) => setOpenOvers(prev => ({...prev, [overNum]: open}))}
                            className="border rounded-xl bg-white overflow-hidden shadow-sm"
                        >
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">{overNum}</div>
                                        <p className="text-xs font-black uppercase text-left">Over {overNum}</p>
                                    </div>
                                    {isOverOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 pb-4 space-y-2 border-t pt-4 bg-slate-50/30">
                                {overBalls.map((d) => (
                                    <div key={d.id} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-xs">
                                        <div className="flex items-center gap-3">
                                            <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px]">{d.overNumber-1}.{d.ballNumberInOver}</div>
                                            <div><p className="text-xs font-bold">{getPlayerName(d.strikerPlayerId)}</p></div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {d.isWicket ? <Badge variant="destructive" className="font-black text-[9px] h-6">OUT</Badge> : <div className="h-7 w-7 rounded bg-slate-100 flex items-center justify-center font-black text-xs">{d.totalRunsOnDelivery}</div>}
                                            {isUmpire && <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-destructive" onClick={() => handleDeleteBall(`inning_${activeInningView}`, d.id)}><Trash2 className="w-3 h-3" /></Button>}
                                        </div>
                                    </div>
                                ))}
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </div>
        </TabsContent>

        <TabsContent value="charts" className="pt-4 space-y-6">
           <Card className="rounded-xl overflow-hidden shadow-sm">
              <CardHeader className="bg-slate-50 py-3 px-4 border-b"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Worm Graph (Cumulative)</CardTitle></CardHeader>
              <CardContent className="pt-6">
                 <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="over" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          <Line type="monotone" dataKey="inn1Cum" name={getTeamName(match?.team1Id || '')} stroke="var(--color-inn1Cum)" strokeWidth={3} dot={false} connectNulls />
                          <Line type="monotone" dataKey="inn2Cum" name={getTeamName(match?.team2Id || '')} stroke="var(--color-inn2Cum)" strokeWidth={3} dot={false} connectNulls />
                       </LineChart>
                    </ResponsiveContainer>
                 </ChartContainer>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* FULL CORRECTION EDITOR V1.1 (Includes POTM) */}
      <Dialog open={isEditFullMatchOpen} onOpenChange={setIsEditFullMatchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border-t-8 border-t-primary">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-black uppercase text-xl flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-primary" /> CORRECTION ENGINE V1.1
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Match Status</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm({...editForm, status: v})}>
                      <SelectTrigger className="font-bold h-12 shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Player of the Match</Label>
                  <Select value={editForm.potmPlayerId || "none"} onValueChange={v => setEditForm({...editForm, potmPlayerId: v})}>
                    <SelectTrigger className="font-bold h-12 shadow-sm"><SelectValue placeholder="Select POTM" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Not Selected</SelectItem>
                        {allPlayers?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
              </div>
            </div>

            <div className="p-6 border rounded-2xl bg-slate-50/50 shadow-inner space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <PenTool className="w-3 h-3" /> ON-FIELD ASSIGNMENT
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase">Striker</Label>
                  <Select value={editForm.strikerId || "none"} onValueChange={v => setEditForm({...editForm, strikerId: v})}>
                    <SelectTrigger className="font-bold text-xs h-10 shadow-sm"><SelectValue placeholder="Striker" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Set</SelectItem>
                      {availableBattingPlayers.map(p => p.id && <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase">Non-Striker</Label>
                  <Select value={editForm.nonStrikerId || "none"} onValueChange={v => setEditForm({...editForm, nonStrikerId: v})}>
                    <SelectTrigger className="font-bold text-xs h-10 shadow-sm"><SelectValue placeholder="Non-Striker" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Set</SelectItem>
                      {availableBattingPlayers.map(p => p.id && <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-black uppercase">Bowler</Label>
                  <Select value={editForm.bowlerId || "none"} onValueChange={v => setEditForm({...editForm, bowlerId: v})}>
                    <SelectTrigger className="font-bold text-xs h-10 shadow-sm"><SelectValue placeholder="Bowler" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Set</SelectItem>
                      {bowlingPlayers.map(p => p.id && <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 border rounded-2xl bg-white shadow-sm border-l-4 border-l-primary space-y-4">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Innings 1 Totals</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-[8px] font-black">Runs</Label><Input type="number" onFocus={e => e.target.select()} value={editForm.inn1Score} onChange={e => setEditForm({...editForm, inn1Score: parseInt(e.target.value)||0})} className="font-black h-12 text-lg" /></div>
                        <div className="space-y-1"><Label className="text-[8px] font-black">Wkts</Label><Input type="number" onFocus={e => e.target.select()} value={editForm.inn1Wickets} onChange={e => setEditForm({...editForm, inn1Wickets: parseInt(e.target.value)||0})} className="font-black h-12 text-lg" /></div>
                    </div>
                </div>

                <div className="p-5 border rounded-2xl bg-white shadow-sm border-l-4 border-l-secondary space-y-4">
                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Innings 2 Totals</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-[8px] font-black">Runs</Label><Input type="number" onFocus={e => e.target.select()} value={editForm.inn2Score} onChange={e => setEditForm({...editForm, inn2Score: parseInt(e.target.value)||0})} className="font-black h-12 text-lg" /></div>
                        <div className="space-y-1"><Label className="text-[8px] font-black">Wkts</Label><Input type="number" onFocus={e => e.target.select()} value={editForm.inn2Wickets} onChange={e => setEditForm({...editForm, inn2Wickets: parseInt(e.target.value)||0})} className="font-black h-12 text-lg" /></div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Result Description</Label>
              <div className="flex gap-2">
                <Input value={editForm.resultDescription} onChange={e => setEditForm({...editForm, resultDescription: e.target.value})} className="font-bold text-primary h-12 shadow-sm" />
                <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setEditForm({...editForm, resultDescription: calculateResult({score: editForm.inn1Score, battingTeamId: inn1?.battingTeamId}, {score: editForm.inn2Score, battingTeamId: inn2?.battingTeamId, wickets: editForm.inn2Wickets})})} title="Recalculate Result"><RefreshCw className="w-5 h-5" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button onClick={handleUpdateFullMatch} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl">
                <Save className="w-5 h-5 mr-2" /> SAVE CORRECTIONS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="rounded-xl border-t-8 border-t-destructive">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest">Register Wicket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Wicket Type</Label>
              <Select value={wicketForm.type} onValueChange={v => setWicketForm({...wicketForm, type: v})}>
                <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['bowled', 'caught', 'lbw', 'runout', 'stumped', 'hit-wicket'].map(t => <SelectItem key={t} value={t} className="uppercase font-bold text-[10px]">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label>
              <Select value={wicketForm.batterOutId} onValueChange={v => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger className="font-bold"><SelectValue placeholder="Select Batter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={activeInningData?.strikerPlayerId || 'none'}>{getPlayerName(activeInningData?.strikerPlayerId || '')}</SelectItem>
                  <SelectItem value={activeInningData?.nonStrikerPlayerId || 'none'}>{getPlayerName(activeInningData?.nonStrikerPlayerId || '')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400">Fielder (Optional)</Label>
                <Select value={wicketForm.fielderId} onValueChange={v => setWicketForm({...wicketForm, fielderId: v})}>
                    <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {bowlingPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={handleWicket} className="w-full h-12 font-black uppercase tracking-widest">Confirm Wicket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Assignments</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black">Striker</Label>
              <Select value={activeInningData?.strikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: v })}>
                <SelectTrigger><SelectValue placeholder="Striker" /></SelectTrigger>
                <SelectContent>{availableBattingPlayers.filter(p => p.id !== activeInningData?.nonStrikerPlayerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black">Non-Striker</Label>
              <Select value={activeInningData?.nonStrikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { nonStrikerPlayerId: v })}>
                <SelectTrigger><SelectValue placeholder="Non-Striker" /></SelectTrigger>
                <SelectContent>{availableBattingPlayers.filter(p => p.id !== activeInningData?.strikerPlayerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black">Bowler</Label>
              <Select value={activeInningData?.currentBowlerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { currentBowlerPlayerId: v })}>
                <SelectTrigger><SelectValue placeholder="Bowler" /></SelectTrigger>
                <SelectContent>{bowlingPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsPlayerAssignmentOpen(false)} className="w-full h-12 font-black">CONFIRM POSITIONING</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
