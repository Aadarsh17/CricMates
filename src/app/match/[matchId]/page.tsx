
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { History, CheckCircle2, Trophy, Star, ShieldAlert, UserPlus, Info, ChevronRight, AlertCircle, Edit2, Save, Settings2, ShieldCheck, PenTool, BarChart3, LineChart as LineChartIcon, Flag, User, Target, Zap, PlayCircle, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { calculatePlayerCVP, type PlayerMatchStats } from '@/lib/cvp-utils';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  Cell
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isBowlerDialogOpen, setIsBowlerDialogOpen] = useState(false);
  const [isEditFullMatchOpen, setIsEditFullMatchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activeInningView, setActiveInningView] = useState<number>(1);

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
    bowlerId: ''
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

  const activeInningData = match?.currentInningNumber === 1 ? inn1 : inn2;

  useEffect(() => {
    if (match?.currentInningNumber && activeTab === 'live') {
      setActiveInningView(match.currentInningNumber);
    }
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
        bowlerId: activeInningData?.currentBowlerPlayerId || ''
      });
    }
  }, [match, inn1, inn2, activeInningData]);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const getPlayer = (pid: string) => allPlayers?.find(p => p.id === pid);
  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none' || pid === '') return '---';
    const p = getPlayer(pid);
    return p ? p.name : 'Unknown Player';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    const t = allTeams?.find(t => t.id === tid);
    return t ? t.name : 'Unknown Team';
  };

  const getAbbr = (name: string) => (name || 'UNK').substring(0, 3).toUpperCase();

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

  // Auto result logic
  useEffect(() => {
    if (!match || !allTeams) return;
    const team1Name = getTeamName(match.team1Id);
    const team2Name = getTeamName(match.team2Id);
    
    let result = '';
    if (editForm.inn2Score === 0 && editForm.inn1Score > 0) result = "Match in Progress";
    else if (editForm.inn1Score > editForm.inn2Score && editForm.status === 'completed') result = `${team1Name} won by ${editForm.inn1Score - editForm.inn2Score} runs`;
    else if (editForm.inn2Score > editForm.inn1Score && editForm.status === 'completed') result = `${team2Name} won by ${10 - editForm.inn2Wickets} wickets`;
    else if (editForm.inn1Score === editForm.inn2Score && editForm.status === 'completed' && editForm.inn2Score > 0) result = "Match Tied";
    else result = match.resultDescription || "Match in Progress";
    
    setEditForm(prev => ({ ...prev, resultDescription: result }));
  }, [editForm.inn1Score, editForm.inn2Score, editForm.inn1Wickets, editForm.inn2Wickets, editForm.status]);

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire) return;

    if (!activeInningData.strikerPlayerId || !activeInningData.nonStrikerPlayerId || !activeInningData.currentBowlerPlayerId) {
      setIsBowlerDialogOpen(true);
      toast({ title: "Setup Required", description: "Please assign players first.", variant: "destructive" });
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
      setIsBowlerDialogOpen(true);
      toast({ title: "Over Complete", description: "Select next bowler." });
    }
  };

  const handleUndo = async () => {
    if (!match || !activeInningData || !isUmpire) return;

    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveries = match.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;
    
    if (!deliveries || deliveries.length === 0) {
      toast({ title: "Nothing to undo", description: "No deliveries found in this inning.", variant: "destructive" });
      return;
    }

    const lastBall = deliveries[deliveries.length - 1];
    const isLegal = lastBall.extraType !== 'wide' && lastBall.extraType !== 'noball';
    
    let oldBalls = activeInningData.ballsInCurrentOver - (isLegal ? 1 : 0);
    let oldOvers = activeInningData.oversCompleted;

    if (oldBalls < 0) {
      oldOvers -= 1;
      oldBalls = 5;
    }

    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    const lastBallRef = doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', lastBall.id);

    updateDocumentNonBlocking(inningRef, {
      score: activeInningData.score - lastBall.totalRunsOnDelivery,
      wickets: activeInningData.wickets - (lastBall.isWicket ? 1 : 0),
      oversCompleted: Math.max(0, oldOvers),
      ballsInCurrentOver: Math.max(0, oldBalls),
      strikerPlayerId: lastBall.strikerPlayerId,
      nonStrikerPlayerId: lastBall.nonStrikerPlayerId,
      currentBowlerPlayerId: lastBall.bowlerPlayerId
    });

    deleteDocumentNonBlocking(lastBallRef);
    toast({ title: "Last Ball Undone", description: "Scorecard reverted." });
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
      outcomeDescription: `${wicketForm.type} ${wicketForm.fielderId !== 'none' ? 'by ' + getPlayerName(wicketForm.fielderId) : ''}`,
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
    setIsBowlerDialogOpen(true); // Pick new batter
  };

  const handleUpdateFullMatch = async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), {
      status: editForm.status,
      matchDate: new Date(editForm.matchDate).toISOString(),
      tossWinnerTeamId: editForm.tossWinner,
      tossDecision: editForm.tossDecision,
      resultDescription: editForm.resultDescription
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
      strikerPlayerId: editForm.strikerId,
      nonStrikerPlayerId: editForm.nonStrikerId,
      currentBowlerPlayerId: editForm.bowlerId
    });
    await batch.commit();
    setIsEditFullMatchOpen(false);
    toast({ title: "Match Updated" });
  };

  const handleStart2ndInnings = async () => {
    if (!match || !inn1 || !isUmpire) return;
    const inn2Id = 'inning_2';
    const battingTeamId = inn1.bowlingTeamId;
    const bowlingTeamId = inn1.battingTeamId;
    const inningData = {
      id: inn2Id,
      matchId: matchId,
      inningNumber: 2,
      battingTeamId,
      bowlingTeamId,
      score: 0,
      wickets: 0,
      oversCompleted: 0,
      ballsInCurrentOver: 0,
      strikerPlayerId: '',
      nonStrikerPlayerId: '',
      currentBowlerPlayerId: '',
      umpireId: user?.uid || 'anonymous',
      matchStatus: 'live'
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'matches', matchId, 'innings', inn2Id), inningData);
    batch.update(doc(db, 'matches', matchId), { currentInningNumber: 2 });
    await batch.commit();
    setIsBowlerDialogOpen(true);
    toast({ title: "2nd Innings Started", description: "Select openers and bowler." });
  };

  const handleEndMatch = async () => {
    if (!match || !inn1 || !allTeams) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), { status: 'completed' });
    await batch.commit();
    toast({ title: "Match Concluded", description: "Final stats updated." });
  };

  const groupedOvers = useMemo(() => {
    const deliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;
    if (!deliveries) return [];
    const oversMap: Record<number, any> = {};
    let runScore = 0; let runWkts = 0;
    [...(deliveries || [])].sort((a,b) => a.timestamp - b.timestamp).forEach(d => {
      runScore += d.totalRunsOnDelivery; if (d.isWicket) runWkts++;
      if (!oversMap[d.overNumber]) oversMap[d.overNumber] = { overNumber: d.overNumber, balls: [], overRuns: 0, score: 0, wkts: 0, bowlerId: d.bowlerPlayerId };
      oversMap[d.overNumber].balls.push(d);
      oversMap[d.overNumber].overRuns += d.totalRunsOnDelivery;
      oversMap[d.overNumber].score = runScore;
      oversMap[d.overNumber].wkts = runWkts;
    });
    return Object.values(oversMap).sort((a,b) => b.overNumber - a.overNumber);
  }, [activeInningView, inn1Deliveries, inn2Deliveries]);

  const chartData = useMemo(() => {
    if (!inn1Deliveries || !match) return { worm: [] };
    const worm: any[] = [{ over: 0, inn1: 0, inn2: 0 }];
    let c1 = 0;
    inn1Deliveries.forEach(d => {
      c1 += d.totalRunsOnDelivery;
      if (d.ballNumberInOver === 6) worm.push({ over: d.overNumber, inn1: c1, inn2: null });
    });
    return { worm };
  }, [inn1Deliveries, match]);

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

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="border-b bg-white p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl md:text-2xl font-black">{getTeamName(match.team1Id)} <span className="text-slate-300">VS</span> {getTeamName(match.team2Id)}</h1>
            <p className="text-[10px] font-black uppercase text-primary tracking-widest">{match.status === 'completed' ? match.resultDescription : `Innings ${match.currentInningNumber}`}</p>
          </div>
          {isUmpire && <Button size="sm" variant="outline" onClick={() => setIsEditFullMatchOpen(true)} className="rounded-full h-8 px-3 font-black text-[10px] uppercase"><ShieldCheck className="w-3 h-3 mr-1" /> Umpire Tools</Button>}
        </div>
      </div>

      <div className="sticky top-16 z-50 bg-white border-b shadow-sm overflow-x-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-start rounded-none bg-transparent h-auto p-0 scrollbar-hide">
            {['Info', 'Live', 'Scorecard', 'Overs', 'Charts'].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase()} className="flex-1 px-4 py-4 text-xs font-black rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary uppercase tracking-widest">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab}>
        <TabsContent value="live" className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inn1 && <div className={cn("p-4 rounded-xl border flex justify-between", match.currentInningNumber === 1 ? "bg-primary/5 border-primary shadow-sm" : "bg-slate-50 opacity-60")}><div><p className="text-[10px] font-black text-slate-400 uppercase">{getTeamName(inn1.battingTeamId)}</p><h4 className="font-black text-xl">{inn1.score}/{inn1.wickets}</h4></div><div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Overs</p><h4 className="font-bold">{inn1.oversCompleted}.{inn1.ballsInCurrentOver}</h4></div></div>}
              {inn2 && <div className={cn("p-4 rounded-xl border flex justify-between", match.currentInningNumber === 2 ? "bg-primary/5 border-primary shadow-sm" : "bg-slate-50 opacity-60")}><div><p className="text-[10px] font-black text-slate-400 uppercase">{getTeamName(inn2.battingTeamId)}</p><h4 className="font-black text-xl">{inn2.score}/{inn2.wickets}</h4></div><div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Overs</p><h4 className="font-bold">{inn2.oversCompleted}.{inn2.ballsInCurrentOver}</h4></div></div>}
            </div>

            {isUmpire && match.status === 'live' && activeInningData && (
              <div className="space-y-6">
                <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center font-black text-xs">BAT</div>
                    <div>
                      <p className="text-[9px] font-black text-primary uppercase">On Strike</p>
                      <p className="text-sm font-black">{getPlayerName(activeInningData.strikerPlayerId)}*</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Current Bowler</p>
                    <p className="text-sm font-black">{getPlayerName(activeInningData.currentBowlerPlayerId)}</p>
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
                  <Button variant="outline" onClick={handleUndo} className="h-14 font-black text-slate-600 bg-slate-50 uppercase tracking-widest text-xs"><Undo2 className="w-4 h-4 mr-2" /> Undo Ball</Button>
                </div>

                <div className="pt-4 space-y-3">
                  {match.currentInningNumber === 1 && <Button onClick={handleStart2ndInnings} className="w-full h-14 bg-secondary font-black uppercase tracking-widest shadow-lg"><PlayCircle className="w-5 h-5 mr-2" /> Start 2nd Innings</Button>}
                  <Button onClick={handleEndMatch} variant="destructive" className="w-full font-black uppercase text-sm h-14 tracking-widest shadow-xl"><CheckCircle2 className="w-5 h-5 mr-2" /> Finish Match</Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overs" className="divide-y bg-white rounded-lg border shadow-sm">
          <div className="flex gap-2 p-4 border-b bg-slate-50/50">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-black h-8 px-4">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-black h-8 px-4" disabled={!inn2}>Innings 2</Button>
          </div>
          {groupedOvers.map(o => (
            <div key={o.overNumber} className="p-4 flex flex-col md:flex-row gap-4 hover:bg-slate-50">
              <div className="min-w-[140px]"><p className="font-black text-sm">Over {o.overNumber} <span className="text-slate-400 font-bold ml-1">- {o.overRuns} runs</span></p></div>
              <div className="flex-1 space-y-3">
                <p className="text-xs font-bold text-slate-700">Bowler: {getPlayerName(o.bowlerId)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {o.balls.map((b: any, i: number) => {
                    let color = 'bg-slate-400'; let txt = b.totalRunsOnDelivery;
                    if (b.isWicket) { color = 'bg-red-600'; txt = 'W'; }
                    else if (b.runsScored === 6) color = 'bg-purple-600';
                    else if (b.runsScored === 4) color = 'bg-blue-600';
                    return (<div key={i} className={cn("w-8 h-8 flex items-center justify-center rounded-sm text-[10px] font-black text-white shadow-sm", color)}>{txt}</div>);
                  })}
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <Dialog open={isEditFullMatchOpen} onOpenChange={setIsEditFullMatchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Full Correction Editor</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-[10px] font-black">Status</Label><Select value={editForm.status} onValueChange={v => setEditForm({...editForm, status: v})}><SelectTrigger className="font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="live">Live</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[10px] font-black">Match Date</Label><Input type="date" value={editForm.matchDate} onChange={e => setEditForm({...editForm, matchDate: e.target.value})} className="font-bold" /></div>
            </div>
            <div className="p-4 border rounded-xl bg-slate-50">
              <p className="text-[10px] font-black mb-3 text-slate-500 uppercase">On-Field Assignment</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[8px] font-black">Striker</Label>
                  <Select value={editForm.strikerId} onValueChange={v => setEditForm({...editForm, strikerId: v})}>
                    <SelectTrigger className="font-bold text-xs h-9"><SelectValue placeholder="Striker" /></SelectTrigger>
                    <SelectContent>{battingPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[8px] font-black">Non-Striker</Label>
                  <Select value={editForm.nonStrikerId} onValueChange={v => setEditForm({...editForm, nonStrikerId: v})}>
                    <SelectTrigger className="font-bold text-xs h-9"><SelectValue placeholder="Non-Striker" /></SelectTrigger>
                    <SelectContent>{battingPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[8px] font-black">Bowler</Label>
                  <Select value={editForm.bowlerId} onValueChange={v => setEditForm({...editForm, bowlerId: v})}>
                    <SelectTrigger className="font-bold text-xs h-9"><SelectValue placeholder="Bowler" /></SelectTrigger>
                    <SelectContent>{bowlingPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {[{idx: 1, s: editForm.inn1Score, w: editForm.inn1Wickets, o: editForm.inn1Overs, b: editForm.inn1Balls}, {idx: 2, s: editForm.inn2Score, w: editForm.inn2Wickets, o: editForm.inn2Overs, b: editForm.inn2Balls}].map(i => (
              <div key={i.idx} className="p-4 border rounded-xl bg-slate-50">
                <p className="text-[10px] font-black mb-3 text-slate-500 uppercase">Innings {i.idx} Manual Override</p>
                <div className="grid grid-cols-4 gap-2">
                  <div><Label className="text-[8px] font-black">Runs</Label><Input type="number" onFocus={e => e.target.select()} value={i.s} onChange={e => setEditForm({...editForm, [`inn${i.idx}Score`]: parseInt(e.target.value)||0})} className="font-black" /></div>
                  <div><Label className="text-[8px] font-black">Wkts</Label><Input type="number" onFocus={e => e.target.select()} value={i.w} onChange={e => setEditForm({...editForm, [`inn${i.idx}Wickets`]: parseInt(e.target.value)||0})} className="font-black" /></div>
                  <div><Label className="text-[8px] font-black">Overs</Label><Input type="number" onFocus={e => e.target.select()} value={i.o} onChange={e => setEditForm({...editForm, [`inn${i.idx}Overs`]: parseInt(e.target.value)||0})} className="font-black" /></div>
                  <div><Label className="text-[8px] font-black">Balls</Label><Input type="number" onFocus={e => e.target.select()} value={i.b} onChange={e => setEditForm({...editForm, [`inn${i.idx}Balls`]: parseInt(e.target.value)||0})} className="font-black" /></div>
                </div>
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-[10px] font-black">Final Result Description (Calculated)</Label>
              <Input value={editForm.resultDescription} onChange={e => setEditForm({...editForm, resultDescription: e.target.value})} className="font-bold text-primary" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateFullMatch} className="w-full h-12 font-black uppercase tracking-widest"><Save className="w-4 h-4 mr-2" /> Save Corrections</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBowlerDialogOpen} onOpenChange={setIsBowlerDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Assign On-Field Players</DialogTitle></DialogHeader>
          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black">Current Bowler</Label>
              <Select value={activeInningData?.currentBowlerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { currentBowlerPlayerId: v })}>
                <SelectTrigger className="font-bold h-12"><SelectValue placeholder="Choose Bowler" /></SelectTrigger>
                <SelectContent>{bowlingPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!activeInningData?.strikerPlayerId && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black">Striker (On-Strike)</Label>
                <Select onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: v })}>
                  <SelectTrigger className="font-bold h-12"><SelectValue placeholder="Choose Striker" /></SelectTrigger>
                  <SelectContent>{battingPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {!activeInningData?.nonStrikerPlayerId && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black">Non-Striker</Label>
                <Select onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { nonStrikerPlayerId: v })}>
                  <SelectTrigger className="font-bold h-12"><SelectValue placeholder="Choose Non-Striker" /></SelectTrigger>
                  <SelectContent>{battingPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={() => setIsBowlerDialogOpen(false)} className="w-full h-12 mt-4 font-black uppercase">Close & Continue</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Record Wicket</DialogTitle></DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <Label className="text-[10px] font-black">Batter Out</Label>
              <Select onValueChange={v => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger><SelectValue placeholder="Who is out?" /></SelectTrigger>
                <SelectContent>
                  {activeInningData?.strikerPlayerId && (
                    <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)}</SelectItem>
                  )}
                  {activeInningData?.nonStrikerPlayerId && (
                    <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px] font-black">Dismissal Type</Label><Select value={wicketForm.type} onValueChange={v => setWicketForm({...wicketForm, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="catch">Caught</SelectItem><SelectItem value="lbw">LBW</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumping">Stumped</SelectItem></SelectContent></Select></div>
            <div><Label className="text-[10px] font-black">Fielder (Optional)</Label><Select onValueChange={v => setWicketForm({...wicketForm, fielderId: v})}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{allPlayers?.filter(p => p.teamId === activeInningData?.bowlingTeamId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button onClick={handleWicket} className="w-full h-12 font-black uppercase tracking-widest" disabled={!wicketForm.batterOutId}>Confirm OUT</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
