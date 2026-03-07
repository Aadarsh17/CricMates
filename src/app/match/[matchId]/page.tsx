
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Info, Trash2, Download, Loader2, Zap, LineChart as LineChartIcon, BarChart, ChevronRight, History, PlayCircle, CheckCircle2, Star, Users, Clock, Calendar as CalendarIcon, Undo2, AlertCircle, UserCheck, ArrowLeftRight, Share2, Camera, X, ShieldCheck, UserMinus, UserPlus, TrendingUp, Flag, RefreshCw, List } from 'lucide-react';
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

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { isUmpire } = useApp();
  
  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Refs for smooth scrolling navigation
  const liveRef = useRef<HTMLDivElement>(null);
  const scorecardRef = useRef<HTMLDivElement>(null);
  const analyticsRef = useRef<HTMLDivElement>(null);
  const oversRef = useRef<HTMLDivElement>(null);

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
    
    for (let i = 0; i <= maxOvers; i++) {
      const d1 = inn1Deliveries?.filter(d => {
        const legalBallsBefore = inn1Deliveries.filter(prev => 
          prev.timestamp < d.timestamp && (prev.extraType === 'none' || prev.extraType === 'bye' || prev.extraType === 'legbye')
        ).length;
        const overIndex = Math.floor(legalBallsBefore / 6);
        return overIndex < i;
      });
      cum1 = d1?.reduce((sum, d) => sum + d.totalRunsOnDelivery, 0) || 0;

      const d2 = inn2Deliveries?.filter(d => {
        const legalBallsBefore = inn2Deliveries.filter(prev => 
          prev.timestamp < d.timestamp && (prev.extraType === 'none' || prev.extraType === 'bye' || prev.extraType === 'legbye')
        ).length;
        const overIndex = Math.floor(legalBallsBefore / 6);
        return overIndex < i;
      });
      cum2 = d2?.reduce((sum, d) => sum + d.totalRunsOnDelivery, 0) || 0;

      data.push({ 
        label: i.toString(), 
        team1: cum1, 
        team2: (inn2Deliveries && inn2Deliveries.length > 0) || cum2 > 0 ? cum2 : null
      });
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries, match?.totalOvers]);

  const barChartData = useMemo(() => {
    if (!inn1Deliveries && !inn2Deliveries) return [];
    const maxOvers = match?.totalOvers || 6;
    const data = [];
    
    for (let i = 1; i <= maxOvers; i++) {
      const runs1 = inn1Deliveries?.filter(d => {
        const legalBallsBefore = inn1Deliveries.filter(prev => 
          prev.timestamp < d.timestamp && (prev.extraType === 'none' || prev.extraType === 'bye' || prev.extraType === 'legbye')
        ).length;
        return Math.floor(legalBallsBefore / 6) === i - 1;
      }).reduce((sum, d) => sum + d.totalRunsOnDelivery, 0) || 0;

      const runs2 = inn2Deliveries?.filter(d => {
        const legalBallsBefore = inn2Deliveries.filter(prev => 
          prev.timestamp < d.timestamp && (prev.extraType === 'none' || prev.extraType === 'bye' || prev.extraType === 'legbye')
        ).length;
        return Math.floor(legalBallsBefore / 6) === i - 1;
      }).reduce((sum, d) => sum + d.totalRunsOnDelivery, 0) || 0;

      data.push({ 
        label: `OV ${i}`, 
        team1: runs1, 
        team2: (inn2Deliveries && inn2Deliveries.length > 0) ? runs2 : 0
      });
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries, match?.totalOvers]);

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

  const currentStats = match?.currentInningNumber === 1 ? stats1 : stats2;
  const currentDeliveries = match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;
  const currentBowlerHistory = currentDeliveries?.filter(d => d.bowlerId === activeInningData?.currentBowlerPlayerId).slice(-6) || [];

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
    
    let totalScore = 0; let totalWickets = 0; let legalBalls = 0;
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
    }

    if (inningId === 'inning_2' && inn1 && totalScore > inn1.score) {
      updates.isDeclaredFinished = true;
    }

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates, { merge: true });
    
    if (match.status === 'completed') {
      await setDocumentNonBlocking(matchRef, { status: 'live', currentInningNumber: inningId === 'inning_1' ? 1 : 2 }, { merge: true });
    }
  };

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none', noStrikeChange: boolean = false) => {
    if (!match || !activeInningData || !isUmpire) return;
    
    if (activeInningData.oversCompleted >= match.totalOvers && activeInningData.ballsInCurrentOver === 0) {
      toast({ title: "Innings Complete" }); return;
    }

    if (!activeInningData.currentBowlerPlayerId) { 
      setAssignmentForm({ strikerId: activeInningData.strikerPlayerId, nonStrikerId: activeInningData.nonStrikerPlayerId || '', bowlerId: '' });
      setIsPlayerAssignmentOpen(true); return; 
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
    let needsOverEndRotation = false;

    if (newBallsInOver === 6) { newOversComp += 1; newBallsInOver = 0; needsOverEndRotation = true; }

    let nextStriker = activeInningData.strikerPlayerId;
    let nextNonStriker = activeInningData.nonStrikerPlayerId || 'none';

    if (!activeInningData.isLastManActive && !noStrikeChange && runs % 2 !== 0) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }
    if (needsOverEndRotation && !activeInningData.isLastManActive) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }

    // Dynamic 0.6 notation logic
    const totalLegalSoFar = (currentDeliveries?.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length || 0) + (isLegalBall ? 1 : 0);
    const logOver = Math.floor((totalLegalSoFar - 1) / 6);
    const logBall = ((totalLegalSoFar - 1) % 6) + 1;

    const deliveryId = doc(collection(db, 'temp')).id;
    const deliveryData = { 
      id: deliveryId, 
      overNumber: logOver, 
      ballNumberInOver: logBall, 
      strikerPlayerId: activeInningData.strikerPlayerId, 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', 
      bowlerId: activeInningData.currentBowlerPlayerId, 
      runsScored: ballRuns, 
      extraRuns, 
      extraType, 
      totalRunsOnDelivery, 
      isWicket: false, 
      timestamp: Date.now() 
    };
    
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    const updates: any = { score: Math.max(0, newTotalScore), oversCompleted: newOversComp, ballsInCurrentOver: newBallsInOver, strikerPlayerId: nextStriker, nonStrikerPlayerId: nextNonStriker };
    if (newBallsInOver === 0 && isLegalBall) updates.currentBowlerPlayerId = '';
    
    if (match.currentInningNumber === 1 && newOversComp >= match.totalOvers) updates.isDeclaredFinished = true;
    if (match.currentInningNumber === 2 && inn1 && newTotalScore > inn1.score) updates.isDeclaredFinished = true;
    else if (match.currentInningNumber === 2 && newOversComp >= match.totalOvers) updates.isDeclaredFinished = true;

    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    if (updates.currentBowlerPlayerId === '' && !updates.isDeclaredFinished) setIsPlayerAssignmentOpen(true);
  };

  const handleWicket = async () => {
    if (!match || !activeInningData || !isUmpire || !wicketForm.batterOutId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    let newBalls = activeInningData.ballsInCurrentOver + 1; let newOvers = activeInningData.oversCompleted;
    if (newBalls === 6) { newOvers += 1; newBalls = 0; }
    
    const totalLegalSoFar = (currentDeliveries?.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length || 0) + 1;
    const logOver = Math.floor((totalLegalSoFar - 1) / 6);
    const logBall = ((totalLegalSoFar - 1) % 6) + 1;

    const deliveryId = doc(collection(db, 'temp')).id;
    const deliveryData = { 
      id: deliveryId, 
      overNumber: logOver, 
      ballNumberInOver: logBall, 
      strikerPlayerId: activeInningData.strikerPlayerId, 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', 
      bowlerId: activeInningData.currentBowlerPlayerId, 
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
    
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    const updates: any = { 
      wickets: activeInningData.wickets + (wicketForm.type === 'retired' ? 0 : 1), 
      oversCompleted: newOvers, 
      ballsInCurrentOver: newBalls, 
      strikerPlayerId: '', 
      nonStrikerPlayerId: wicketForm.batterOutId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId 
    };
    
    if (newBalls === 0) updates.currentBowlerPlayerId = '';
    if (wicketForm.decision === 'finish' || (newOvers >= match.totalOvers && wicketForm.decision !== 'last_man')) updates.isDeclaredFinished = true;
    if (wicketForm.decision === 'last_man') updates.isLastManActive = true;

    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsWicketDialogOpen(false);
    if (!updates.isDeclaredFinished) setIsPlayerAssignmentOpen(true);
  };

  const handleUndo = async () => {
    if (!match || !activeInningData || !isUmpire) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords');
    const q = query(deliveriesRef, orderBy('timestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      await deleteDoc(snapshot.docs[0].ref);
      await recalculateInningState(currentInningId);
      toast({ title: "Action Undone" });
    }
  };

  const handleFinishMatch = async () => {
    if (!match || !isUmpire || isFinalizing || !inn1 || !inn2) return;
    setIsFinalizing(true);
    let result = inn2.score > inn1.score ? `${getTeamName(inn2.battingTeamId)} won.` : (inn1.score > inn2.score ? `${getTeamName(inn1.battingTeamId)} won.` : "Match Tied.");
    updateDocumentNonBlocking(matchRef, { status: 'completed', resultDescription: result });
    setIsFinalizing(false); 
    toast({ title: "Match Finalized" });
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      const offset = 140; // Sticky header offset
      const top = ref.current.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 animate-pulse font-black uppercase text-xs tracking-widest"><Loader2 className="w-10 h-10 mb-4 animate-spin text-primary" /> Syncing Professional Scoreboard...</div>;
  if (!match) return <div className="p-20 text-center">Match missing.</div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 px-4 relative">
      {/* MOBILE STICKY SCOREBOARD HEADER */}
      <div className="fixed top-16 left-0 right-0 z-[90] bg-slate-950 text-white shadow-2xl border-b border-white/10 px-6 py-4 animate-in slide-in-from-top duration-500">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-black text-lg tracking-tighter uppercase text-white/90">{getTeamName(match.team1Id).substring(0, 3)}</span>
              <span className="font-black text-xl text-primary">{Math.max(0, inn1?.score ?? 0)}/{Math.max(0, inn1?.wickets ?? 0)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black text-lg tracking-tighter uppercase text-white/90">{getTeamName(match.team2Id).substring(0, 3)}</span>
              <span className="font-black text-xl text-secondary">{Math.max(0, inn2?.score ?? 0)}/{Math.max(0, inn2?.wickets ?? 0)}</span>
            </div>
          </div>
          <div className="text-right">
            <Badge variant="destructive" className="animate-pulse text-[8px] font-black px-2 py-0.5 mb-1 h-4">{match.status === 'completed' ? 'FINAL' : 'LIVE'}</Badge>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {activeInningData?.oversCompleted || 0}.{activeInningData?.ballsInCurrentOver || 0} / {match.totalOvers} OV
            </p>
          </div>
        </div>
      </div>

      {/* QUICK JUMP NAVIGATION */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 mt-24">
        {[
          { label: 'Live', ref: liveRef, icon: PlayCircle },
          { label: 'Scorecard', ref: scorecardRef, icon: List },
          { label: 'Analytics', ref: analyticsRef, icon: BarChart },
          { label: 'Overs', ref: oversRef, icon: History }
        ].map((btn) => (
          <Button key={btn.label} variant="outline" size="sm" onClick={() => scrollToSection(btn.ref as any)} className="bg-white border-2 rounded-xl font-black uppercase text-[10px] tracking-widest whitespace-nowrap px-4 shrink-0 shadow-sm">
            <btn.icon className="w-3 h-3 mr-2" /> {btn.label}
          </Button>
        ))}
      </div>

      {/* LIVE SCORING SECTION */}
      <div ref={liveRef} className="space-y-6 pt-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
            <PlayCircle className="text-primary w-5 h-5" /> Live Scorer
          </h2>
          {isUmpire && <Button variant="ghost" size="sm" onClick={handleUndo} className="h-8 text-[10px] font-black uppercase"><Undo2 className="w-3 h-3 mr-1" /> Undo</Button>}
        </div>

        {isUmpire && !activeInningData?.isDeclaredFinished && match.status !== 'completed' && (
          <Card className="bg-slate-950 border-none shadow-2xl rounded-3xl overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3, 4, 6].map(r => (
                  <Button key={r} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl transition-all shadow-lg", r >= 4 ? "bg-primary text-white scale-105" : "bg-white/10 text-white hover:bg-white/20")}>
                    {r === 0 ? "•" : r}
                  </Button>
                ))}
                <Button onClick={() => handleRecordBall(1, 'none', true)} className="bg-secondary text-white h-14 font-black rounded-2xl flex flex-col items-center justify-center shadow-lg"><span className="text-xl">1D</span><span className="text-[8px] uppercase">No Str</span></Button>
                <Button variant="outline" onClick={() => { setWicketForm(prev => ({ ...prev, batterOutId: activeInningData?.strikerPlayerId })); setIsWicketDialogOpen(true); }} className="h-14 border-red-500/50 text-red-500 bg-red-500/10 font-black rounded-2xl uppercase text-[10px] shadow-lg">Wicket</Button>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 border-amber-500/50 text-amber-500 bg-amber-500/5 font-black rounded-xl uppercase text-[10px]">Wide</Button>
                <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-12 border-amber-500/50 text-amber-500 bg-amber-500/5 font-black rounded-xl uppercase text-[10px]">No Ball</Button>
                <Button variant="outline" onClick={() => { setWicketForm({ type: 'retired', batterOutId: activeInningData?.strikerPlayerId, fielderId: 'none', decision: 'next' }); setIsWicketDialogOpen(true); }} className="h-12 border-blue-500/50 text-blue-500 bg-blue-500/5 font-black rounded-xl uppercase text-[10px]">Retire</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeInningData?.isDeclaredFinished && match.status !== 'completed' && (
          <Card className="bg-primary text-white border-none shadow-2xl rounded-3xl p-8 text-center animate-in zoom-in-95">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-white/50" />
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">Innings Complete</h3>
            {match.currentInningNumber === 1 ? (
              <Button onClick={() => { updateDocumentNonBlocking(matchRef, { currentInningNumber: 2 }); }} className="w-full h-16 bg-white text-primary font-black uppercase text-lg rounded-2xl shadow-xl">Start 2nd Innings <ChevronRight className="ml-2" /></Button>
            ) : (
              <Button onClick={handleFinishMatch} disabled={isFinalizing} className="w-full h-16 bg-secondary text-white font-black uppercase text-lg rounded-2xl shadow-xl">
                {isFinalizing ? <Loader2 className="animate-spin" /> : 'Finalize Match'}
              </Button>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {[
            { id: activeInningData?.strikerPlayerId, label: 'Striker', active: true },
            { id: activeInningData?.nonStrikerPlayerId, label: 'Non-Striker', active: false }
          ].map((batter, i) => {
            const stats = currentStats.batting.find(b => b.id === batter.id);
            return (
              <Card key={i} className={cn("border-2 rounded-2xl shadow-sm overflow-hidden", batter.active ? "border-primary bg-primary/5" : "border-slate-100 bg-white opacity-70")}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{batter.label}</p>
                    <p className="font-black text-lg truncate uppercase tracking-tighter text-slate-900">{getPlayerName(batter.id)}</p>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div><p className="text-xl font-black text-slate-900">{stats?.runs || 0}</p><p className="text-[8px] font-bold text-slate-400 uppercase">R</p></div>
                    <div><p className="text-xl font-black text-slate-900">{stats?.balls || 0}</p><p className="text-[8px] font-bold text-slate-400 uppercase">B</p></div>
                    <div><p className="text-sm font-black text-slate-400">{stats?.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '0.0'}</p><p className="text-[8px] font-bold text-slate-400 uppercase">SR</p></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-slate-900 text-white rounded-3xl shadow-xl overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Bowler</p>
                <p className="font-black text-xl truncate uppercase tracking-tighter">{getPlayerName(activeInningData?.currentBowlerPlayerId)}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-secondary">
                  {currentStats.bowling.find(b => b.id === activeInningData?.currentBowlerPlayerId)?.wickets || 0}-
                  {currentStats.bowling.find(b => b.id === activeInningData?.currentBowlerPlayerId)?.runs || 0}
                </p>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Match Figures</p>
              </div>
            </div>
            <div className="flex gap-2">
              {currentBowlerHistory.map((d, idx) => (
                <Badge key={idx} className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-black p-0 border-2", d.isWicket ? "bg-red-500 border-red-600" : d.runsScored >= 4 ? "bg-primary border-primary/50" : "bg-white/10 border-white/5")}>
                  {d.isWicket ? "W" : d.totalRunsOnDelivery}
                </Badge>
              ))}
              {[...Array(Math.max(0, 6 - currentBowlerHistory.length))].map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-lg border-2 border-white/5 flex items-center justify-center text-white/10 font-black text-xs">•</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FULL SCORECARD SECTION */}
      <div ref={scorecardRef} className="space-y-6 pt-12">
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2 px-2">
          <List className="text-primary w-5 h-5" /> Full Scorecard
        </h2>
        
        {[
          { stats: stats1, team: getTeamName(inn1?.battingTeamId), inning: inn1 },
          { stats: stats2, team: getTeamName(inn2?.battingTeamId), inning: inn2 }
        ].map((inn, i) => (
          <Card key={i} className="border-none shadow-lg rounded-3xl overflow-hidden bg-white">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center border-b-4 border-primary">
              <h3 className="font-black uppercase text-sm tracking-tighter">{inn.team}</h3>
              <p className="font-black">{Math.max(0, inn.inning?.score ?? 0)}/{Math.max(0, inn.inning?.wickets ?? 0)} <span className="text-[10px] opacity-50 ml-1">({inn.inning?.oversCompleted || 0}.{inn.inning?.ballsInCurrentOver || 0})</span></p>
            </div>
            <div className="p-2 space-y-2">
              {inn.stats.batting.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3 border-b last:border-none">
                  <div className="min-w-0">
                    <p className="font-black text-xs uppercase tracking-tight text-slate-900 truncate max-w-[120px]">{getPlayerName(b.id)}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase italic leading-none">{b.out ? `${b.dismissal}` : 'not out'}</p>
                  </div>
                  <div className="flex gap-4 items-baseline">
                    <span className="font-black text-sm">{b.runs}</span>
                    <span className="text-[10px] text-slate-400 font-bold">({b.balls})</span>
                    <span className="text-[10px] text-slate-300 font-black w-8 text-right">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(0) : '0'}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* ANALYTICS SECTION */}
      <div ref={analyticsRef} className="space-y-6 pt-12">
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2 px-2">
          <BarChart className="text-primary w-5 h-5" /> Analytics
        </h2>
        <div className="space-y-6">
          <Card className="p-4 shadow-xl border-none bg-white rounded-3xl overflow-hidden">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest px-2">Cumulative Runs (Worm)</p>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                  <YAxis axisLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                  <Tooltip />
                  <Area type="monotone" name={getTeamName(match.team1Id).substring(0,3)} dataKey="team1" stroke="#2563eb" strokeWidth={3} fillOpacity={0.1} fill="#2563eb" />
                  <Area type="monotone" name={getTeamName(match.team2Id).substring(0,3)} dataKey="team2" stroke="#0d9488" strokeWidth={3} fillOpacity={0.1} fill="#0d9488" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4 shadow-xl border-none bg-white rounded-3xl overflow-hidden">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest px-2">Runs Per Over Comparison</p>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                  <YAxis axisLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                  <Bar dataKey="team1" name={getTeamName(match.team1Id).substring(0,3)} fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="team2" name={getTeamName(match.team2Id).substring(0,3)} fill="#0d9488" radius={[4, 4, 0, 0]} />
                </ReBarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* OVERS HISTORY SECTION */}
      <div ref={oversRef} className="space-y-6 pt-12">
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2 px-2">
          <History className="text-primary w-5 h-5" /> Ball Log
        </h2>
        {[
          { id: 'inning_1', name: getTeamName(inn1?.battingTeamId), deliveries: inn1Deliveries },
          { id: 'inning_2', name: getTeamName(inn2?.battingTeamId), deliveries: inn2Deliveries }
        ].map((inn) => (
          <div key={inn.id} className="space-y-3">
            <Badge className="bg-slate-100 text-slate-500 border-none font-black uppercase text-[8px] tracking-[0.2em]">{inn.name} Innings</Badge>
            <Card className="border-none shadow-lg overflow-hidden bg-white rounded-2xl">
              <div className="divide-y">
                {inn.deliveries && inn.deliveries.length > 0 ? (
                  inn.deliveries.slice().reverse().map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="font-black text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{d.overNumber}.{d.ballNumberInOver}</span>
                        <div className="min-w-0">
                          <p className="font-black text-xs uppercase text-slate-900 truncate max-w-[100px]">{getPlayerName(d.strikerPlayerId)}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase italic">b {getPlayerName(d.bowlerId)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-black p-0 border-2 shadow-sm", d.isWicket ? "bg-red-500 border-red-600 text-white" : d.runsScored >= 4 ? "bg-primary border-primary/50 text-white" : "bg-slate-50 border-slate-200 text-slate-600")}>
                          {d.isWicket ? "W" : d.totalRunsOnDelivery}
                        </Badge>
                        {isUmpire && <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300" onClick={() => { if(confirm('Delete this ball?')) { deleteDoc(doc(db, 'matches', matchId, 'innings', inn.id, 'deliveryRecords', d.id)); recalculateInningState(inn.id); } }}><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-[10px] font-black uppercase text-slate-300 italic tracking-widest">Awaiting Deliveries</div>
                )}
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* DIALOGS */}
      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-red-600">Register Dismissal</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">Select mode of out or retirement</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}>
              <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Dismissal Type" /></SelectTrigger>
              <SelectContent>{['bowled', 'caught', 'runout', 'stumped', 'hit-wicket', 'retired'].map(t => (<SelectItem key={t} value={t} className="font-bold uppercase text-xs">{t}</SelectItem>))}</SelectContent>
            </Select>
            <Select value={wicketForm.decision} onValueChange={(v) => setWicketForm({...wicketForm, decision: v})}>
              <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Match Control" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="next" className="font-bold text-xs uppercase">Next Batter</SelectItem>
                <SelectItem value="last_man" className="font-bold text-xs uppercase">Last Man Stands</SelectItem>
                <SelectItem value="finish" className="font-bold text-xs uppercase text-red-600">End Innings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleWicket} className="w-full h-14 bg-red-600 text-white font-black uppercase rounded-2xl shadow-lg">Confirm Action</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Position Control</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-slate-400">Assign active roles for the next phase</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Striker</Label><Select value={assignmentForm.strikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => battingSquadPlayerIds.includes(p.id) && p.id !== assignmentForm.nonStrikerId).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Non-Striker</Label><Select value={assignmentForm.nonStrikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Non-Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => battingSquadPlayerIds.includes(p.id) && p.id !== assignmentForm.strikerId).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Bowler</Label><Select value={assignmentForm.bowlerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Bowler" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => bowlingSquadPlayerIds.includes(p.id)).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>
            <Button variant="outline" className="w-full h-10 mt-2 font-black uppercase text-[10px]" onClick={() => recalculateInningState(`inning_${match.currentInningNumber}`)}><RefreshCw className="w-3 h-3 mr-2" /> Force Sync Current Score</Button>
          </div>
          <DialogFooter><Button onClick={() => { updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: assignmentForm.strikerId, nonStrikerPlayerId: assignmentForm.nonStrikerId, currentBowlerPlayerId: assignmentForm.bowlerId }); setIsPlayerAssignmentOpen(false); }} className="w-full h-14 bg-primary text-white font-black uppercase rounded-2xl shadow-lg">Confirm Units</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
