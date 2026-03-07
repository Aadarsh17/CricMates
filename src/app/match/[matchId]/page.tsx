"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Info, Trash2, Download, Loader2, Zap, LineChart as LineChartIcon, BarChart, ChevronRight, History, PlayCircle, CheckCircle2, Star, Users, Clock, Calendar as CalendarIcon, Undo2, AlertCircle, UserCheck, ArrowLeftRight, Share2, Camera, X, ShieldCheck, UserMinus, UserPlus, TrendingUp, Flag, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, BarChart as ReBarChart, Bar, Cell } from "recharts";
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { generateHTMLReport, getExtendedInningStats } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { calculatePlayerCVP } from '@/lib/cvp-utils';

const CustomWicketDot = (props: any) => {
  const { cx, cy, payload, team } = props;
  const isWicket = team === 'team1' ? payload.team1Wicket : payload.team2Wicket;
  if (!isWicket) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
      <text x={cx} y={cy + 3} textAnchor="middle" fill="#fff" fontSize="8px" fontWeight="900">W</text>
    </g>
  );
};

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { isUmpire } = useApp();
  
  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activeScorecardSubTab, setActiveScorecardSubTab] = useState<'inn1' | 'inn2'>('inn1');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);

  const [wicketForm, setWicketForm] = useState({
    type: 'bowled',
    batterOutId: '',
    fielderId: 'none',
    decision: 'next'
  });

  const [assignmentForm, setAssignmentForm] = useState({
    strikerId: '',
    nonStrikerId: '',
    bowlerId: ''
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
  const { data: inn1Deliveries } = useCollection(inn1DeliveriesQuery);

  const inn2DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn2Deliveries } = useCollection(inn2DeliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || []), [inn1Deliveries]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || []), [inn2Deliveries]);

  const chartData = useMemo(() => {
    if (!inn1Deliveries && !inn2Deliveries) return [];
    const maxOvers = match?.totalOvers || 6;
    const data = [];
    let cum1 = 0; let cum2 = 0;
    
    for (let i = 0; i <= maxOvers * 6; i++) {
      const over = Math.floor(i / 6);
      
      const d1 = inn1Deliveries?.find(d => {
        const legalBallsBefore = inn1Deliveries.filter(prev => 
          prev.timestamp < d.timestamp && (prev.extraType === 'none' || prev.extraType === 'bye' || prev.extraType === 'legbye')
        ).length;
        return legalBallsBefore === i - 1 && (d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye');
      });
      if (d1) cum1 += d1.totalRunsOnDelivery;

      const d2 = inn2Deliveries?.find(d => {
        const legalBallsBefore = inn2Deliveries.filter(prev => 
          prev.timestamp < d.timestamp && (prev.extraType === 'none' || prev.extraType === 'bye' || prev.extraType === 'legbye')
        ).length;
        return legalBallsBefore === i - 1 && (d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye');
      });
      if (d2) cum2 += d2.totalRunsOnDelivery;

      if (i % 6 === 0) {
        data.push({ 
          label: over.toString(), 
          team1: cum1, 
          team2: (inn2Deliveries && inn2Deliveries.length > 0) || cum2 > 0 ? cum2 : null,
          team1Wicket: inn1Deliveries?.some(d => d.isWicket && Math.floor((inn1Deliveries.filter(p => p.timestamp <= d.timestamp && (p.extraType === 'none' || p.extraType === 'bye' || p.extraType === 'legbye')).length - 1) / 6) === over),
          team2Wicket: inn2Deliveries?.some(d => d.isWicket && Math.floor((inn2Deliveries.filter(p => p.timestamp <= d.timestamp && (p.extraType === 'none' || p.extraType === 'bye' || p.extraType === 'legbye')).length - 1) / 6) === over)
        });
      }
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries, match?.totalOvers]);

  const overByOverData = useMemo(() => {
    if (!match) return [];
    const maxOvers = match.totalOvers;
    const data = [];
    
    for (let i = 1; i <= maxOvers; i++) {
      const inn1Runs = inn1Deliveries?.filter(d => d.overNumber === i).reduce((sum, d) => sum + d.totalRunsOnDelivery, 0) || 0;
      const inn2Runs = inn2Deliveries?.filter(d => d.overNumber === i).reduce((sum, d) => sum + d.totalRunsOnDelivery, 0) || 0;
      data.push({ over: i, team1: inn1Runs, team2: inn2Runs });
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries, match]);

  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none' || pid === '') return '---';
    return allPlayers?.find(p => p.id === pid)?.name || '---';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    return allTeams?.find(t => t.id === tid)?.name || 'Unknown Team';
  };

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const battingSquadPlayerIds = useMemo(() => {
    if (!match || !activeInningData) return [];
    return activeInningData.battingTeamId === match.team1Id 
      ? (match.team1SquadPlayerIds || []) 
      : (match.team2SquadPlayerIds || []);
  }, [match, activeInningData]);

  const bowlingSquadPlayerIds = useMemo(() => {
    if (!match || !activeInningData) return [];
    return activeInningData.battingTeamId === match.team1Id 
      ? (match.team2SquadPlayerIds || []) 
      : (match.team1SquadPlayerIds || []);
  }, [match, activeInningData]);

  const recalculateInningState = async (inningId: string) => {
    if (!match) return;
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snapshot = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveries = snapshot.docs.map(d => d.data());
    
    let totalScore = 0;
    let totalWickets = 0;
    let legalBalls = 0;
    
    deliveries.forEach(d => {
      totalScore += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && d.dismissalType !== 'retired') totalWickets++;
      if (d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye') legalBalls++;
    });

    const lastBall = deliveries[deliveries.length - 1];
    const updates: any = {
      score: Math.max(0, totalScore),
      wickets: Math.max(0, totalWickets),
      oversCompleted: Math.floor(legalBalls / 6),
      ballsInCurrentOver: legalBalls % 6,
      isDeclaredFinished: Math.floor(legalBalls / 6) >= match.totalOvers,
      isLastManActive: false
    };

    if (lastBall) {
      updates.strikerPlayerId = lastBall.strikerPlayerId;
      updates.nonStrikerPlayerId = lastBall.nonStrikerPlayerId;
      updates.currentBowlerPlayerId = lastBall.bowlerId;
    } else {
      updates.strikerPlayerId = '';
      updates.nonStrikerPlayerId = '';
      updates.currentBowlerPlayerId = '';
    }

    if (inningId === 'inning_2' && inn1) {
      if (totalScore > inn1.score) {
        updates.isDeclaredFinished = true;
      }
    }

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates, { merge: true });
    
    if (match.status === 'completed') {
      await setDocumentNonBlocking(matchRef, { status: 'live', currentInningNumber: inningId === 'inning_1' ? 1 : 2 }, { merge: true });
    }
  };

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none', noStrikeChange: boolean = false) => {
    if (!match || !activeInningData || !isUmpire) return;
    
    if (activeInningData.oversCompleted >= match.totalOvers && activeInningData.ballsInCurrentOver === 0) {
      toast({ title: "Innings Complete", description: "The maximum overs have been reached." });
      return;
    }

    if (!activeInningData.currentBowlerPlayerId) { 
      setAssignmentForm({ 
        strikerId: activeInningData.strikerPlayerId, 
        nonStrikerId: activeInningData.nonStrikerPlayerId || '', 
        bowlerId: '' 
      });
      setIsPlayerAssignmentOpen(true); 
      return; 
    }

    const currentInningId = `inning_${match.currentInningNumber}`;
    let ballRuns = runs; let extraRuns = 0; let isLegalBall = true;
    if (extraType === 'wide') { extraRuns = runs + 1; ballRuns = 0; isLegalBall = false; }
    else if (extraType === 'noball') { extraRuns = 1; ballRuns = runs; isLegalBall = false; }
    else if (extraType === 'bye' || extraType === 'legbye') { extraRuns = runs; ballRuns = 0; }
    
    const totalRunsOnDelivery = ballRuns + extraRuns;
    const newTotalScore = activeInningData.score + totalRunsOnDelivery;
    
    let newBallsInOver = activeInningData.ballsInCurrentOver + (isLegalBall ? 1 : 0);
    let newOversComp = activeInningData.oversCompleted;
    let shouldClearBowler = false;
    let needsOverEndRotation = false;

    if (newBallsInOver === 6) { 
      newOversComp += 1; 
      newBallsInOver = 0; 
      shouldClearBowler = true;
      needsOverEndRotation = true;
    }

    let nextStriker = activeInningData.strikerPlayerId;
    let nextNonStriker = activeInningData.nonStrikerPlayerId || 'none';

    if (!activeInningData.isLastManActive && !noStrikeChange && runs % 2 !== 0) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }

    if (needsOverEndRotation && !activeInningData.isLastManActive) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }

    const deliveryId = doc(collection(db, 'temp')).id;
    const deliveryData = { 
      id: deliveryId, 
      overNumber: (newBallsInOver === 0 && isLegalBall) ? newOversComp : newOversComp + 1, 
      ballNumberInOver: (newBallsInOver === 0 && isLegalBall) ? 6 : newBallsInOver, 
      strikerPlayerId: activeInningData.strikerPlayerId, 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', 
      bowlerId: activeInningData.currentBowlerPlayerId, 
      runsScored: ballRuns, 
      extraRuns, 
      extraType, 
      totalRunsOnDelivery, 
      isWicket: false, 
      timestamp: Date.now(), 
      noStrikeChange 
    };
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    const updates: any = { 
      score: Math.max(0, newTotalScore), 
      oversCompleted: newOversComp, 
      ballsInCurrentOver: newBallsInOver,
      strikerPlayerId: nextStriker,
      nonStrikerPlayerId: nextNonStriker
    };
    
    if (match.currentInningNumber === 1) {
      if (newOversComp >= match.totalOvers) {
        updates.isDeclaredFinished = true;
      }
    } else {
      if (inn1 && newTotalScore > inn1.score) {
        updates.isDeclaredFinished = true;
        toast({ title: "Victory!", description: "Target reached." });
      } else if (newOversComp >= match.totalOvers) {
        updates.isDeclaredFinished = true;
      }
    }

    if (shouldClearBowler) updates.currentBowlerPlayerId = '';
    
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    if (shouldClearBowler && !updates.isDeclaredFinished) setIsPlayerAssignmentOpen(true);
  };

  const handleManualEndInnings = () => {
    if (!match || !activeInningData || !isUmpire) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), { isDeclaredFinished: true });
    toast({ title: "Innings Declared End" });
  };

  const handleStartSecondInnings = () => {
    if (!match || !inn1 || !isUmpire) return;
    const battingTeamId = inn1.bowlingTeamId;
    const bowlingTeamId = inn1.battingTeamId;
    const inningData = { id: 'inning_2', matchId: matchId, inningNumber: 2, battingTeamId, bowlingTeamId, score: 0, wickets: 0, oversCompleted: 0, ballsInCurrentOver: 0, strikerPlayerId: '', nonStrikerPlayerId: '', currentBowlerPlayerId: '', matchStatus: 'live', isLastManActive: false, isDeclaredFinished: false };
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), inningData, { merge: true });
    updateDocumentNonBlocking(matchRef, { currentInningNumber: 2 });
    setIsPlayerAssignmentOpen(true);
  };

  const handleFinishMatch = async () => {
    if (!match || !isUmpire || isFinalizing || !inn1 || !inn2) return;
    setIsFinalizing(true);
    
    let result = "Match Finished";
    const t1n = getTeamName(inn1.battingTeamId); const t2n = getTeamName(inn2.battingTeamId);
    if (inn2.score > inn1.score) result = `${t2n} won the match.`;
    else if (inn1.score > inn2.score) result = `${t1n} won the match.`;
    else result = "Match Tied.";

    const playerMatchStats: Record<string, any> = {};
    const allBalls = [...(inn1Deliveries || []), ...(inn2Deliveries || [])];
    allBalls.forEach(d => {
      const pIds = [d.strikerPlayerId, d.bowlerId || d.bowlerPlayerId, d.fielderPlayerId, d.batsmanOutPlayerId].filter(id => id && id !== 'none');
      pIds.forEach(pid => { if (!playerMatchStats[pid]) playerMatchStats[pid] = { id: pid, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 }; });
      const s = playerMatchStats[d.strikerPlayerId]; if (s) { s.runs += d.runsScored || 0; if (d.extraType !== 'wide') s.ballsFaced += 1; if (d.runsScored === 4) s.fours += 1; if (d.runsScored === 6) s.sixes += 1; }
      const b = playerMatchStats[d.bowlerId || d.bowlerPlayerId]; if (b) { b.runsConceded += d.totalRunsOnDelivery || 0; if (d.extraType !== 'wide' && d.extraType !== 'noball') b.ballsBowled += 1; if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') b.wickets += 1; }
      const f = playerMatchStats[d.fielderPlayerId]; if (f) { if (d.dismissalType === 'caught') f.catches += 1; if (d.dismissalType === 'stumped') f.stumpings += 1; if (d.dismissalType === 'runout') f.runOuts += 1; }
    });

    let bestPid = ''; let bestCvp = -1;
    Object.values(playerMatchStats).forEach(ps => { const cvp = calculatePlayerCVP(ps); if (cvp > bestCvp) { bestCvp = cvp; bestPid = ps.id; } });

    updateDocumentNonBlocking(matchRef, { status: 'completed', resultDescription: result, potmPlayerId: bestPid, potmCvpScore: bestCvp });
    setIsFinalizing(false); 
    toast({ title: "Match Finalized", description: result });
  };

  const handleWicket = async () => {
    if (!match || !activeInningData || !isUmpire || !wicketForm.batterOutId) return;
    
    const currentInningId = `inning_${match.currentInningNumber}`;
    let newBalls = activeInningData.ballsInCurrentOver + 1; let newOvers = activeInningData.oversCompleted;
    if (newBalls === 6) { newOvers += 1; newBalls = 0; }
    
    const deliveryId = doc(collection(db, 'temp')).id;
    const deliveryData = { 
      id: deliveryId, 
      overNumber: newBalls === 0 ? newOvers : newOvers + 1, 
      ballNumberInOver: newBalls === 0 ? 6 : newBalls, 
      strikerPlayerId: activeInningData.strikerPlayerId, 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', 
      bowlerId: activeInningData.currentBowlerPlayerId, 
      runsScored: 0, extraRuns: 0, extraType: 'none', totalRunsOnDelivery: 0, isWicket: true, 
      dismissalType: wicketForm.type, batsmanOutPlayerId: wicketForm.batterOutId, fielderPlayerId: wicketForm.fielderId, timestamp: Date.now() 
    };
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    let nextStriker = wicketForm.batterOutId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId;
    let nextNonStriker = wicketForm.batterOutId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId;

    const updates: any = { 
      wickets: activeInningData.wickets + (wicketForm.type === 'retired' ? 0 : 1), 
      oversCompleted: newOvers, ballsInCurrentOver: newBalls, strikerPlayerId: nextStriker, nonStrikerPlayerId: nextNonStriker
    };

    if (newBalls === 0) updates.currentBowlerPlayerId = '';
    
    if (wicketForm.decision === 'finish') {
      updates.isDeclaredFinished = true;
    } else if (wicketForm.decision === 'last_man') { 
      updates.isLastManActive = true; 
      updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId; 
      updates.nonStrikerPlayerId = ''; 
    }

    if (newOvers >= match.totalOvers && wicketForm.decision !== 'last_man') {
      updates.isDeclaredFinished = true;
    }
    
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsWicketDialogOpen(false); 
    if (!updates.isDeclaredFinished && (newBalls === 0 || !updates.strikerPlayerId || !updates.nonStrikerPlayerId)) setIsPlayerAssignmentOpen(true);
  };

  const handleUndo = async () => {
    if (!match || !activeInningData || !isUmpire) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords');
    const q = query(deliveriesRef, orderBy('timestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    
    await deleteDoc(snapshot.docs[0].ref);
    await recalculateInningState(currentInningId);
    toast({ title: "Action Undone" });
  };

  const handleSyncScore = async () => {
    if (!match || !activeInningData || !isUmpire) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    await recalculateInningState(currentInningId);
    toast({ title: "Scores Re-Synced" });
  };

  const handleDeleteHistoricalBall = async (deliveryId: string, inningId: string) => {
    if (!isUmpire || isCorrecting) return;
    setIsCorrecting(true);
    try {
      const deliveryRef = doc(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords', deliveryId);
      await deleteDoc(deliveryRef);
      await recalculateInningState(inningId);
      setActiveTab('live');
      toast({ title: "History Corrected" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setIsCorrecting(false); }
  };

  const handleUpdateAssignment = () => {
    if (!match || !activeInningData || !isUmpire) return;
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), {
      strikerPlayerId: assignmentForm.strikerId, nonStrikerPlayerId: assignmentForm.nonStrikerId, currentBowlerPlayerId: assignmentForm.bowlerId
    });
    setIsPlayerAssignmentOpen(false);
  };

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center animate-pulse text-slate-400">Syncing Match Engine...</div>;
  if (!match) return <div className="p-20 text-center">Match missing.</div>;

  const currentStats = match.currentInningNumber === 1 ? stats1 : stats2;
  const currentDeliveries = match.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;
  const currentBowlerHistory = currentDeliveries?.filter(d => d.bowlerId === activeInningData?.currentBowlerPlayerId).slice(-6) || [];

  const getDynamicBallLabel = (delivery: any, deliveries: any[]) => {
    const legalBallsBefore = deliveries.filter(d => 
      d.timestamp <= delivery.timestamp && 
      (d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye')
    ).length;
    
    if (delivery.extraType !== 'none' && delivery.extraType !== 'bye' && delivery.extraType !== 'legbye') {
      return `${Math.floor(legalBallsBefore / 6)}.${(legalBallsBefore % 6)}`;
    }
    
    return `${Math.floor((legalBallsBefore - 1) / 6)}.${((legalBallsBefore - 1) % 6) + 1}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 px-2 md:px-4">
      {/* HEADER: MISSION CRITICAL DATA */}
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden border-b-8 border-primary">
        <div className="p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-stretch gap-8">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                <div className="flex items-baseline justify-between md:justify-start gap-4">
                  <span className="font-black text-2xl md:text-3xl uppercase tracking-tighter text-white/90">{getTeamName(match.team1Id)}</span>
                  <span className="font-black text-3xl md:text-4xl text-primary">{Math.max(0, inn1?.score ?? 0)}/{Math.max(0, inn1?.wickets ?? 0)}</span>
                </div>
                <div className="flex items-baseline justify-between md:justify-start gap-4">
                  <span className="font-black text-2xl md:text-3xl uppercase tracking-tighter text-white/90">{getTeamName(match.team2Id)}</span>
                  <span className="font-black text-3xl md:text-4xl text-secondary">{Math.max(0, inn2?.score ?? 0)}/{Math.max(0, inn2?.wickets ?? 0)}</span>
                </div>
              </div>
              <div className="md:border-l border-white/10 md:pl-8 space-y-2">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Official Status</p>
                <p className="text-sm font-bold uppercase italic text-primary">{match.status === 'completed' ? match.resultDescription : `Innings ${match.currentInningNumber} in Progress`}</p>
                <div className="flex items-center gap-3 mt-4">
                  <Badge variant="outline" className="text-[10px] border-white/20 text-white px-3 py-1 font-black">{match.totalOvers} OVERS</Badge>
                  {match.status === 'completed' && match.potmPlayerId && (
                    <Badge className="bg-amber-500 text-white font-black uppercase text-[10px] px-3 py-1 flex items-center gap-1">
                      <Star className="w-3 h-3" /> MVP: {getPlayerName(match.potmPlayerId)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-row md:flex-col gap-3">
              <Button size="lg" variant="secondary" className="flex-1 md:flex-none h-14 px-8 font-black uppercase text-xs tracking-widest shadow-xl bg-secondary text-white" onClick={() => {
                const report = generateHTMLReport(match, inn1, inn2, stats1, stats2, allTeams || [], allPlayers || []);
                const blob = new Blob([report], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `CricMates_${matchId}.html`; a.click();
              }}><Download className="w-4 h-4 mr-2" /> Report</Button>
              <Button size="lg" variant="outline" className="flex-1 md:flex-none h-14 px-8 font-black uppercase text-xs tracking-widest border-white/20 text-white" onClick={() => setIsShareDialogOpen(true)}>
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="sticky top-16 z-50 bg-white/90 backdrop-blur-xl border-b shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-start rounded-none bg-transparent h-16 p-0 overflow-x-auto scrollbar-hide">
            {['Live', 'Scorecard', 'Analytics', 'Overs', 'Info'].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase()} className="px-8 h-full text-xs font-black rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary uppercase tracking-widest transition-all">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab}>
        {/* LIVE SCORING PANEL */}
        <TabsContent value="live" className="space-y-8 pt-6">
          {isUmpire && match.status !== 'completed' && activeInningData && (
            <Card className="shadow-2xl border-none overflow-hidden bg-slate-900 text-white rounded-3xl">
              <CardHeader className="bg-white/5 py-5 border-b border-white/5 flex flex-row justify-between items-center px-8">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Live Scorer Console</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={handleUndo} className="h-10 px-4 text-[10px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/10 rounded-xl">
                  <Undo2 className="w-4 h-4 mr-2" /> Undo
                </Button>
              </CardHeader>
              <CardContent className="p-8">
                {activeInningData.isDeclaredFinished ? (
                  <div className="py-12 text-center space-y-8 max-w-sm mx-auto">
                    <div className="p-8 bg-white/5 rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center">
                      <Trophy className="w-16 h-16 text-amber-500 mb-4" />
                      <h3 className="text-2xl font-black uppercase tracking-tighter">Innings Complete</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">All scheduled overs have been delivered</p>
                    </div>
                    {match.currentInningNumber === 1 ? (
                      <Button onClick={handleStartSecondInnings} className="w-full h-20 bg-primary text-white font-black uppercase text-xl tracking-widest shadow-2xl rounded-2xl hover:scale-[1.02] transition-transform">START 2ND INNINGS <ChevronRight className="ml-2 w-8 h-8" /></Button>
                    ) : (
                      <Button onClick={handleFinishMatch} variant="secondary" disabled={isFinalizing} className="w-full h-20 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xl tracking-widest shadow-2xl rounded-2xl hover:scale-[1.02] transition-transform">
                        {isFinalizing ? <Loader2 className="animate-spin w-8 h-8" /> : <>FINISH MATCH <CheckCircle2 className="ml-2 w-8 h-8" /></>}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-8">
                      {[0, 1, 2, 3, 4, 6].map(r => (<Button key={r} onClick={() => handleRecordBall(r)} className={cn("h-16 md:h-20 text-2xl md:text-3xl font-black bg-white/5 border-2 border-white/10 rounded-2xl hover:bg-primary hover:border-primary transition-all", r >= 4 ? "text-primary hover:text-white" : "text-white")}>{r === 0 ? "•" : r}</Button>))}
                      <Button onClick={() => handleRecordBall(1, 'none', true)} className="h-16 md:h-20 flex flex-col items-center justify-center bg-secondary/20 border-2 border-secondary/40 text-secondary rounded-2xl hover:bg-secondary hover:text-white transition-all"><span className="text-xl md:text-2xl font-black">1D</span><span className="text-[8px] font-black uppercase leading-none mt-1">Dead</span></Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-14 font-black text-[10px] border-amber-500/40 text-amber-500 uppercase rounded-xl hover:bg-amber-500 hover:text-white transition-all">Wide</Button>
                      <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-14 font-black text-[10px] border-amber-500/40 text-amber-500 uppercase rounded-xl hover:bg-amber-500 hover:text-white transition-all">No Ball</Button>
                      <Button variant="outline" onClick={() => { setWicketForm(prev => ({ ...prev, batterOutId: activeInningData.strikerPlayerId })); setIsWicketDialogOpen(true); }} className="h-14 font-black text-[10px] border-red-500/40 text-red-500 uppercase rounded-xl hover:bg-red-500 hover:text-white transition-all">Wicket</Button>
                      <Button variant="outline" onClick={() => { setWicketForm(prev => ({ ...prev, batterOutId: activeInningData.strikerPlayerId, type: 'retired' })); handleWicket(); }} className="h-14 font-black text-[10px] border-blue-500/40 text-blue-500 uppercase rounded-xl hover:bg-blue-500 hover:text-white transition-all">Retire</Button>
                      <Button variant="outline" onClick={() => { setAssignmentForm({ strikerId: activeInningData.strikerPlayerId, nonStrikerId: activeInningData.nonStrikerPlayerId || '', bowlerId: activeInningData.currentBowlerPlayerId || '' }); setIsPlayerAssignmentOpen(true); }} className="h-14 font-black text-[10px] border-white/20 text-white uppercase rounded-xl hover:bg-white/10 transition-all">Assign</Button>
                    </div>
                    <div className="mt-8 border-t border-white/10 pt-8 flex gap-4">
                      {match.currentInningNumber === 1 ? (
                        <Button onClick={handleManualEndInnings} className="flex-1 h-14 bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10 rounded-xl">
                          <Flag className="w-4 h-4 mr-2" /> End 1st Innings
                        </Button>
                      ) : (
                        <Button onClick={handleFinishMatch} disabled={isFinalizing} className="flex-1 h-14 bg-emerald-600/20 border border-emerald-600/40 text-emerald-500 font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600/30 rounded-xl">
                          {isFinalizing ? <Loader2 className="animate-spin w-4 h-4" /> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Finish Match</>}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeInningData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="shadow-xl border-none overflow-hidden bg-white rounded-3xl">
                <CardHeader className="bg-slate-50 border-b py-4 px-8">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Live Batting Unit</span>
                </CardHeader>
                <div className="p-8 space-y-6">
                  {[
                    { id: activeInningData.strikerPlayerId, label: 'Striker', active: true },
                    { id: activeInningData.nonStrikerPlayerId, label: 'Non-Striker', active: false }
                  ].map((batter, i) => {
                    const stats = currentStats.batting.find(b => b.id === batter.id);
                    return (
                      <div key={i} className={cn("flex justify-between items-center p-6 rounded-2xl border-4 transition-all", batter.active ? "bg-primary/5 border-primary shadow-xl scale-[1.02]" : "bg-slate-50 border-transparent opacity-60")}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{batter.label}</p>
                            {batter.active && <Badge className="bg-primary h-4 text-[8px] px-1 font-black">ON STRIKE</Badge>}
                          </div>
                          <p className="font-black text-2xl truncate uppercase tracking-tighter text-slate-900 mt-1">{getPlayerName(batter.id)}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-right">
                          <div><p className="text-2xl font-black text-slate-900">{stats?.runs || 0}</p><p className="text-[8px] font-bold text-slate-400 uppercase">R</p></div>
                          <div><p className="text-2xl font-black text-slate-900">{stats?.balls || 0}</p><p className="text-[8px] font-bold text-slate-400 uppercase">B</p></div>
                          <div><p className="text-lg font-black text-slate-400">{stats?.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '0.0'}</p><p className="text-[8px] font-bold text-slate-400 uppercase">SR</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="shadow-xl border-none overflow-hidden bg-slate-900 text-white rounded-3xl">
                <CardHeader className="bg-white/5 border-b border-white/5 py-4 px-8">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Bowling Spell</span>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="bg-secondary/20 p-3 rounded-2xl"><Zap className="text-secondary w-8 h-8" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">In the Attack</p>
                        <p className="font-black text-2xl truncate uppercase tracking-tighter mt-1">{getPlayerName(activeInningData.currentBowlerPlayerId)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black text-secondary">
                        {currentStats.bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.wickets || 0}-
                        {currentStats.bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.runs || 0}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Match Figures</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Current Over Progress</p>
                    <div className="flex gap-3">
                      {currentBowlerHistory.map((d, idx) => (
                        <Badge key={idx} className={cn("h-10 w-10 rounded-full flex items-center justify-center font-black p-0 border-4 shadow-lg transition-transform hover:scale-110", 
                          d.isWicket ? "bg-red-500 border-red-600 text-white" : 
                          d.runsScored >= 4 ? "bg-primary border-primary/50 text-white" : "bg-white/10 border-white/5 text-white")}>
                          {d.isWicket ? "W" : d.totalRunsOnDelivery}
                        </Badge>
                      ))}
                      {[...Array(Math.max(0, 6 - currentBowlerHistory.length))].map((_, idx) => (
                        <div key={`empty-${idx}`} className="h-10 w-10 rounded-full border-4 border-white/5 flex items-center justify-center text-white/10 font-black">•</div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-center">
                    <div><p className="text-2xl font-black">{activeInningData.oversCompleted}.{activeInningData.ballsInCurrentOver}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Overs</p></div>
                    <div><p className="text-2xl font-black text-primary">{(() => { const bowlStats = currentStats.bowling.find(b => b.id === activeInningData.currentBowlerPlayerId); if (!bowlStats || bowlStats.balls === 0) return '0.00'; return (bowlStats.runs / (bowlStats.balls / 6)).toFixed(2); })()}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Economy</p></div>
                    <div><p className="text-2xl font-black">{currentStats.bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.maidens || 0}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Maidens</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* FULL SCORECARD TAB */}
        <TabsContent value="scorecard" className="pt-6 space-y-8">
          <Tabs value={activeScorecardSubTab} onValueChange={(v: any) => setActiveScorecardSubTab(v)}>
            <TabsList className="grid w-full grid-cols-2 mb-8 h-14 bg-slate-100 p-1.5 rounded-2xl">
              <TabsTrigger value="inn1" className="font-black data-[state=active]:bg-white data-[state=active]:text-primary rounded-xl uppercase text-[10px] tracking-widest">{getTeamName(inn1?.battingTeamId)} INNINGS</TabsTrigger>
              <TabsTrigger value="inn2" className="font-black data-[state=active]:bg-white data-[state=active]:text-primary rounded-xl uppercase text-[10px] tracking-widest">{getTeamName(inn2?.battingTeamId)} INNINGS</TabsTrigger>
            </TabsList>
            
            {[
              { id: 'inn1', stats: stats1, team: getTeamName(inn1?.battingTeamId), inning: inn1 },
              { id: 'inn2', stats: stats2, team: getTeamName(inn2?.battingTeamId), inning: inn2 }
            ].map((inn) => (
              <TabsContent key={inn.id} value={inn.id} className="space-y-8 m-0 animate-in fade-in slide-in-from-bottom-2">
                <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
                  <div className="bg-slate-900 text-white px-8 py-6 flex justify-between items-center border-b-4 border-primary">
                    <h3 className="font-black uppercase text-lg tracking-tighter">{inn.team} Batting</h3>
                    <p className="text-3xl font-black">{Math.max(0, inn.inning?.score ?? 0)}/{Math.max(0, inn.inning?.wickets ?? 0)} <span className="text-sm font-bold opacity-50 ml-2">({inn.inning?.oversCompleted || 0}.{inn.inning?.ballsInCurrentOver || 0} OV)</span></p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase px-8">Batter</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Runs</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Balls</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">4s</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">6s</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase pr-8">SR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inn.stats.batting.map((b: any) => (
                          <TableRow key={b.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="py-5 px-8">
                              <Link href={`/players/${b.id}`} className="font-black text-sm text-primary hover:underline uppercase tracking-tight block">{getPlayerName(b.id)}</Link>
                              <span className="text-[10px] font-bold text-slate-400 uppercase italic">
                                {b.out ? `${b.dismissal} b ${getPlayerName(b.bowlerId)}` : 'not out'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-black text-lg">{b.runs}</TableCell>
                            <TableCell className="text-right text-sm text-slate-500 font-bold">{b.balls}</TableCell>
                            <TableCell className="text-right text-sm text-slate-500 font-bold">{b.fours}</TableCell>
                            <TableCell className="text-right text-sm text-slate-500 font-bold">{b.sixes}</TableCell>
                            <TableCell className="text-right text-xs font-black text-slate-400 pr-8">
                              {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-white">
                    <div className="bg-slate-50 px-8 py-4 border-b"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Partnership Log</span></div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[9px] font-black uppercase px-8">Partners</TableHead>
                          <TableHead className="text-right text-[9px] font-black uppercase">Runs</TableHead>
                          <TableHead className="text-right text-[9px] font-black uppercase pr-8">Contribution</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inn.stats.partnerships.map((p: any, idx: number) => (
                          <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="px-8 py-4">
                              <p className="text-xs font-black uppercase tracking-tight">{getPlayerName(p.batter1Id)} & {getPlayerName(p.batter2Id)}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{p.balls} balls</p>
                            </TableCell>
                            <TableCell className="text-right font-black text-sm">{p.runs}</TableCell>
                            <TableCell className="text-right pr-8">
                              <div className="text-[9px] font-bold uppercase text-slate-500">
                                {getPlayerName(p.batter1Id).split(' ')[0]}: {p.batter1Runs} | {getPlayerName(p.batter2Id).split(' ')[0]}: {p.batter2Runs}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>

                  <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-white">
                    <div className="bg-slate-50 px-8 py-4 border-b"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bowling Unit Stats</span></div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow>
                            <TableHead className="text-[9px] font-black uppercase px-8">Bowler</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase">O</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase">W</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase pr-8">Eco</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inn.stats.bowling.map((b: any) => (
                            <TableRow key={b.id} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-black text-xs uppercase px-8 py-4">{getPlayerName(b.id)}</TableCell>
                              <TableCell className="text-right text-xs font-bold">{b.oversDisplay}</TableCell>
                              <TableCell className="text-right text-xs font-black">{b.runs}</TableCell>
                              <TableCell className="text-right text-xs font-black text-primary">{b.wickets}</TableCell>
                              <TableCell className="text-right text-[10px] font-black text-slate-400 pr-8">
                                {b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ANALYTICS PANEL */}
        <TabsContent value="analytics" className="pt-6 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="p-8 shadow-xl border-none bg-white rounded-3xl">
              <div className="flex items-center justify-between mb-10 border-b pb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-primary" /> Cumulative Scoring (Worm)
                </h3>
                <Badge variant="secondary" className="bg-primary/10 text-primary font-black uppercase text-[10px]">REAL-TIME</Badge>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} label={{ value: 'OVERS', position: 'bottom', offset: 0, fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', padding: '12px' }} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                    <Area type="monotone" name={getTeamName(match.team1Id)} dataKey="team1" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorT1)" dot={<CustomWicketDot team="team1" />} activeDot={{ r: 8, strokeWidth: 0 }} />
                    <Area type="monotone" name={getTeamName(match.team2Id)} dataKey="team2" stroke="#0d9488" strokeWidth={4} fillOpacity={1} fill="url(#colorT2)" dot={<CustomWicketDot team="team2" />} activeDot={{ r: 8, strokeWidth: 0 }} />
                    <defs>
                      <linearGradient id="colorT1" x1="0" x2="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorT2" x1="0" x2="0" x2="0" y2="1"><stop offset="5%" stopColor="#0d9488" stopOpacity={0.2}/><stop offset="95%" stopColor="#0d9488" stopOpacity={0}/></linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-8 shadow-xl border-none bg-white rounded-3xl">
              <div className="flex items-center justify-between mb-10 border-b pb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-secondary" /> Over-by-Over Runs
                </h3>
                <Badge variant="secondary" className="bg-secondary/10 text-secondary font-black uppercase text-[10px]">INTENSITY</Badge>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={overByOverData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="over" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} label={{ value: 'OVER NUMBER', position: 'bottom', offset: 0, fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <Tooltip cursor={{fill: '#f8fafc', radius: 8}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', fontSize: '10px', fontWeight: 900 }} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', fontWeight: 900 }} />
                    <Bar name={getTeamName(match.team1Id)} dataKey="team1" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar name={getTeamName(match.team2Id)} dataKey="team2" fill="#0d9488" radius={[6, 6, 0, 0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* OVERS HISTORY LOG */}
        <TabsContent value="overs" className="pt-6 space-y-10">
          {[
            { id: 'inning_1', name: getTeamName(inn1?.battingTeamId), deliveries: inn1Deliveries, score: Math.max(0, inn1?.score ?? 0), wkts: Math.max(0, inn1?.wickets ?? 0), ov: `${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver}` },
            { id: 'inning_2', name: getTeamName(inn2?.battingTeamId), deliveries: inn2Deliveries, score: Math.max(0, inn2?.score ?? 0), wkts: Math.max(0, inn2?.wickets ?? 0), ov: `${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver}` }
          ].map((inn) => (
            <div key={inn.id} className="space-y-6">
              <div className="flex items-center justify-between px-4 bg-slate-100 p-4 rounded-3xl border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="bg-primary p-3 rounded-2xl shadow-lg">
                    <History className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-xl tracking-tight text-slate-900">{inn.name}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Ball-by-Ball Audit</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary">{inn.score}/{inn.wkts}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">({inn.ov} OV delivered)</p>
                </div>
              </div>

              <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-3xl">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="hover:bg-transparent border-b h-14">
                        <TableHead className="w-24 text-[10px] font-black uppercase text-center">Over</TableHead>
                        <TableHead className="text-[10px] font-black uppercase pl-8">Matchup (Batter vs Bowler)</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase w-32">Ball Result</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Audit Description</TableHead>
                        {isUmpire && <TableHead className="w-20 text-right pr-8"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inn.deliveries && inn.deliveries.length > 0 ? (
                        inn.deliveries.slice().reverse().map((d) => (
                          <TableRow key={d.id} className="hover:bg-slate-50 transition-colors border-b last:border-none h-20">
                            <TableCell className="text-center">
                              <span className="font-black text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-lg">
                                {getDynamicBallLabel(d, inn.deliveries || [])}
                              </span>
                            </TableCell>
                            <TableCell className="pl-8">
                              <div className="flex flex-col">
                                <span className="font-black text-sm text-slate-900 uppercase tracking-tight">{getPlayerName(d.strikerPlayerId)}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase italic">bowled by {getPlayerName(d.bowlerId)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center">
                                <Badge className={cn("h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg p-0 border-4 shadow-xl transition-transform hover:scale-110", 
                                  d.isWicket ? "bg-red-500 border-red-600 text-white" : 
                                  d.runsScored === 6 ? "bg-purple-600 border-purple-700 text-white" :
                                  d.runsScored === 4 ? "bg-emerald-600 border-emerald-700 text-white" : 
                                  d.runsScored > 0 ? "bg-primary border-primary/50 text-white" :
                                  "bg-slate-100 border-slate-200 text-slate-400")}>
                                  {d.isWicket ? "W" : d.totalRunsOnDelivery}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {d.isWicket ? (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="destructive" className="w-fit text-[10px] font-black uppercase px-3 py-1 rounded-lg">{d.dismissalType}</Badge>
                                  {d.fielderPlayerId && d.fielderPlayerId !== 'none' && (
                                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-1 underline decoration-dotted">Assist: {getPlayerName(d.fielderPlayerId)}</span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className={cn("text-[10px] font-black uppercase tracking-widest", d.extraType !== 'none' ? "text-amber-600" : "text-slate-400")}>
                                    {d.extraType !== 'none' ? d.extraType : 'Fair Delivery'}
                                  </span>
                                  {d.extraRuns > 0 && <Badge variant="outline" className="text-[10px] font-black border-amber-200 bg-amber-50 text-amber-700">+{d.extraRuns} RUNS</Badge>}
                                </div>
                              )}
                            </TableCell>
                            {isUmpire && (
                              <TableCell className="text-right pr-8">
                                <Button variant="ghost" size="icon" className="h-12 w-12 text-slate-300 hover:text-destructive hover:bg-destructive/10 rounded-2xl" onClick={() => handleDeleteHistoricalBall(d.id, inn.id)}>
                                  <Trash2 className="w-5 h-5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={isUmpire ? 5 : 4} className="py-24 text-center">
                            <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-xs font-black uppercase text-slate-300 tracking-[0.3em] italic">No scoring records found for this unit</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="info" className="pt-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
              <div className="bg-slate-50 px-8 py-4 border-b"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tournament Registry</span></div>
              <CardContent className="p-8 space-y-6">
                {[
                  { label: 'Official Date', val: match.matchDate ? new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '---', icon: CalendarIcon },
                  { label: 'Sanctioned Format', val: `${match.totalOvers} Overs per Side`, icon: Clock },
                  { label: 'The Toss', val: `${getTeamName(match.tossWinnerTeamId)} elected to ${match.tossDecision}`, icon: Trophy },
                  { label: 'Registry Status', val: match.status.toUpperCase(), icon: ShieldCheck }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-6 border-b border-slate-100 pb-5 last:border-none last:pb-0">
                    <div className="bg-primary/5 p-3 rounded-2xl"><item.icon className="w-6 h-6 text-primary" /></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p><p className="text-sm font-black text-slate-900 uppercase mt-1 tracking-tight">{item.val}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
              <div className="bg-slate-50 px-8 py-4 border-b"><span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Participating Squads</span></div>
              <CardContent className="p-8 grid grid-cols-2 gap-12">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-primary border-b-4 border-primary/20 pb-2 tracking-widest">{getTeamName(match.team1Id)}</p>
                  <div className="space-y-2">
                    {match.team1SquadPlayerIds?.map((pid: string) => (
                      <Link key={pid} href={`/players/${pid}`} className="text-xs font-bold text-slate-600 block hover:text-primary transition-colors truncate uppercase tracking-tight">{getPlayerName(pid)}</Link>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-secondary border-b-4 border-secondary/20 pb-2 tracking-widest">{getTeamName(match.team2Id)}</p>
                  <div className="space-y-2">
                    {match.team2SquadPlayerIds?.map((pid: string) => (
                      <Link key={pid} href={`/players/${pid}`} className="text-xs font-bold text-slate-600 block hover:text-secondary transition-colors truncate uppercase tracking-tight">{getPlayerName(pid)}</Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGS: POLISHED & ACCESSIBLE */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-lg p-0 border-none bg-transparent shadow-none overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Official Match Result Share Card</DialogTitle>
            <DialogDescription>A visual summary designed for professional sharing.</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-900 text-white rounded-[2.5rem] overflow-hidden border-8 border-primary/20 shadow-2xl relative p-10 space-y-10">
            <div className="text-center space-y-3">
              <Badge className="bg-primary text-white font-black uppercase text-[10px] px-6 py-1.5 rounded-full shadow-lg">OFFICIAL LEAGUE SUMMARY</Badge>
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-tight">{getTeamName(match.team1Id)} <span className="text-slate-600 mx-2">VS</span> {getTeamName(match.team2Id)}</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em]">{new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <div className="grid grid-cols-2 gap-6 bg-white/5 p-8 rounded-[2rem] border border-white/10 items-center">
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">{getTeamName(inn1?.battingTeamId)}</p>
                <p className="text-5xl font-black tracking-tighter">{Math.max(0, inn1?.score ?? 0)}/{Math.max(0, inn1?.wickets ?? 0)}</p>
                <p className="text-[8px] font-bold text-slate-500 uppercase">({inn1?.oversCompleted}.{inn1?.ballsInCurrentOver} OV)</p>
              </div>
              <div className="text-center space-y-2 border-l border-white/10">
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{getTeamName(inn2?.battingTeamId)}</p>
                <p className="text-5xl font-black tracking-tighter">{Math.max(0, inn2?.score ?? 0)}/{Math.max(0, inn2?.wickets ?? 0)}</p>
                <p className="text-[8px] font-bold text-slate-500 uppercase">({inn2?.oversCompleted}.{inn2?.ballsInCurrentOver} OV)</p>
              </div>
            </div>
            <div className="text-center p-6 bg-primary/10 rounded-2xl border border-primary/20">
              <p className="text-lg font-black uppercase italic text-primary tracking-tight leading-snug">{match.resultDescription}</p>
            </div>
            <div className="pt-4 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3"><div className="bg-secondary p-2 rounded-xl"><Trophy className="w-5 h-5 text-white" /></div><span className="font-black text-2xl text-white tracking-tighter">CricMates PRO</span></div>
            </div>
          </div>
          <div className="mt-8 flex justify-center pb-8">
            <Button className="font-black h-14 px-10 rounded-2xl uppercase tracking-widest shadow-xl hover:scale-105 transition-transform" onClick={() => toast({ title: "Screenshot Ready" })}><Camera className="mr-3 w-5 h-5" /> EXPORT TO IMAGE</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WICKET REGISTER DIALOG */}
      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-[2rem] border-t-8 border-t-destructive p-8 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter text-3xl text-destructive">Register Out</DialogTitle>
            <DialogDescription className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Official Dismissal Log for {getPlayerName(wicketForm.batterOutId)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Mode of Dismissal</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}>
                <SelectTrigger className="font-black h-14 rounded-xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['bowled', 'caught', 'runout', 'stumped', 'hit-wicket'].map(t => (<SelectItem key={t} value={t} className="font-black uppercase text-xs">{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Involved Fielder (Optional)</Label>
              <Select value={wicketForm.fielderId} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}>
                <SelectTrigger className="font-black h-14 rounded-xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="font-bold text-slate-400">(NO FIELDER INVOLVED)</SelectItem>
                  {allPlayers?.filter(p => bowlingSquadPlayerIds.includes(p.id)).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Match Flow Control</Label>
              <Select value={wicketForm.decision} onValueChange={(v) => setWicketForm({...wicketForm, decision: v})}>
                <SelectTrigger className="font-black h-14 rounded-xl border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="next" className="font-black uppercase text-xs">Bring Next Batter</SelectItem>
                  <SelectItem value="last_man" className="font-black uppercase text-xs">Activate Last Man Stands</SelectItem>
                  <SelectItem value="finish" className="font-black uppercase text-xs text-destructive">Declare Innings Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleWicket} className="w-full h-16 bg-destructive text-white font-black uppercase text-lg shadow-xl rounded-2xl hover:scale-[1.02] transition-transform">Confirm Wicket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ASSIGNMENT DIALOG */}
      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-[2rem] border-t-8 border-t-primary p-8 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter text-3xl">Unit Positions</DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Assign Active Combatants</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Striker (Face Ball)</Label>
              <Select value={assignmentForm.strikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue placeholder="Select Striker" /></SelectTrigger>
                <SelectContent>
                  {allPlayers?.filter(p => {
                    const isNS = p.id === assignmentForm.nonStrikerId;
                    const isSquad = battingSquadPlayerIds.includes(p.id);
                    const stats = currentStats.batting.find(b => b.id === p.id);
                    const isAvailable = !stats?.out || stats?.dismissal === 'retired';
                    return isSquad && !isNS && isAvailable;
                  }).map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">
                      {p.name} {currentStats.batting.find(b => b.id === p.id)?.dismissal === 'retired' ? '(RE-ENTRY)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Non-Striker</Label>
              <Select value={assignmentForm.nonStrikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue placeholder="Select Non-Striker" /></SelectTrigger>
                <SelectContent>
                  {allPlayers?.filter(p => {
                    const isStriker = p.id === assignmentForm.strikerId;
                    const isSquad = battingSquadPlayerIds.includes(p.id);
                    const stats = currentStats.batting.find(b => b.id === p.id);
                    const isAvailable = !stats?.out || stats?.dismissal === 'retired';
                    return isSquad && !isStriker && isAvailable;
                  }).map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">
                      {p.name} {currentStats.batting.find(b => b.id === p.id)?.dismissal === 'retired' ? '(RE-ENTRY)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Active Bowler</Label>
              <Select value={assignmentForm.bowlerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue placeholder="Select Bowler" /></SelectTrigger>
                <SelectContent>
                  {allPlayers?.filter(p => bowlingSquadPlayerIds.includes(p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <Button variant="ghost" className="w-full text-[10px] font-black uppercase text-slate-400 h-10 hover:text-primary rounded-xl" onClick={handleSyncScore}>
                <RefreshCw className="w-4 h-4 mr-2" /> FORCE CALIBRATE SCORES
              </Button>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateAssignment} className="w-full h-16 font-black uppercase tracking-widest text-lg shadow-xl bg-primary text-white rounded-2xl hover:scale-[1.02] transition-transform">Apply Unit Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}