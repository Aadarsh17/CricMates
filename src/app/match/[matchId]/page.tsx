
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, serverTimestamp, getDoc, limit, getDocs, increment, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { History, CheckCircle2, Trophy, Star, ShieldAlert, UserPlus, Info, ChevronRight, AlertCircle, Edit2, Save, Settings2, ShieldCheck, PenTool, BarChart3, LineChart as LineChartIcon, Flag, User, Target, Zap, PlayCircle, Undo2, Users2, ArrowLeftRight, Clock, Calendar, BarChart, TrendingUp, Users, ChevronDown, ChevronUp, RefreshCw, Trash2, Download, FileText, Share2, Users as UsersIcon, Sparkles, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart as ReBarChart, Bar, Cell } from "recharts";
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { generateHTMLReport, getExtendedInningStats } from '@/lib/report-utils';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { generateMatchSummary } from '@/ai/flows/generate-match-summary';

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
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

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

  const [editForm, setEditForm] = useState({
    status: 'live',
    matchDate: '',
    tossWinner: '',
    tossDecision: 'bat',
    inn1Score: 0,
    inn1Wickets: 0,
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
    if (match && inn1) {
      setEditForm({
        status: match.status,
        matchDate: match.matchDate ? match.matchDate.split('T')[0] : new Date().toISOString().split('T')[0],
        tossWinner: match.tossWinnerTeamId || '',
        tossDecision: match.tossDecision || 'bat',
        inn1Score: inn1.score || 0,
        inn1Wickets: inn1.wickets || 0,
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

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || []), [inn1Deliveries]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || []), [inn2Deliveries]);

  const playerCVPList = useMemo(() => {
    if (!allPlayers) return [];
    const playerStats: Record<string, any> = {};
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

  const handleHandleAiSummary = async () => {
    if (!match || isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    try {
      const input = {
        matchId: match.id,
        matchOverall: {
          date: match.matchDate || '',
          totalOversScheduled: match.totalOvers,
          result: match.resultDescription || '',
          team1Name: getTeamName(match.team1Id),
          team2Name: getTeamName(match.team2Id),
          team1FinalScore: `${inn1?.score}/${inn1?.wickets}`,
          team2FinalScore: `${inn2?.score}/${inn2?.wickets}`,
          tossWinner: getTeamName(match.tossWinnerTeamId),
          tossDecision: match.tossDecision || 'bat'
        },
        inningsSummaries: [
          {
            inningNumber: 1,
            battingTeamName: getTeamName(inn1?.battingTeamId),
            bowlingTeamName: getTeamName(inn1?.bowlingTeamId),
            score: inn1?.score || 0,
            wickets: inn1?.wickets || 0,
            overs: parseFloat(`${inn1?.oversCompleted || 0}.${inn1?.ballsInCurrentOver || 0}`),
            topPerformersBatting: stats1.batting.slice(0, 3).map(b => ({ playerName: getPlayerName(b.id), runs: b.runs })),
            topPerformersBowling: stats1.bowling.slice(0, 3).map(b => ({ playerName: getPlayerName(b.id), wickets: b.wickets, runsConceded: b.runs, overs: parseFloat(b.oversDisplay), maidens: b.maidens || 0 })),
            keyMoments: stats1.fow.map(f => `Wicket ${f.wicketNum} at ${f.scoreAtWicket}`)
          },
          {
            inningNumber: 2,
            battingTeamName: getTeamName(inn2?.battingTeamId),
            bowlingTeamName: getTeamName(inn2?.bowlingTeamId),
            score: inn2?.score || 0,
            wickets: inn2?.wickets || 0,
            overs: parseFloat(`${inn2?.oversCompleted || 0}.${inn2?.ballsInCurrentOver || 0}`),
            topPerformersBatting: stats2.batting.slice(0, 3).map(b => ({ playerName: getPlayerName(b.id), runs: b.runs })),
            topPerformersBowling: stats2.bowling.slice(0, 3).map(b => ({ playerName: getPlayerName(b.id), wickets: b.wickets, runsConceded: b.runs, overs: parseFloat(b.oversDisplay), maidens: b.maidens || 0 })),
            keyMoments: stats2.fow.map(f => `Wicket ${f.wicketNum} at ${f.scoreAtWicket}`)
          }
        ],
        playerOverallPerformance: playerCVPList.map(p => ({
          playerName: p.name,
          teamName: '',
          role: 'Batsman' as any,
          cvpScore: p.cvp,
          battingStats: { runs: p.runs, ballsFaced: p.ballsFaced, strikeRate: p.ballsFaced > 0 ? (p.runs / p.ballsFaced) * 100 : 0, fours: p.fours, sixes: p.sixes },
          bowlingStats: { overs: p.ballsBowled / 6, maidens: p.maidens, runsConceded: p.runsConceded, wickets: p.wickets, economy: p.ballsBowled > 0 ? p.runsConceded / (p.ballsBowled / 6) : 0 }
        }))
      };
      const summary = await generateMatchSummary(input as any);
      setAiSummary(summary);
    } catch (e) {
      toast({ title: "AI Generation Failed", variant: "destructive" });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const isCurrentInningFinished = useMemo(() => {
    if (!match || !activeInningData) return false;
    return activeInningData.oversCompleted >= match.totalOvers || activeInningData.wickets >= 10;
  }, [match, activeInningData]);

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire || isCurrentInningFinished) return;
    if (!activeInningData.strikerPlayerId || !activeInningData.nonStrikerPlayerId || !activeInningData.currentBowlerPlayerId) {
      setIsPlayerAssignmentOpen(true);
      toast({ title: "Assignments Missing", variant: "destructive" });
      return;
    }
    const currentInningId = `inning_${match.currentInningNumber}`;
    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    let ballRuns = runs;
    let extraRuns = 0;
    let isLegalBall = true;
    if (extraType === 'wide') { extraRuns = runs + 1; ballRuns = 0; isLegalBall = false; }
    else if (extraType === 'noball') { extraRuns = 1; isLegalBall = false; }
    else if (extraType === 'bye' || extraType === 'legbye') { extraRuns = runs; ballRuns = 0; }
    const totalRunsOnDelivery = ballRuns + extraRuns;
    const newScore = activeInningData.score + totalRunsOnDelivery;
    let newBalls = activeInningData.ballsInCurrentOver + (isLegalBall ? 1 : 0);
    let newOvers = activeInningData.oversCompleted;
    if (newBalls === 6) { newOvers += 1; newBalls = 0; }
    const deliveryData = {
      id: doc(collection(db, 'temp')).id,
      overNumber: newBalls === 0 && isLegalBall ? newOvers : newOvers + 1,
      ballNumberInOver: newBalls === 0 && isLegalBall ? 6 : newBalls,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerPlayerId: activeInningData.currentBowlerPlayerId,
      runsScored: ballRuns, extraRuns, extraType, totalRunsOnDelivery,
      isWicket: false, timestamp: Date.now()
    };
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    updateDocumentNonBlocking(inningRef, {
      score: newScore, oversCompleted: newOvers, ballsInCurrentOver: newBalls,
      strikerPlayerId: runs % 2 !== 0 ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId,
      nonStrikerPlayerId: runs % 2 !== 0 ? activeInningData.strikerPlayerId : activeInningData.nonStrikerPlayerId
    });
    if (newBalls === 0 && isLegalBall && newOvers < match.totalOvers) {
      setIsPlayerAssignmentOpen(true);
      toast({ title: "Over Complete", description: "Assign next bowler." });
    }
  };

  const handleWicket = async () => {
    if (!match || !activeInningData || !isUmpire || !wicketForm.batterOutId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    const deliveryData = {
      id: doc(collection(db, 'temp')).id,
      overNumber: activeInningData.ballsInCurrentOver === 5 ? activeInningData.oversCompleted + 1 : activeInningData.oversCompleted + 1,
      ballNumberInOver: activeInningData.ballsInCurrentOver + 1,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerPlayerId: activeInningData.currentBowlerPlayerId,
      runsScored: 0, extraRuns: 0, extraType: 'none', totalRunsOnDelivery: 0,
      isWicket: true, dismissalType: wicketForm.type, batsmanOutPlayerId: wicketForm.batterOutId, fielderPlayerId: wicketForm.fielderId,
      timestamp: Date.now()
    };
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    const newWickets = activeInningData.wickets + 1;
    let newBalls = activeInningData.ballsInCurrentOver + 1;
    let newOvers = activeInningData.oversCompleted;
    if (newBalls === 6) { newOvers += 1; newBalls = 0; }
    updateDocumentNonBlocking(inningRef, {
      wickets: newWickets, oversCompleted: newOvers, ballsInCurrentOver: newBalls,
      strikerPlayerId: wicketForm.batterOutId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId,
      nonStrikerPlayerId: wicketForm.batterOutId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId
    });
    setIsWicketDialogOpen(false);
    toast({ title: "OUT!", variant: "destructive" });
    if (newWickets < 10) setIsPlayerAssignmentOpen(true);
  };

  const handleStartSecondInnings = async () => {
    if (!match || match.currentInningNumber !== 1 || !isUmpire) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), { currentInningNumber: 2 });
    batch.set(doc(db, 'matches', matchId, 'innings', 'inning_2'), {
      id: 'inning_2', matchId, inningNumber: 2, score: 0, wickets: 0,
      oversCompleted: 0, ballsInCurrentOver: 0,
      battingTeamId: inn1?.bowlingTeamId, bowlingTeamId: inn1?.battingTeamId,
      matchStatus: 'live'
    });
    await batch.commit();
    setIsPlayerAssignmentOpen(true);
  };

  const handleEndMatch = async () => {
    if (!match || !isUmpire) return;
    const resStr = calculateResult(inn1, inn2);
    updateDocumentNonBlocking(doc(db, 'matches', matchId), { 
      status: 'completed',
      resultDescription: resStr,
      potmPlayerId: topCVPPlayer?.id || '',
      potmCvpScore: topCVPPlayer?.cvp || 0
    });
    toast({ title: "Match Completed", description: resStr });
  };

  const calculateResult = (i1: any, i2: any) => {
    if (!i1 || !i2) return "Match in Progress";
    const s1 = i1.score || 0;
    const s2 = i2.score || 0;
    const t1 = getTeamName(i1.battingTeamId);
    const t2 = getTeamName(i2.battingTeamId);
    if (s1 > s2) return `${t1} won by ${s1 - s2} runs`;
    if (s2 > s1) return `${t2} won by ${10 - i2.wickets} wickets`;
    return "Match Tied";
  };

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center font-black animate-pulse">SYNCING MATCH...</div>;
  if (!match) return <div className="p-20 text-center">Match missing.</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="border-b bg-white p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-black truncate uppercase tracking-tighter">
              {getTeamName(match.team1Id)} <span className="text-slate-300 mx-1">VS</span> {getTeamName(match.team2Id)}
            </h1>
            <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-1">
              {match.status === 'completed' ? match.resultDescription : `Innings ${match.currentInningNumber} Active`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 text-secondary border-secondary hover:bg-secondary/5 font-black text-[10px] uppercase" onClick={() => generateHTMLReport(match, inn1, inn2, stats1, stats2, allTeams||[], allPlayers||[])}>
              <Download className="w-3 h-3 mr-1.5" /> Report
            </Button>
            {isUmpire && <Button size="sm" variant="outline" onClick={() => setIsEditFullMatchOpen(true)} className="h-8 px-3 font-black text-[10px] uppercase border-primary text-primary">Umpire Tools</Button>}
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-50 bg-white border-b shadow-sm overflow-x-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-start rounded-none bg-transparent h-auto p-0 scrollbar-hide">
            {['Live', 'Scorecard', 'Analytics', 'Overs', 'Info'].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase()} className="flex-1 px-4 py-4 text-xs font-black rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary uppercase tracking-widest whitespace-nowrap">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab}>
        <TabsContent value="live" className="space-y-6 pt-2">
          {match.status === 'completed' && (
             <Card className="border-l-4 border-l-amber-400 bg-amber-50/30">
               <CardContent className="p-4">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <Sparkles className="w-5 h-5 text-amber-500" />
                       <p className="text-xs font-black uppercase tracking-widest text-amber-900">AI Match Insight</p>
                    </div>
                    {!aiSummary && (
                       <Button size="sm" variant="ghost" className="text-[10px] font-black uppercase tracking-widest h-7" onClick={handleHandleAiSummary} disabled={isGeneratingSummary}>
                          {isGeneratingSummary ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                          Generate Summary
                       </Button>
                    )}
                 </div>
                 {aiSummary && (
                    <div className="mt-3 p-3 bg-white/80 rounded border border-amber-100 italic text-xs leading-relaxed text-slate-700 animate-in fade-in slide-in-from-top-1">
                       {aiSummary}
                    </div>
                 )}
               </CardContent>
             </Card>
          )}

          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[inn1, inn2].map((inn, idx) => inn && (
                <div key={idx} className={cn("p-4 rounded-xl border flex justify-between", match.currentInningNumber === idx+1 ? "bg-primary/5 border-primary" : "opacity-60 bg-slate-50")}>
                  <div><p className="text-[10px] font-black text-slate-400 uppercase">{getTeamName(inn.battingTeamId)}</p><h4 className="font-black text-xl">{inn.score}/{inn.wickets}</h4></div>
                  <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Overs</p><h4 className="font-bold">{inn.oversCompleted}.{inn.ballsInCurrentOver}</h4></div>
                </div>
              ))}
            </div>

            {isUmpire && match.status === 'live' && activeInningData && (
              <div className="space-y-6">
                {!isCurrentInningFinished ? (
                  <>
                    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg cursor-pointer" onClick={() => setIsPlayerAssignmentOpen(true)}>
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-primary uppercase">On Strike</p>
                          <p className="text-sm font-black">{getPlayerName(activeInningData.strikerPlayerId)}*</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">Non-Strike: {getPlayerName(activeInningData.nonStrikerPlayerId)}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Current Bowler</p>
                          <p className="text-sm font-black">{getPlayerName(activeInningData.currentBowlerPlayerId)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2, 3, 4, 6].map(r => <Button key={r} onClick={() => handleRecordBall(r)} className="h-16 font-black text-2xl bg-white text-slate-900 border-2 border-slate-200 hover:border-primary shadow-sm">{r === 0 ? "•" : r}</Button>)}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-14 font-black text-amber-700 bg-amber-50 uppercase tracking-widest text-xs">WIDE</Button>
                      <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-14 font-black text-amber-700 bg-amber-50 uppercase tracking-widest text-xs">NO BALL</Button>
                      <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-14 font-black text-red-700 bg-red-50 uppercase tracking-widest text-xs">WICKET</Button>
                      <Button variant="outline" onClick={handleEndMatch} className="h-14 font-black text-secondary bg-secondary/5 uppercase tracking-widest text-xs border-secondary/20">FINISH MATCH</Button>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center space-y-6 border-2 border-dashed rounded-3xl bg-slate-50/50">
                    <div><CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" /><h3 className="text-xl font-black uppercase tracking-tight">Innings Complete</h3><p className="text-xs font-medium text-slate-500 mt-1">{activeInningData.wickets >= 10 ? "All Out!" : `${match.totalOvers} Overs Completed.`}</p></div>
                    {match.currentInningNumber === 1 ? <Button onClick={handleStartSecondInnings} className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-xl">START 2ND INNINGS <ArrowLeftRight className="ml-2 w-6 h-6" /></Button> : <Button onClick={handleEndMatch} className="w-full h-16 text-lg font-black uppercase tracking-widest bg-secondary shadow-xl">FINALIZE MATCH <Trophy className="ml-2 w-6 h-6" /></Button>}
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="scorecard" className="space-y-4 pt-4">
           <div className="flex gap-2 mb-4">
              <Button size="sm" variant={activeInningView === 1 ? 'default' : 'outline'} onClick={() => setActiveInningView(1)} className="font-black text-[10px] uppercase">1st Innings</Button>
              {match.currentInningNumber >= 2 && <Button size="sm" variant={activeInningView === 2 ? 'default' : 'outline'} onClick={() => setActiveInningView(2)} className="font-black text-[10px] uppercase">2nd Innings</Button>}
           </div>
           <Card className="rounded-xl overflow-hidden border shadow-sm">
              <Table>
                 <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[8px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[8px] font-black uppercase">R</TableHead><TableHead className="text-right text-[8px] font-black uppercase">B</TableHead><TableHead className="text-right text-[8px] font-black uppercase">4s/6s</TableHead><TableHead className="text-right text-[8px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                 <TableBody>
                   {currentInningStats.batting.map(b => (
                     <TableRow key={b.id}>
                       <TableCell className="py-2"><p className="font-bold text-xs">{getPlayerName(b.id)}</p><p className="text-[8px] text-slate-400 italic">{b.out ? `(${b.dismissal})` : '(not out)'}</p></TableCell>
                       <TableCell className="text-right font-black text-sm">{b.runs}</TableCell><TableCell className="text-right text-xs text-slate-500">{b.balls}</TableCell><TableCell className="text-right text-xs">{b.fours}/{b.sixes}</TableCell><TableCell className="text-right text-[10px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 pt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                 <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest">Partnership Breakdown</CardTitle></CardHeader>
                 <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <ReBarChart data={currentInningStats.partnerships}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey={(p: any) => `${getPlayerName(p.batter1Id).split(' ')[0]}-${getPlayerName(p.batter2Id).split(' ')[0]}`} fontSize={8} interval={0} tick={{ fill: '#94a3b8' }} />
                          <YAxis fontSize={8} tick={{ fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                          <Bar dataKey="runs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                       </ReBarChart>
                    </ResponsiveContainer>
                 </CardContent>
              </Card>

              <Card className="shadow-sm">
                 <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest">Top CVP Performers</CardTitle></CardHeader>
                 <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <ReBarChart data={playerCVPList.slice(0, 5)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" fontSize={8} hide />
                          <YAxis dataKey="name" type="category" fontSize={8} tick={{ fill: '#94a3b8' }} width={80} />
                          <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                          <Bar dataKey="cvp" radius={[0, 4, 4, 0]}>
                             {playerCVPList.slice(0, 5).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))'} />
                             ))}
                          </Bar>
                       </ReBarChart>
                    </ResponsiveContainer>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditFullMatchOpen} onOpenChange={setIsEditFullMatchOpen}>
        <DialogContent className="max-w-2xl rounded-xl border-t-8 border-t-primary">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> CORRECTION ENGINE</DialogTitle></DialogHeader>
          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-6"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Match Status</Label><Select value={editForm.status} onValueChange={v => setEditForm({...editForm, status: v})}><SelectTrigger className="font-bold h-12 shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="live">Live</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div></div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Result Description</Label><Input value={editForm.resultDescription} onChange={e => setEditForm({...editForm, resultDescription: e.target.value})} className="font-bold text-primary h-12 shadow-sm" /></div>
          </div>
          <DialogFooter><Button onClick={() => setIsEditFullMatchOpen(false)} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl">SAVE CORRECTIONS</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="rounded-xl border-t-8 border-t-destructive">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest">Register Wicket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Wicket Type</Label><Select value={wicketForm.type} onValueChange={v => setWicketForm({...wicketForm, type: v})}><SelectTrigger className="font-bold"><SelectValue /></SelectTrigger><SelectContent>{['bowled', 'caught', 'lbw', 'runout', 'stumped'].map(t => <SelectItem key={t} value={t} className="uppercase font-bold text-[10px]">{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label><Select value={wicketForm.batterOutId} onValueChange={v => setWicketForm({...wicketForm, batterOutId: v})}><SelectTrigger className="font-bold"><SelectValue placeholder="Select Batter" /></SelectTrigger><SelectContent><SelectItem value={activeInningData?.strikerPlayerId || 'none'}>{getPlayerName(activeInningData?.strikerPlayerId || '')}</SelectItem><SelectItem value={activeInningData?.nonStrikerPlayerId || 'none'}>{getPlayerName(activeInningData?.nonStrikerPlayerId || '')}</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={handleWicket} className="w-full h-12 font-black uppercase tracking-widest">Confirm Wicket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Assign Positions</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-[10px] font-black">Striker</Label><Select value={activeInningData?.strikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: v })}><SelectTrigger><SelectValue placeholder="Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => p.id !== activeInningData?.nonStrikerPlayerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-[10px] font-black">Bowler</Label><Select value={activeInningData?.currentBowlerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { currentBowlerPlayerId: v })}><SelectTrigger><SelectValue placeholder="Bowler" /></SelectTrigger><SelectContent>{allPlayers?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button onClick={() => setIsPlayerAssignmentOpen(false)} className="w-full h-12 font-black">CONFIRM</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
