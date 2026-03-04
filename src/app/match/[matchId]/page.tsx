
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, getDocs, limit, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CheckCircle2, Trophy, Info, ArrowLeftRight, Trash2, Download, Loader2, Zap, LineChart as LineChartIcon, BarChart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, Line, BarChart as ReBarChart, Bar, Cell } from "recharts";
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { generateHTMLReport, getExtendedInningStats } from '@/lib/report-utils';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const CustomWicketDot = (props: any) => {
  const { cx, cy, value, stroke } = props;
  if (value === null || value === undefined) return null;
  return (
    <g key={`wkt-dot-${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={7} fill={stroke} stroke="#fff" strokeWidth={1} />
      <text x={cx} y={cy} dy={3} textAnchor="middle" fill="white" fontSize="8px" fontWeight="900">W</text>
    </g>
  );
};

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isRetireDialogOpen, setIsRetireDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isEditFullMatchOpen, setIsEditFullMatchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activeInningView, setActiveInningView] = useState<number>(1);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  const [wicketForm, setWicketForm] = useState({
    type: 'bowled',
    batterOutId: '',
    fielderId: 'none',
    decision: 'next'
  });

  const [retireForm, setRetireForm] = useState({
    batterId: '',
    decision: 'next'
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

  const inn1DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_1', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn1Deliveries, isLoading: isInn1Loading } = useCollection(inn1DeliveriesQuery);

  const inn2DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn2Deliveries, isLoading: isInn2Loading } = useCollection(inn2DeliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none' || pid === '') return '---';
    return allPlayers?.find(p => p.id === pid)?.name || '---';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    return allTeams?.find(t => t.id === tid)?.name || 'Unknown Team';
  };

  const currentBattingSquad = useMemo(() => {
    if (!match || !activeInningData || !allPlayers) return [];
    return allPlayers.filter(p => p.teamId === activeInningData.battingTeamId || (match.commonPlayerId && p.id === match.commonPlayerId));
  }, [match, activeInningData, allPlayers]);

  const currentBowlingSquad = useMemo(() => {
    if (!match || !activeInningData || !allPlayers) return [];
    return allPlayers.filter(p => p.teamId === activeInningData.bowlingTeamId || (match.commonPlayerId && p.id === match.commonPlayerId));
  }, [match, activeInningData, allPlayers]);

  const definitivelyOutIds = useMemo(() => {
    const currentDeliveries = (match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries) || [];
    const outSet = new Set<string>();
    currentDeliveries.forEach(d => {
      if (d.isWicket && d.dismissalType !== 'retired') {
        outSet.add(d.batsmanOutPlayerId || d.strikerPlayerId);
      }
    });
    return outSet;
  }, [match?.currentInningNumber, inn1Deliveries, inn2Deliveries]);

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || []), [inn1Deliveries]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || []), [inn2Deliveries]);

  const currentInningStats = useMemo(() => activeInningView === 1 ? stats1 : stats2, [activeInningView, stats1, stats2]);
  const currentDeliveriesList = useMemo(() => activeInningView === 1 ? inn1Deliveries : inn2Deliveries, [activeInningView, inn1Deliveries, inn2Deliveries]);
  const isHistoryLoading = useMemo(() => activeInningView === 1 ? isInn1Loading : isInn2Loading, [activeInningView, isInn1Loading, isInn2Loading]);

  const wormData = useMemo(() => {
    const data: any[] = [];
    const maxBalls = Math.max(inn1Deliveries?.length || 0, inn2Deliveries?.length || 0);
    let score1 = 0; let score2 = 0;
    for (let i = 0; i < maxBalls; i++) {
      const d1 = inn1Deliveries?.[i]; const d2 = inn2Deliveries?.[i];
      if (d1) score1 += (d1.totalRunsOnDelivery || 0);
      if (d2) score2 += (d2.totalRunsOnDelivery || 0);
      data.push({ 
        ball: i + 1, 
        team1: d1 ? score1 : null, 
        team2: d2 ? score2 : null, 
        team1Wicket: d1?.isWicket && d1.dismissalType !== 'retired' ? score1 : null, 
        team2Wicket: d2?.isWicket && d2.dismissalType !== 'retired' ? score2 : null 
      });
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries]);

  const manhattanData = useMemo(() => {
    const currentDeliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;
    if (!currentDeliveries) return [];
    const overs: Record<number, { over: number, runs: number, wickets: number }> = {};
    currentDeliveries.forEach(d => {
      const oNum = d.overNumber;
      if (!overs[oNum]) overs[oNum] = { over: oNum, runs: 0, wickets: 0 };
      overs[oNum].runs += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && d.dismissalType !== 'retired') overs[oNum].wickets += 1;
    });
    return Object.values(overs).sort((a, b) => a.over - b.over);
  }, [activeInningView, inn1Deliveries, inn2Deliveries]);

  const overGroups = useMemo(() => {
    if (!currentDeliveriesList) return null;
    const groups: Record<number, any[]> = {};
    currentDeliveriesList.forEach(d => {
      if (!groups[d.overNumber]) groups[d.overNumber] = [];
      groups[d.overNumber].push(d);
    });
    return groups;
  }, [currentDeliveriesList]);

  const playerCVPList = useMemo(() => {
    if (!allPlayers) return [];
    const playerStats: Record<string, any> = {};
    [stats1, stats2].forEach(stats => {
      stats.batting.forEach((b: any) => {
        if (!playerStats[b.id]) playerStats[b.id] = { id: b.id, name: getPlayerName(b.id), runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
        playerStats[b.id].runs += b.runs; playerStats[b.id].ballsFaced += b.balls; playerStats[b.id].fours += b.fours; playerStats[b.id].sixes += b.sixes;
      });
      stats.bowling.forEach((b: any) => {
        if (!playerStats[b.id]) playerStats[b.id] = { id: b.id, name: getPlayerName(b.id), runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
        playerStats[b.id].wickets += b.wickets; playerStats[b.id].maidens += b.maidens; playerStats[b.id].ballsBowled += b.balls; playerStats[b.id].runsConceded += b.runs;
      });
    });
    return Object.values(playerStats).map(ps => ({ ...ps, cvp: calculatePlayerCVP(ps as any) })).sort((a, b) => b.cvp - a.cvp);
  }, [stats1, stats2, allPlayers]);

  const isCurrentInningFinished = useMemo(() => {
    if (!match || !activeInningData) return false;
    if (activeInningData.isDeclaredFinished) return true;
    const battingTeamId = activeInningData.battingTeamId;
    const squadSize = (battingTeamId === match.team1Id ? match.team1SquadPlayerIds?.length : match.team2SquadPlayerIds?.length) || 11;
    return activeInningData.oversCompleted >= match.totalOvers || activeInningData.wickets >= squadSize;
  }, [match, activeInningData]);

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none', noStrikeChange: boolean = false) => {
    if (!match || !activeInningData || !isUmpire || isCurrentInningFinished) return;
    if (!activeInningData.strikerPlayerId || (!activeInningData.isLastManActive && !activeInningData.nonStrikerPlayerId) || !activeInningData.currentBowlerPlayerId) {
      setIsPlayerAssignmentOpen(true); toast({ title: "Assignments Missing", variant: "destructive" }); return;
    }
    const currentInningId = `inning_${match.currentInningNumber}`;
    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    let ballRuns = runs; let extraRuns = 0; let isLegalBall = true;
    if (extraType === 'wide') { extraRuns = runs + 1; ballRuns = 0; isLegalBall = false; }
    else if (extraType === 'noball') { extraRuns = 1; ballRuns = runs; isLegalBall = false; }
    else if (extraType === 'bye' || extraType === 'legbye') { extraRuns = runs; ballRuns = 0; }
    const totalRunsOnDelivery = ballRuns + extraRuns;
    const newScore = activeInningData.score + totalRunsOnDelivery;
    let newBalls = activeInningData.ballsInCurrentOver + (isLegalBall ? 1 : 0);
    let newOvers = activeInningData.oversCompleted;
    if (newBalls === 6) { newOvers += 1; newBalls = 0; }
    const deliveryData = { id: doc(collection(db, 'temp')).id, overNumber: newBalls === 0 && isLegalBall ? newOvers : newOvers + 1, ballNumberInOver: newBalls === 0 && isLegalBall ? 6 : newBalls, strikerPlayerId: activeInningData.strikerPlayerId, nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', bowlerId: activeInningData.currentBowlerPlayerId, runsScored: ballRuns, extraRuns, extraType, totalRunsOnDelivery, isWicket: false, timestamp: Date.now(), noStrikeChange };
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    const updates: any = { score: newScore, oversCompleted: newOvers, ballsInCurrentOver: newBalls };
    if (!activeInningData.isLastManActive && !noStrikeChange) { if (runs % 2 !== 0) { updates.strikerPlayerId = activeInningData.nonStrikerPlayerId; updates.nonStrikerPlayerId = activeInningData.strikerPlayerId; } }
    updateDocumentNonBlocking(inningRef, updates);
    if (newBalls === 0 && isLegalBall && newOvers < match.totalOvers) { setIsPlayerAssignmentOpen(true); toast({ title: "Over Complete", description: "Assign next bowler." }); }
  };

  const handleSwapStrike = () => {
    if (!match || !activeInningData || !isUmpire || activeInningData.isLastManActive) return;
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: activeInningData.nonStrikerPlayerId, nonStrikerPlayerId: activeInningData.strikerPlayerId });
    toast({ title: "Strikers Swapped" });
  };

  const handleWicket = async () => {
    if (!match || !activeInningData || !isUmpire || !wicketForm.batterOutId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveryData = { id: doc(collection(db, 'temp')).id, overNumber: activeInningData.oversCompleted + 1, ballNumberInOver: activeInningData.ballsInCurrentOver + 1, strikerPlayerId: activeInningData.strikerPlayerId, nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', bowlerId: activeInningData.currentBowlerPlayerId, runsScored: 0, extraRuns: 0, extraType: 'none', totalRunsOnDelivery: 0, isWicket: true, dismissalType: wicketForm.type, batsmanOutPlayerId: wicketForm.batterOutId, fielderPlayerId: wicketForm.fielderId, timestamp: Date.now() };
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    const newWickets = activeInningData.wickets + (wicketForm.type === 'retired' ? 0 : 1);
    let newBalls = activeInningData.ballsInCurrentOver + 1; let newOvers = activeInningData.oversCompleted;
    if (newBalls === 6) { newOvers += 1; newBalls = 0; }
    const updates: any = { wickets: newWickets, oversCompleted: newOvers, ballsInCurrentOver: newBalls };
    if (wicketForm.decision === 'finish') updates.isDeclaredFinished = true;
    else if (wicketForm.decision === 'last_man') { updates.isLastManActive = true; updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId; updates.nonStrikerPlayerId = ''; }
    else { updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId; updates.nonStrikerPlayerId = wicketForm.batterOutId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId; }
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsWicketDialogOpen(false); toast({ title: "OUT!", variant: "destructive" });
    const battingTeamId = activeInningData.battingTeamId;
    const squadSize = (battingTeamId === match.team1Id ? match.team1SquadPlayerIds?.length : match.team2SquadPlayerIds?.length) || 11;
    if (newWickets < squadSize && wicketForm.decision !== 'finish') setIsPlayerAssignmentOpen(true);
  };

  const handleRetire = async () => {
    if (!match || !activeInningData || !isUmpire || !retireForm.batterId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveryData = { id: doc(collection(db, 'temp')).id, overNumber: activeInningData.oversCompleted + 1, ballNumberInOver: activeInningData.ballsInCurrentOver, strikerPlayerId: activeInningData.strikerPlayerId, nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', bowlerId: activeInningData.currentBowlerPlayerId, runsScored: 0, extraRuns: 0, extraType: 'none', totalRunsOnDelivery: 0, isWicket: true, dismissalType: 'retired', batsmanOutPlayerId: retireForm.batterId, timestamp: Date.now() };
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    const updates: any = { isDeclaredFinished: retireForm.decision === 'finish' };
    if (retireForm.decision === 'finish') updates.isDeclaredFinished = true;
    else if (retireForm.decision === 'last_man') { updates.isLastManActive = true; updates.strikerPlayerId = retireForm.batterId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId; updates.nonStrikerPlayerId = ''; }
    else { updates.strikerPlayerId = retireForm.batterId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId; updates.nonStrikerPlayerId = retireForm.batterId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId; }
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsRetireDialogOpen(false); toast({ title: "Batter Retired" });
    if (retireForm.decision === 'next') setIsPlayerAssignmentOpen(true);
  };

  const handleUndoLastBall = async () => {
    if (!match || !activeInningData || !isUmpire || isUndoing) return;
    setIsUndoing(true); const currentInningId = `inning_${match.currentInningNumber}`;
    const q = query(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1));
    try {
      const snapshot = await getDocs(q); if (snapshot.empty) return;
      const lastBall = snapshot.docs[0].data(); const lastBallId = snapshot.docs[0].id;
      let { score, wickets, oversCompleted, ballsInCurrentOver, strikerPlayerId, nonStrikerPlayerId, isLastManActive } = activeInningData;
      score -= (lastBall.totalRunsOnDelivery || 0);
      if (lastBall.isWicket) { if (lastBall.dismissalType !== 'retired') wickets -= 1; strikerPlayerId = lastBall.strikerPlayerId; nonStrikerPlayerId = lastBall.nonStrikerPlayerId === 'none' ? '' : lastBall.nonStrikerPlayerId; isLastManActive = lastBall.nonStrikerPlayerId === 'none'; }
      else if (!isLastManActive && !lastBall.noStrikeChange && lastBall.runsScored % 2 !== 0) { const temp = strikerPlayerId; strikerPlayerId = nonStrikerPlayerId; nonStrikerPlayerId = temp; }
      const isLegal = lastBall.extraType !== 'wide' && lastBall.extraType !== 'noball' && lastBall.dismissalType !== 'retired';
      if (isLegal) { if (ballsInCurrentOver === 0) { oversCompleted -= 1; ballsInCurrentOver = 5; } else ballsInCurrentOver -= 1; }
      updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), { score, wickets, oversCompleted, ballsInCurrentOver, strikerPlayerId, nonStrikerPlayerId, isLastManActive, isDeclaredFinished: false });
      deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', lastBallId));
      toast({ title: "Last Ball Undone" });
    } finally { setIsUndoing(false); }
  };

  const handleFixSummary = async (inningNumOverride?: number) => {
    const targetInningNum = inningNumOverride || match?.currentInningNumber;
    if (!match || !isUmpire || isFixing || !targetInningNum) return;
    setIsFixing(true);
    try {
      const currentInningId = `inning_${targetInningNum}`;
      const snapshot = await getDocs(query(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), orderBy('timestamp', 'asc')));
      let newScore = 0, newWickets = 0, newBalls = 0, newOvers = 0;
      snapshot.docs.forEach(doc => {
        const d = doc.data(); newScore += (d.totalRunsOnDelivery || 0);
        if (d.isWicket && d.dismissalType !== 'retired') newWickets += 1;
        if (d.extraType !== 'wide' && d.extraType !== 'noball' && d.dismissalType !== 'retired') { newBalls += 1; if (newBalls === 6) { newOvers += 1; newBalls = 0; } }
      });
      await setDoc(doc(db, 'matches', matchId, 'innings', currentInningId), { score: newScore, wickets: newWickets, oversCompleted: newOvers, ballsInCurrentOver: newBalls, isDeclaredFinished: false }, { merge: true });
      toast({ title: "Summary Fixed" });
    } finally { setIsFixing(false); }
  };

  const handleDownloadReport = () => {
    if (!match || !inn1) return;
    const reportContent = generateHTMLReport(match, inn1, inn2 || null, stats1, stats2, allTeams || [], allPlayers || []);
    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MatchReport_${match.id || 'Report'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Report Downloaded" });
  };

  const calculateResult = (i1: any, i2: any) => {
    if (!i1 || !i2 || !match) return "Match in Progress";
    const s1 = i1.score || 0; const s2 = i2.score || 0;
    const tBat1 = getTeamName(i1.battingTeamId); const tBat2 = getTeamName(i2.battingTeamId);
    if (s1 > s2) return `${tBat1} won by ${s1 - s2} runs`;
    if (s2 > s1) {
      const battingTeamId = i2.battingTeamId;
      const squadSize = (battingTeamId === match.team1Id ? match.team1SquadPlayerIds?.length : match.team2SquadPlayerIds?.length) || 11;
      const remainingWickets = Math.max(0, squadSize - (i2.wickets || 0));
      return `${tBat2} won by ${remainingWickets} wickets`;
    }
    return "Match Tied";
  };

  const handleEndMatch = async () => {
    if (!match || !isUmpire) return;
    const resStr = calculateResult(inn1, inn2);
    updateDocumentNonBlocking(doc(db, 'matches', matchId), { status: 'completed', resultDescription: resStr, potmPlayerId: playerCVPList[0]?.id || '', potmCvpScore: playerCVPList[0]?.cvp || 0 });
    toast({ title: "Match Completed", description: resStr });
  };

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center font-black animate-pulse">SYNCING MATCH...</div>;
  if (!match) return <div className="p-20 text-center">Match missing.</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="border-b bg-white p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-black truncate uppercase tracking-tighter">{getTeamName(match.team1Id)} <span className="text-slate-300 mx-1">VS</span> {getTeamName(match.team2Id)}</h1>
            <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-1">{match.status === 'completed' ? match.resultDescription : `Innings ${match.currentInningNumber} Active`}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 text-secondary border-secondary hover:bg-secondary/5 font-black text-[10px] uppercase" onClick={handleDownloadReport}><Download className="w-3 h-3 mr-1.5" /> Report</Button>
            {isUmpire && <Button size="sm" variant="outline" onClick={() => setIsEditFullMatchOpen(true)} className="h-8 px-3 font-black text-[10px] uppercase border-primary text-primary">Umpire Tools</Button>}
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-50 bg-white border-b shadow-sm overflow-x-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-start rounded-none bg-transparent h-auto p-0 scrollbar-hide">
            {['Live', 'Scorecard', 'Analytics', 'Overs', 'Info'].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase()} className="flex-1 px-4 py-4 text-xs font-black rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary uppercase tracking-widest whitespace-nowrap">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab}>
        <TabsContent value="live" className="space-y-6 pt-2">
          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[inn1, inn2].map((inn, idx) => inn && (
                <div key={`inn-total-${idx}`} className={cn("p-4 rounded-xl border flex justify-between", match.currentInningNumber === idx+1 ? "bg-primary/5 border-primary" : "opacity-60 bg-slate-50")}>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">{getTeamName(inn.battingTeamId)}</p><h4 className="font-black text-xl">{inn.score}/{inn.wickets}</h4>{inn.isLastManActive && <Badge className="bg-destructive text-[8px] h-4 mt-1">LMS</Badge>}</div>
                  <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Overs</p><h4 className="font-bold">{inn.oversCompleted}.{inn.ballsInCurrentOver}</h4></div>
                </div>
              ))}
            </div>
            {isUmpire && match.status === 'live' && activeInningData && (
              <div className="space-y-6">
                {!isCurrentInningFinished ? (
                  <>
                    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex justify-between items-center">
                      <div className="space-y-1 flex-1 cursor-pointer" onClick={() => setIsPlayerAssignmentOpen(true)}><p className="text-[9px] font-black text-primary uppercase tracking-widest">On Strike</p><p className="text-sm font-black">{getPlayerName(activeInningData.strikerPlayerId)}*</p>{!activeInningData.isLastManActive && <p className="text-[9px] text-slate-400 font-bold uppercase">Non-Strike: {getPlayerName(activeInningData.nonStrikerPlayerId)}</p>}</div>
                      <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-white/5 hover:bg-primary/20 hover:text-primary transition-all shadow-inner" onClick={handleSwapStrike} title="Swap Strike"><ArrowLeftRight className="w-5 h-5" /></Button>
                      <div className="text-right space-y-1 flex-1 cursor-pointer" onClick={() => setIsPlayerAssignmentOpen(true)}><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Bowler</p><p className="text-sm font-black">{getPlayerName(activeInningData.currentBowlerPlayerId)}</p></div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[0, 1, 2, 3, 4, 6].map(r => (<Button key={`run-${r}`} onClick={() => handleRecordBall(r)} className={cn("h-16 font-black text-2xl bg-white text-slate-900 border-2 border-slate-200 hover:border-primary shadow-sm", r >= 4 ? "text-primary border-primary/20" : "")}>{r === 0 ? "•" : r}</Button>))}
                      <Button onClick={() => handleRecordBall(1, 'none', true)} className="h-16 font-black text-xl bg-slate-50 text-secondary border-2 border-secondary/20 hover:border-secondary shadow-sm flex flex-col items-center justify-center"><span className="text-lg">1D</span><span className="text-[7px] uppercase tracking-tighter opacity-70">No Swap</span></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-14 font-black text-amber-700 bg-amber-50 uppercase tracking-widest text-xs border-amber-200">WIDE</Button>
                      <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-14 font-black text-amber-700 bg-amber-50 uppercase tracking-widest text-xs border-amber-200">NO BALL</Button>
                      <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-14 font-black text-red-700 bg-red-50 uppercase tracking-widest text-xs border-red-200">WICKET</Button>
                      <Button variant="outline" onClick={() => setIsRetireDialogOpen(true)} className="h-14 font-black text-blue-700 bg-blue-50 uppercase tracking-widest text-xs border-blue-200">RETIRE</Button>
                      <Button variant="outline" onClick={handleUndoLastBall} disabled={isUndoing} className="h-14 font-black text-slate-700 bg-slate-100 uppercase tracking-widest text-xs">{isUndoing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "UNDO"}</Button>
                      <Button variant="outline" onClick={() => { if(confirm("End current innings?")) updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { isDeclaredFinished: true }); }} className="h-14 font-black text-secondary bg-secondary/5 uppercase tracking-widest text-xs border-secondary/20">DECLARE END</Button>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center space-y-6 border-2 border-dashed rounded-3xl bg-slate-50/50">
                    <div><CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" /><h3 className="text-xl font-black uppercase">Innings Complete</h3></div>
                    {match.currentInningNumber === 1 ? <Button onClick={() => { const batch = writeBatch(db); batch.update(doc(db, 'matches', matchId), { currentInningNumber: 2 }); batch.set(doc(db, 'matches', matchId, 'innings', 'inning_2'), { id: 'inning_2', matchId, inningNumber: 2, score: 0, wickets: 0, oversCompleted: 0, ballsInCurrentOver: 0, battingTeamId: inn1?.bowlingTeamId, bowlingTeamId: inn1?.battingTeamId, strikerPlayerId: '', nonStrikerPlayerId: '', currentBowlerPlayerId: '', matchStatus: 'live', isDeclaredFinished: false, isLastManActive: false }); batch.commit(); setIsPlayerAssignmentOpen(true); }} className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-xl">START 2ND INNINGS</Button> : <Button onClick={handleEndMatch} className="w-full h-16 text-lg font-black uppercase tracking-widest bg-secondary shadow-xl">FINALIZE MATCH</Button>}
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="scorecard" className="space-y-6 pt-4">
           <div className="flex gap-2 mb-4">
              <Button size="sm" variant={activeInningView === 1 ? 'default' : 'outline'} onClick={() => setActiveInningView(1)} className="font-black text-[10px] uppercase">1st Innings</Button>
              {(match.currentInningNumber >= 2 || inn2) && <Button size="sm" variant={activeInningView === 2 ? 'default' : 'outline'} onClick={() => setActiveInningView(2)} className="font-black text-[10px] uppercase">2nd Innings</Button>}
           </div>
           <Card className="rounded-xl overflow-hidden border shadow-sm">
              <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500">Batting</span></div>
              <Table><TableHeader className="bg-slate-50/50"><TableRow><TableHead className="text-[8px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[8px] font-black uppercase">R</TableHead><TableHead className="text-right text-[8px] font-black uppercase">B</TableHead><TableHead className="text-right text-[8px] font-black uppercase">SR</TableHead></TableRow></TableHeader><TableBody>{currentInningStats.batting.map((b, idx) => (<TableRow key={`bat-${b.id}-${idx}`}><TableCell className="py-2"><p className="font-bold text-xs">{getPlayerName(b.id)}</p><p className="text-[8px] text-slate-400 italic">{b.out ? `(${b.dismissal})` : '(not out)'}</p></TableCell><TableCell className="text-right font-black text-sm">{b.runs}</TableCell><TableCell className="text-right text-xs text-slate-500">{b.balls}</TableCell><TableCell className="text-right text-[10px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell></TableRow>))}</TableBody></Table>
           </Card>
           <Card className="rounded-xl overflow-hidden border shadow-sm">
              <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Bowling</span></div>
              <Table><TableHeader className="bg-slate-50/50"><TableRow><TableHead className="text-[8px] font-black uppercase">Bowler</TableHead><TableHead className="text-right text-[8px] font-black uppercase">O</TableHead><TableHead className="text-right text-[8px] font-black uppercase">R</TableHead><TableHead className="text-right text-[8px] font-black uppercase">W</TableHead></TableRow></TableHeader><TableBody>{currentInningStats.bowling.map((b, idx) => (<TableRow key={`bowl-${b.id || idx}`}><TableCell className="py-2"><p className="font-bold text-xs">{getPlayerName(b.id)}</p></TableCell><TableCell className="text-right text-xs">{b.oversDisplay}</TableCell><TableCell className="text-right text-sm font-bold">{b.runs}</TableCell><TableCell className="text-right text-sm font-black text-primary">{b.wickets}</TableCell></TableRow>))}</TableBody></Table>
           </Card>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card className="rounded-xl overflow-hidden border shadow-sm">
                <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Fall of Wickets</span></div>
                <Table><TableHeader className="bg-slate-50/50"><TableRow><TableHead className="text-[8px] font-black uppercase">Wkt</TableHead><TableHead className="text-[8px] font-black uppercase">Score</TableHead><TableHead className="text-[8px] font-black uppercase">Over</TableHead></TableRow></TableHeader><TableBody>{currentInningStats.fow.map((f, idx) => (<TableRow key={`fow-${idx}`}><TableCell className="py-2 text-[10px] font-black">{f.wicketNum}</TableCell><TableCell className="py-2 text-[10px] font-black">{f.scoreAtWicket}</TableCell><TableCell className="py-2 text-[10px] text-slate-500">{f.overs}</TableCell></TableRow>))}</TableBody></Table>
             </Card>
             <Card className="rounded-xl overflow-hidden border shadow-sm">
                <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Partnerships</span></div>
                <Table><TableHeader className="bg-slate-50/50"><TableRow><TableHead className="text-[8px] font-black uppercase">Pair</TableHead><TableHead className="text-right text-[8px] font-black uppercase">Runs</TableHead></TableRow></TableHeader><TableBody>{currentInningStats.partnerships.map((p, idx) => (<TableRow key={`part-${idx}`}><TableCell className="py-2"><p className="text-[10px] font-bold">{getPlayerName(p.batter1Id)} & {getPlayerName(p.batter2Id)}</p></TableCell><TableCell className="text-right text-[10px] font-black">{p.runs} ({p.balls})</TableCell></TableRow>))}</TableBody></Table>
             </Card>
           </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 pt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                 <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><LineChartIcon className="w-4 h-4" /> Worm Chart (Cumulative Runs)</CardTitle></CardHeader>
                 <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={wormData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="ball" fontSize={8} label={{ value: 'Balls', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                          <YAxis fontSize={8} label={{ value: 'Runs', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                          <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Area type="monotone" dataKey="team1" name={getTeamName(match.team1Id)} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} />
                          <Area type="monotone" dataKey="team2" name={getTeamName(match.team2Id)} stroke="hsl(var(--secondary))" fill="hsl(var(--secondary))" fillOpacity={0.1} />
                          <Line type="monotone" dataKey="team1Wicket" name="Wkt (T1)" stroke="none" dot={<CustomWicketDot stroke="hsl(var(--primary))" />} />
                          <Line type="monotone" dataKey="team2Wicket" name="Wkt (T2)" stroke="none" dot={<CustomWicketDot stroke="hsl(var(--secondary))" />} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </CardContent>
              </Card>
              <Card className="shadow-sm">
                 <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><BarChart className="w-4 h-4" /> Manhattan Chart (Runs Per Over)</CardTitle>
                    <div className="flex gap-1">
                       <Button size="sm" variant={activeInningView === 1 ? 'secondary' : 'ghost'} className="h-6 text-[8px] font-black" onClick={() => setActiveInningView(1)}>INN 1</Button>
                       <Button size="sm" variant={activeInningView === 2 ? 'secondary' : 'ghost'} className="h-6 text-[8px] font-black" onClick={() => setActiveInningView(2)}>INN 2</Button>
                    </div>
                 </CardHeader>
                 <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <ReBarChart data={manhattanData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="over" fontSize={8} /><YAxis fontSize={8} /><Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                          <Bar dataKey="runs" name="Runs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                             {manhattanData.map((entry, index) => (<Cell key={`cell-man-${index}`} fill={entry.wickets > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />))}
                          </Bar>
                       </ReBarChart>
                    </ResponsiveContainer>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>

        <TabsContent value="overs" className="pt-4">
           <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <Button size="sm" variant={activeInningView === 1 ? 'default' : 'outline'} onClick={() => setActiveInningView(1)} className="font-black text-[10px] uppercase">1st Innings</Button>
                {(match.currentInningNumber >= 2 || inn2) && <Button size="sm" variant={activeInningView === 2 ? 'default' : 'outline'} onClick={() => setActiveInningView(2)} className="font-black text-[10px] uppercase">2nd Innings</Button>}
              </div>
              {isUmpire && <Button size="sm" variant="secondary" className="h-8 text-[9px] font-black uppercase tracking-widest border-2 border-primary/20 shadow-md" onClick={() => handleFixSummary(activeInningView)}><Zap className="w-3 h-3 mr-1.5" /> Fix Summary & Resume</Button>}
           </div>
           <div className="space-y-4">
              {isHistoryLoading ? (
                <div className="py-20 text-center flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-slate-400 text-[10px] font-black uppercase">Loading...</p>
                </div>
              ) : overGroups && Object.keys(overGroups).length > 0 ? (
                Object.keys(overGroups).sort((a, b) => parseInt(b) - parseInt(a)).map(oNum => {
                  const overBalls = overGroups[parseInt(oNum)];
                  const bowlerId = overBalls[0]?.bowlerId;
                  return (
                    <Card key={`over-card-${oNum}`} className="overflow-hidden border-l-4 border-l-slate-200">
                      <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b">
                        <h4 className="text-[10px] font-black uppercase text-slate-500">Over {oNum}</h4>
                        <span className="text-[9px] font-black text-primary uppercase">Bowled by: {getPlayerName(bowlerId)}</span>
                      </div>
                      <div className="p-4 space-y-3">
                        {overBalls.map((d, idx) => (
                          <div key={d.id || `ball-${idx}`} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border-2", d.isWicket ? "bg-red-600 text-white" : "bg-white text-slate-700")}>
                                {d.isWicket ? "W" : d.runsScored}
                              </div>
                              <div className="flex flex-col">
                                <p className="text-[10px] font-black uppercase">{getPlayerName(d.strikerPlayerId)}</p>
                                {d.isWicket ? (
                                  <p className="text-[8px] text-red-600 font-bold uppercase">
                                    OUT: {d.dismissalType} {d.fielderPlayerId && d.fielderPlayerId !== 'none' ? `(by ${getPlayerName(d.fielderPlayerId)})` : ''}
                                  </p>
                                ) : (
                                  <p className="text-[8px] text-slate-400 font-bold uppercase">{d.totalRunsOnDelivery} runs {d.extraType !== 'none' ? `(${d.extraType})` : ''}</p>
                                )}
                              </div>
                            </div>
                            {isUmpire && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-destructive" onClick={() => { if (confirm("Delete this ball?")) { deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords', d.id)); toast({ title: "Ball Removed" }); } }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="py-20 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                  <p className="text-slate-400 text-[10px] font-black uppercase">No deliveries found</p>
                </div>
              )}
           </div>
        </TabsContent>

        <TabsContent value="info" className="space-y-6 pt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm"><CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Match Metadata</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-4 border-b pb-4"><div><p className="text-[10px] font-black text-slate-400 uppercase">Date</p><p className="text-xs font-bold">{match.matchDate ? new Date(match.matchDate).toLocaleDateString() : '---'}</p></div><div><p className="text-[10px] font-black text-slate-400 uppercase">Format</p><p className="text-xs font-bold">{match.totalOvers} Overs</p></div></div><div><p className="text-[10px] font-black text-slate-400 uppercase">Official Umpire</p><p className="text-xs font-bold">{match.umpireId === 'anonymous' ? 'League Official' : 'Registered Umpire'}</p></div></CardContent></Card>
              <Card className="shadow-sm"><CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest">Squad Registry</CardTitle></CardHeader><CardContent className="space-y-6"><div><p className="text-[10px] font-black text-primary uppercase border-b pb-1">{getTeamName(match.team1Id)}</p><div className="flex flex-wrap gap-1.5 mt-2">{allPlayers?.filter(p => match.team1SquadPlayerIds?.includes(p.id)).map(p => (<Badge key={`info-t1-${p.id}`} variant="outline" className="text-[8px] font-bold uppercase">{p.name}</Badge>))}</div></div><div><p className="text-[10px] font-black text-secondary uppercase border-b pb-1">{getTeamName(match.team2Id)}</p><div className="flex flex-wrap gap-1.5 mt-2">{allPlayers?.filter(p => match.team2SquadPlayerIds?.includes(p.id)).map(p => (<Badge key={`info-t2-${p.id}`} variant="outline" className="text-[8px] font-bold uppercase">{p.name}</Badge>))}</div></div></CardContent></Card>
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditFullMatchOpen} onOpenChange={setIsEditFullMatchOpen}>
        <DialogContent className="max-w-2xl rounded-xl border-t-8 border-t-primary"><DialogHeader><DialogTitle className="font-black uppercase text-xl">Umpire Dashboard</DialogTitle></DialogHeader><div className="space-y-6 py-6"><div className="grid grid-cols-2 gap-6"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Match Status</Label><Select value={match.status} onValueChange={v => updateDocumentNonBlocking(matchRef, {status: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="live">Live</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Active Inning</Label><Select value={match.currentInningNumber.toString()} onValueChange={v => updateDocumentNonBlocking(matchRef, {currentInningNumber: parseInt(v)})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Inning 1</SelectItem><SelectItem value="2">Inning 2</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Result Description</Label><Input value={match.resultDescription || ''} onChange={e => updateDocumentNonBlocking(matchRef, {resultDescription: e.target.value})} className="font-bold text-primary h-12 shadow-sm" /></div><Button onClick={() => handleFixSummary()} disabled={isFixing} variant="secondary" className="w-full h-12 font-black uppercase">Recalculate Current Inning</Button></div><DialogFooter><Button onClick={() => setIsEditFullMatchOpen(false)} className="w-full h-14 font-black uppercase shadow-xl">CLOSE TOOLS</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="rounded-xl border-t-8 border-t-destructive"><DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-destructive">Register Wicket</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Wicket Type</Label><Select value={wicketForm.type} onValueChange={v => setWicketForm({...wicketForm, type: v})}><SelectTrigger className="font-bold"><SelectValue /></SelectTrigger><SelectContent>{['bowled', 'caught', 'lbw', 'runout', 'stumped'].map(t => <SelectItem key={`wkt-type-${t}`} value={t} className="uppercase font-bold text-[10px]">{t}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label><Select value={wicketForm.batterOutId} onValueChange={v => setWicketForm({...wicketForm, batterOutId: v})}><SelectTrigger className="font-bold"><SelectValue placeholder="Select Batter" /></SelectTrigger><SelectContent>{activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)}</SelectItem>}{activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>}</SelectContent></Select></div><div className="space-y-1 p-3 bg-slate-50 rounded-lg border"><Label className="text-[10px] font-black uppercase text-primary mb-2 block">Post-Wicket Action</Label><Select value={wicketForm.decision} onValueChange={v => setWicketForm({...wicketForm, decision: v})}><SelectTrigger className="font-bold h-12 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="next" className="font-bold">Next Batter</SelectItem><SelectItem value="last_man" className="font-bold">Last Man Standing</SelectItem><SelectItem value="finish" className="font-bold text-destructive">Finish Innings</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="destructive" onClick={handleWicket} className="w-full h-12 font-black uppercase shadow-lg">Confirm Out</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={isRetireDialogOpen} onOpenChange={setIsRetireDialogOpen}>
        <DialogContent className="rounded-xl border-t-8 border-t-blue-500"><DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-blue-600">Retire Batter</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Batter Retiring</Label><Select value={retireForm.batterId} onValueChange={v => setRetireForm({...retireForm, batterId: v})}><SelectTrigger className="font-bold"><SelectValue placeholder="Select Batter" /></SelectTrigger><SelectContent>{activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)}</SelectItem>}{activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>}</SelectContent></Select></div><div className="space-y-1 p-3 bg-slate-50 rounded-lg border"><Label className="text-[10px] font-black uppercase text-primary mb-2 block">Post-Retire Action</Label><Select value={retireForm.decision} onValueChange={v => setRetireForm({...retireForm, decision: v})}><SelectTrigger className="font-bold h-12 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="next" className="font-bold">Next Batter</SelectItem><SelectItem value="last_man" className="font-bold">Last Man Standing</SelectItem><SelectItem value="finish" className="font-bold text-destructive">Finish Innings Now</SelectItem></SelectContent></Select></div></div><DialogFooter><Button onClick={handleRetire} className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-black uppercase shadow-lg">Confirm Retirement</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="rounded-xl border-t-8 border-t-primary"><DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-center py-2">Assign Positions</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Striker</Label><Select value={activeInningData?.strikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Striker" /></SelectTrigger><SelectContent>{currentBattingSquad.filter(p => !definitivelyOutIds.has(p.id)).filter(p => p.id !== activeInningData?.nonStrikerPlayerId).map(p => (<SelectItem key={`bat-sel-striker-${p.id}`} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>{!activeInningData?.isLastManActive && (<div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Non-Striker</Label><Select value={activeInningData?.nonStrikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { nonStrikerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Non-Striker" /></SelectTrigger><SelectContent>{currentBattingSquad.filter(p => !definitivelyOutIds.has(p.id)).filter(p => p.id !== activeInningData?.strikerPlayerId).map(p => (<SelectItem key={`bat-sel-ns-${p.id}`} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>)}</div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Current Bowler</Label><Select value={activeInningData?.currentBowlerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { currentBowlerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Bowler" /></SelectTrigger><SelectContent>{currentBowlingSquad.map(p => (<SelectItem key={`bowl-sel-${p.id}`} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div></div><DialogFooter><Button onClick={() => setIsPlayerAssignmentOpen(false)} className="w-full h-14 font-black uppercase shadow-xl">Confirm Positions</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
