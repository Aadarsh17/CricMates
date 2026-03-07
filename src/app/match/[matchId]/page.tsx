
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Info, Trash2, Download, Loader2, Zap, LineChart as LineChartIcon, BarChart, ChevronRight, History, PlayCircle, CheckCircle2, Star, Users, Clock, Calendar as CalendarIcon, Undo2, AlertCircle, UserCheck, ArrowLeftRight, Share2, Camera, X, ShieldCheck, UserMinus, UserPlus, TrendingUp, Flag } from 'lucide-react';
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

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none', noStrikeChange: boolean = false) => {
    if (!match || !activeInningData || !isUmpire) return;
    if (!activeInningData.currentBowlerPlayerId) { setIsPlayerAssignmentOpen(true); return; }

    const currentInningId = `inning_${match.currentInningNumber}`;
    let ballRuns = runs; let extraRuns = 0; let isLegalBall = true;
    if (extraType === 'wide') { extraRuns = runs + 1; ballRuns = 0; isLegalBall = false; }
    else if (extraType === 'noball') { extraRuns = 1; ballRuns = runs; isLegalBall = false; }
    else if (extraType === 'bye' || extraType === 'legbye') { extraRuns = runs; ballRuns = 0; }
    
    const totalRunsOnDelivery = ballRuns + extraRuns;
    
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
      score: activeInningData.score + totalRunsOnDelivery, 
      oversCompleted: newOversComp, 
      ballsInCurrentOver: newBallsInOver,
      strikerPlayerId: nextStriker,
      nonStrikerPlayerId: nextNonStriker
    };
    
    if (newOversComp >= match.totalOvers && newBallsInOver === 0) {
      updates.isDeclaredFinished = true;
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
    toast({ title: "Match Finalized" });
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
    if (wicketForm.decision === 'finish') updates.isDeclaredFinished = true;
    else if (wicketForm.decision === 'last_man') { 
      updates.isLastManActive = true; 
      updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId; 
      updates.nonStrikerPlayerId = ''; 
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
    const lastBall = snapshot.docs[0].data();
    await deleteDoc(snapshot.docs[0].ref);
    const isLegal = lastBall.extraType === 'none' || lastBall.extraType === 'bye' || lastBall.extraType === 'legbye';
    let prevBalls = activeInningData.ballsInCurrentOver - (isLegal ? 1 : 0);
    let prevOvers = activeInningData.oversCompleted;
    if (prevBalls < 0) { prevBalls = 5; prevOvers -= 1; }
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), {
      score: activeInningData.score - lastBall.totalRunsOnDelivery,
      wickets: activeInningData.wickets - (lastBall.isWicket && lastBall.dismissalType !== 'retired' ? 1 : 0),
      ballsInCurrentOver: Math.max(0, prevBalls),
      oversCompleted: Math.max(0, prevOvers),
      strikerPlayerId: lastBall.strikerPlayerId,
      nonStrikerPlayerId: lastBall.nonStrikerPlayerId,
      currentBowlerPlayerId: lastBall.bowlerId,
      isDeclaredFinished: false
    });
  };

  const handleDeleteHistoricalBall = async (deliveryId: string, inningId: string) => {
    if (!isUmpire || isCorrecting) return;
    setIsCorrecting(true);
    try {
      const deliveryRef = doc(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords', deliveryId);
      await deleteDoc(deliveryRef);
      const allDeliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
      const snapshot = await getDocs(query(allDeliveriesRef, orderBy('timestamp', 'asc')));
      const remaining = snapshot.docs.map(d => d.data());
      let ns = 0; let nw = 0; let nb = 0;
      remaining.forEach(d => { ns += d.totalRunsOnDelivery; if (d.isWicket && d.dismissalType !== 'retired') nw++; if (d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye') nb++; });
      const last = remaining[remaining.length - 1];
      const updates: any = { score: ns, wickets: nw, oversCompleted: Math.floor(nb / 6), ballsInCurrentOver: nb % 6, isDeclaredFinished: false };
      if (last) { updates.strikerPlayerId = last.strikerPlayerId; updates.nonStrikerPlayerId = last.nonStrikerPlayerId; updates.currentBowlerPlayerId = last.bowlerId; }
      await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates, { merge: true });
      await setDocumentNonBlocking(matchRef, { status: 'live', currentInningNumber: inningId === 'inning_1' ? 1 : 2 }, { merge: true });
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

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase tracking-widest">Syncing Match Engine...</div>;
  if (!match) return <div className="p-20 text-center">Match missing.</div>;

  const currentStats = match.currentInningNumber === 1 ? stats1 : stats2;
  const currentDeliveries = match.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;
  const currentBowlerHistory = currentDeliveries?.filter(d => d.bowlerId === activeInningData?.currentBowlerPlayerId).slice(-6) || [];

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="bg-white rounded-2xl shadow-xl border-t-8 border-t-primary overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3 flex-1 w-full">
              <div className="flex items-center justify-between">
                <div className="flex flex-col"><span className="font-black text-xl md:text-2xl uppercase">{getTeamName(match.team1Id)}</span><span className="text-[10px] font-black text-slate-400 uppercase">({match.totalOvers} OV)</span></div>
                <span className="font-black text-2xl md:text-3xl text-slate-900">
                  {inn1?.score || 0}/{inn1?.wickets || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col"><span className="font-black text-xl md:text-2xl uppercase">{getTeamName(match.team2Id)}</span><span className="text-[10px] font-black text-slate-400 uppercase">({match.totalOvers} OV)</span></div>
                <span className="font-black text-2xl md:text-3xl text-slate-900">
                  {inn2?.score || 0}/{inn2?.wickets || 0}
                </span>
              </div>
            </div>
            <div className="w-px h-20 bg-slate-100 hidden md:block mx-4" />
            <div className="flex flex-row md:flex-col items-center md:items-end gap-3 w-full md:w-auto">
              <Button size="sm" variant="secondary" className="flex-1 md:flex-none h-12 px-6 font-black text-[10px] uppercase bg-secondary text-white shadow-md" onClick={() => {
                const report = generateHTMLReport(match, inn1, inn2, stats1, stats2, allTeams || [], allPlayers || []);
                const blob = new Blob([report], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `CricMates_${matchId}.html`; a.click();
              }}><Download className="w-4 h-4 mr-2" /> Match Report</Button>
              <Button size="sm" variant="outline" className="flex-1 md:flex-none h-12 px-6 font-black text-[10px] uppercase border-primary text-primary shadow-sm" onClick={() => setIsShareDialogOpen(true)}>
                <Share2 className="w-4 h-4 mr-2" /> Share Card
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center border-t pt-4">
            <p className="text-[10px] md:text-xs font-black uppercase text-primary tracking-[0.2em]">{match.status === 'completed' ? match.resultDescription : `Innings ${match.currentInningNumber} in Progress`}</p>
            {match.status === 'completed' && match.potmPlayerId && (
              <Badge className="bg-amber-500 text-white font-black uppercase text-[8px] flex items-center gap-1 shrink-0 whitespace-nowrap px-3 py-1.5 h-auto">
                <Star className="w-2.5 h-2.5" /> POTM: {getPlayerName(match.potmPlayerId)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-50 bg-white/80 backdrop-blur-md border-b shadow-sm overflow-x-auto scrollbar-hide">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-start rounded-none bg-transparent h-auto p-0 scrollbar-hide min-w-max">
            {['Live', 'Scorecard', 'Analytics', 'Overs', 'Info'].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase()} className="px-6 py-4 text-xs font-black rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary uppercase tracking-widest">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab}>
        <TabsContent value="live" className="space-y-6 pt-4">
          {isUmpire && match.status !== 'completed' && activeInningData && (
            <Card className="shadow-lg border-none overflow-hidden bg-slate-900 text-white">
              <CardHeader className="bg-white/5 py-4 border-b border-white/5 flex flex-row justify-between items-center">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Official Scorer</CardTitle>
                  <Badge variant="outline" className="text-[8px] font-black uppercase border-white/20 text-white px-2">
                    Innings {match.currentInningNumber}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={handleUndo} className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/10">
                  <Undo2 className="w-3 h-3 mr-1" /> Undo Ball
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                {activeInningData.isDeclaredFinished ? (
                  <div className="py-8 text-center space-y-6">
                    <div className="p-4 bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
                      <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                      <h3 className="text-xl font-black uppercase tracking-tighter">Innings Complete</h3>
                    </div>
                    {match.currentInningNumber === 1 ? (
                      <Button onClick={handleStartSecondInnings} className="w-full h-16 bg-primary text-white font-black uppercase text-lg tracking-widest shadow-2xl">START 2ND INNINGS <ChevronRight className="ml-2 w-6 h-6" /></Button>
                    ) : (
                      <Button onClick={handleFinishMatch} variant="secondary" disabled={isFinalizing} className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-lg tracking-widest shadow-2xl">
                        {isFinalizing ? <Loader2 className="animate-spin w-6 h-6" /> : <>FINISH MATCH <CheckCircle2 className="ml-2 w-6 h-6" /></>}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
                      {[0, 1, 2, 3, 4, 6].map(r => (<Button key={r} onClick={() => handleRecordBall(r)} className={cn("h-14 md:h-16 text-xl md:text-2xl font-black bg-white/5 border-2 border-white/10", r >= 4 ? "text-primary" : "text-white")}>{r === 0 ? "•" : r}</Button>))}
                      <Button onClick={() => handleRecordBall(1, 'none', true)} className="h-14 md:h-16 flex flex-col items-center justify-center bg-secondary/20 border-2 border-secondary/40 text-secondary"><span className="text-lg font-black">1D</span><span className="text-[6px] font-bold uppercase leading-none mt-1">No Strike</span></Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-10 font-black text-[9px] border-amber-500/40 text-amber-500 uppercase">Wide</Button>
                      <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-10 font-black text-[9px] border-amber-500/40 text-amber-500 uppercase">No Ball</Button>
                      <Button variant="outline" onClick={() => { setWicketForm(prev => ({ ...prev, batterOutId: activeInningData.strikerPlayerId })); setIsWicketDialogOpen(true); }} className="h-10 font-black text-[9px] border-red-500/40 text-red-500 uppercase">Wicket</Button>
                      <Button variant="outline" onClick={() => { setWicketForm(prev => ({ ...prev, batterOutId: activeInningData.strikerPlayerId, type: 'retired' })); handleWicket(); }} className="h-10 font-black text-[9px] border-blue-500/40 text-blue-500 uppercase">Retire</Button>
                      <Button variant="outline" onClick={() => { setAssignmentForm({ strikerId: activeInningData.strikerPlayerId, nonStrikerId: activeInningData.nonStrikerPlayerId || '', bowlerId: activeInningData.currentBowlerPlayerId || '' }); setIsPlayerAssignmentOpen(true); }} className="h-10 font-black text-[9px] border-white/20 text-white uppercase">Assign</Button>
                    </div>
                    <div className="mt-6 border-t border-white/10 pt-6">
                      {match.currentInningNumber === 1 ? (
                        <Button onClick={handleManualEndInnings} className="w-full h-12 bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10">
                          <Flag className="w-4 h-4 mr-2" /> End 1st Innings
                        </Button>
                      ) : (
                        <Button onClick={handleFinishMatch} disabled={isFinalizing} className="w-full h-12 bg-emerald-600/20 border border-emerald-600/40 text-emerald-500 font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600/30">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-lg border-none overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b py-3 px-6">
                  <span className="text-[10px] font-black uppercase text-slate-500">Batting Stats</span>
                </CardHeader>
                <div className="p-6 space-y-4">
                  {[
                    { id: activeInningData.strikerPlayerId, label: 'Striker', active: true },
                    { id: activeInningData.nonStrikerPlayerId, label: 'Non-Striker', active: false }
                  ].map((batter, i) => {
                    const stats = currentStats.batting.find(b => b.id === batter.id);
                    return (
                      <div key={i} className={cn("flex justify-between items-center p-4 rounded-xl border-2 transition-all", batter.active ? "bg-primary/5 border-primary shadow-sm" : "bg-slate-50 border-transparent opacity-60")}>
                        <div className="min-w-0">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{batter.label}</p>
                          <p className="font-black text-lg truncate uppercase tracking-tight text-slate-900">{getPlayerName(batter.id)}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-right">
                          <div><p className="text-xl font-black">{stats?.runs || 0}</p><p className="text-[7px] font-bold text-slate-400 uppercase">Runs</p></div>
                          <div><p className="text-xl font-black">{stats?.balls || 0}</p><p className="text-[7px] font-bold text-slate-400 uppercase">Balls</p></div>
                          <div><p className="text-xl font-black">{stats?.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '0.0'}</p><p className="text-[7px] font-bold text-slate-400 uppercase">SR</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="shadow-lg border-none overflow-hidden bg-slate-900 text-white">
                <CardHeader className="bg-white/5 border-b border-white/5 py-3 px-6">
                  <span className="text-[10px] font-black uppercase text-slate-500">Bowling Spell</span>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Zap className="text-secondary w-5 h-5" />
                      <div>
                        <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Active Bowler</p>
                        <p className="font-black text-lg truncate uppercase tracking-tight">{getPlayerName(activeInningData.currentBowlerPlayerId)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-secondary">
                        {currentStats.bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.wickets || 0}-
                        {currentStats.bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.runs || 0}
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase">Current Figures</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">This Over History</p>
                    <div className="flex gap-2">
                      {currentBowlerHistory.map((d, idx) => (
                        <Badge key={idx} className={cn("h-8 w-8 rounded-full flex items-center justify-center font-black p-0 border-2", 
                          d.isWicket ? "bg-red-500 border-red-600 text-white" : 
                          d.runsScored >= 4 ? "bg-primary border-primary/50 text-white" : "bg-white/10 border-white/5 text-white")}>
                          {d.isWicket ? "W" : d.totalRunsOnDelivery}
                        </Badge>
                      ))}
                      {[...Array(Math.max(0, 6 - currentBowlerHistory.length))].map((_, idx) => (
                        <div key={`empty-${idx}`} className="h-8 w-8 rounded-full border-2 border-white/5 flex items-center justify-center text-white/10 font-black">•</div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
                    <div>
                      <p className="text-lg font-black">{activeInningData.oversCompleted}.{activeInningData.ballsInCurrentOver}</p>
                      <p className="text-[7px] font-bold text-slate-500 uppercase">Overs</p>
                    </div>
                    <div>
                      <p className="text-lg font-black">
                        {(() => {
                          const bowlStats = currentStats.bowling.find(b => b.id === activeInningData.currentBowlerPlayerId);
                          if (!bowlStats || bowlStats.balls === 0) return '0.00';
                          return (bowlStats.runs / (bowlStats.balls / 6)).toFixed(2);
                        })()}
                      </p>
                      <p className="text-[7px] font-bold text-slate-500 uppercase">Economy</p>
                    </div>
                    <div>
                      <p className="text-lg font-black">{currentStats.bowling.find(b => b.id === activeInningData.currentBowlerPlayerId)?.maidens || 0}</p>
                      <p className="text-[7px] font-bold text-slate-500 uppercase">Maidens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scorecard" className="pt-4 space-y-6">
          <Tabs value={activeScorecardSubTab} onValueChange={(v: any) => setActiveScorecardSubTab(v)}>
            <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="inn1" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg uppercase text-[10px] tracking-widest">{getTeamName(inn1?.battingTeamId)}</TabsTrigger>
              <TabsTrigger value="inn2" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg uppercase text-[10px] tracking-widest">{getTeamName(inn2?.battingTeamId)}</TabsTrigger>
            </TabsList>
            
            {[
              { id: 'inn1', stats: stats1, team: getTeamName(inn1?.battingTeamId), inning: inn1 },
              { id: 'inn2', stats: stats2, team: getTeamName(inn2?.battingTeamId), inning: inn2 }
            ].map((inn) => (
              <TabsContent key={inn.id} value={inn.id} className="space-y-6 m-0">
                <Card className="border-none shadow-sm overflow-hidden">
                  <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                    <h3 className="font-black uppercase text-sm tracking-widest">{inn.team} Batting</h3>
                    <p className="text-xl font-black">{inn.inning?.score || 0}/{inn.inning?.wickets || 0} <span className="text-[10px] font-bold opacity-50">({inn.inning?.oversCompleted || 0}.{inn.inning?.ballsInCurrentOver || 0})</span></p>
                  </div>
                  <Table>
                    <TableHeader className="bg-slate-50">
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
                      {inn.stats.batting.map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell className="py-3">
                            <Link href={`/players/${b.id}`} className="font-black text-xs text-primary hover:underline uppercase block">{getPlayerName(b.id)}</Link>
                            <span className="text-[8px] font-bold text-slate-400 uppercase italic">
                              {b.out ? `${b.dismissal} b ${getPlayerName(b.bowlerId)}` : 'not out'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-black">{b.runs}</TableCell>
                          <TableCell className="text-right text-xs text-slate-500">{b.balls}</TableCell>
                          <TableCell className="text-right text-xs text-slate-500">{b.fours}</TableCell>
                          <TableCell className="text-right text-xs text-slate-500">{b.sixes}</TableCell>
                          <TableCell className="text-right text-[10px] font-bold text-slate-400">
                            {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                <Card className="border-none shadow-sm overflow-hidden">
                  <div className="bg-slate-50 px-6 py-3 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Partnership History</span></div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase">Partners</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase">Runs</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase">Contribution</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inn.stats.partnerships.map((p: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <p className="text-[10px] font-black uppercase">{getPlayerName(p.batter1Id)} & {getPlayerName(p.batter2Id)}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{p.balls} balls</p>
                          </TableCell>
                          <TableCell className="text-right font-black">{p.runs}</TableCell>
                          <TableCell className="text-right">
                            <div className="text-[8px] font-bold uppercase text-slate-500">
                              {getPlayerName(p.batter1Id).split(' ')[0]}: {p.batter1Runs} | {getPlayerName(p.batter2Id).split(' ')[0]}: {p.batter2Runs}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-none shadow-sm">
                    <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Fall of Wickets</span></div>
                    <CardContent className="p-4 space-y-2">
                      {inn.stats.fow.length > 0 ? inn.stats.fow.map((f: any) => (
                        <div key={f.wicketNum} className="flex justify-between items-center text-[10px] py-1 border-b border-slate-50 last:border-none">
                          <span className="font-bold text-slate-400">{f.wicketNum}-{f.scoreAtWicket}</span>
                          <span className="font-black uppercase">{getPlayerName(f.playerOutId)}</span>
                          <span className="text-slate-400">({f.overs} ov)</span>
                        </div>
                      )) : <p className="text-center py-4 text-[10px] font-black text-slate-300 uppercase italic">No wickets fallen</p>}
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-sm">
                    <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Bowling</span></div>
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="text-[8px] font-black uppercase">Bowler</TableHead>
                          <TableHead className="text-right text-[8px] font-black uppercase">O</TableHead>
                          <TableHead className="text-right text-[8px] font-black uppercase">R</TableHead>
                          <TableHead className="text-right text-[8px] font-black uppercase">W</TableHead>
                          <TableHead className="text-right text-[8px] font-black uppercase">Eco</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inn.stats.bowling.map((b: any) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-black text-xs uppercase py-3">{getPlayerName(b.id)}</TableCell>
                            <TableCell className="text-right text-xs">{b.oversDisplay}</TableCell>
                            <TableCell className="text-right text-xs font-bold">{b.runs}</TableCell>
                            <TableCell className="text-right text-xs font-black text-primary">{b.wickets}</TableCell>
                            <TableCell className="text-right text-[10px] font-bold text-slate-400">
                              {b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        <TabsContent value="analytics" className="pt-4 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 shadow-sm border-none bg-white">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-8 border-b pb-2 flex items-center gap-2">
                <LineChartIcon className="w-4 h-4 text-primary" /> Cumulative Scoring (Worm)
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                    <Area type="monotone" name={getTeamName(match.team1Id)} dataKey="team1" stroke="#2563eb" fillOpacity={1} fill="url(#colorT1)" dot={<CustomWicketDot team="team1" />} />
                    <Area type="monotone" name={getTeamName(match.team2Id)} dataKey="team2" stroke="#0d9488" fillOpacity={1} fill="url(#colorT2)" dot={<CustomWicketDot team="team2" />} />
                    <defs>
                      <linearGradient id="colorT1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorT2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0d9488" stopOpacity={0.1}/><stop offset="95%" stopColor="#0d9488" stopOpacity={0}/></linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6 shadow-sm border-none bg-white">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-8 border-b pb-2 flex items-center gap-2">
                <BarChart className="w-4 h-4 text-secondary" /> Over-by-Over Runs
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={overByOverData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="over" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 900 }} />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 900 }} />
                    <Bar name={getTeamName(match.team1Id)} dataKey="team1" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar name={getTeamName(match.team2Id)} dataKey="team2" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overs" className="pt-4">
          <div className="space-y-6">
            {[
              { id: 'inning_1', name: getTeamName(inn1?.battingTeamId), deliveries: inn1Deliveries },
              { id: 'inning_2', name: getTeamName(inn2?.battingTeamId), deliveries: inn2Deliveries }
            ].map((inn) => (
              <Card key={inn.id} className="border-none shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b flex justify-between items-center">
                  <h3 className="font-black uppercase text-xs tracking-widest text-slate-500">{inn.name} Deliveries</h3>
                  <Badge variant="outline" className="text-[8px] font-black uppercase">{inn.deliveries?.length || 0} Total</Badge>
                </div>
                <div className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16 text-[9px] font-black uppercase">Over</TableHead>
                        <TableHead className="text-[9px] font-black uppercase">Battle</TableHead>
                        <TableHead className="text-center text-[9px] font-black uppercase w-20">Runs</TableHead>
                        <TableHead className="text-[9px] font-black uppercase">Result</TableHead>
                        {isUmpire && <TableHead className="w-10"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inn.deliveries?.slice().reverse().map((d) => (
                        <TableRow key={d.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-black text-xs text-slate-400">{d.overNumber}.{d.ballNumberInOver}</TableCell>
                          <TableCell>
                            <p className="text-[9px] font-black text-slate-900 uppercase leading-none">{getPlayerName(d.strikerPlayerId)}</p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">vs {getPlayerName(d.bowlerId)}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("font-black h-6 w-6 rounded-full p-0 flex items-center justify-center", 
                              d.isWicket ? "bg-red-500 text-white" : 
                              d.runsScored >= 4 ? "bg-primary text-white" : "bg-slate-100 text-slate-600")}>
                              {d.isWicket ? "W" : d.totalRunsOnDelivery}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {d.isWicket ? (
                              <Badge variant="destructive" className="text-[7px] font-black uppercase py-0">{d.dismissalType}</Badge>
                            ) : (
                              <span className="text-[8px] font-bold text-slate-400 uppercase">{d.extraType !== 'none' ? d.extraType : 'Legal'}</span>
                            )}
                          </TableCell>
                          {isUmpire && (
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-destructive" onClick={() => handleDeleteHistoricalBall(d.id, inn.id)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="info" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Official Match Details</span></div>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: 'Match Date', val: match.matchDate ? new Date(match.matchDate).toLocaleDateString() : '---', icon: CalendarIcon },
                  { label: 'Format', val: `${match.totalOvers} Overs per Inning`, icon: Clock },
                  { label: 'Toss Result', val: `${getTeamName(match.tossWinnerTeamId)} won and chose to ${match.tossDecision}`, icon: Trophy },
                  { label: 'Official Status', val: match.status.toUpperCase(), icon: ShieldCheck }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-slate-50 pb-3 last:border-none last:pb-0">
                    <item.icon className="w-4 h-4 text-primary" />
                    <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p><p className="text-xs font-black text-slate-900 uppercase">{item.val}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Official Squads</span></div>
              <CardContent className="p-6 grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-primary border-b pb-1">{getTeamName(match.team1Id)}</p>
                  {match.team1SquadPlayerIds?.map((pid: string) => (
                    <Link key={pid} href={`/players/${pid}`} className="text-[10px] font-bold text-slate-600 block hover:text-primary truncate">{getPlayerName(pid)}</Link>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-secondary border-b pb-1">{getTeamName(match.team2Id)}</p>
                  {match.team2SquadPlayerIds?.map((pid: string) => (
                    <Link key={pid} href={`/players/${pid}`} className="text-[10px] font-bold text-slate-600 block hover:text-secondary truncate">{getPlayerName(pid)}</Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* SHARE CARD DIALOG */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-lg p-0 border-none bg-transparent shadow-none overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Match Result Share Card</DialogTitle>
            <DialogDescription>Professional visual summary of match results.</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-900 text-white rounded-3xl overflow-hidden border-4 border-primary shadow-2xl relative p-8 space-y-8">
            <div className="text-center space-y-2">
              <Badge className="bg-primary text-white font-black uppercase text-[10px] px-4 py-1">OFFICIAL SCORECARD</Badge>
              <h2 className="text-2xl font-black tracking-tighter uppercase">{getTeamName(match.team1Id)} VS {getTeamName(match.team2Id)}</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">{new Date(match.matchDate).toLocaleDateString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 items-center">
              <div className="text-center space-y-1">
                <p className="text-[9px] font-black text-primary uppercase">{getTeamName(inn1?.battingTeamId)}</p>
                <p className="text-4xl font-black">{inn1?.score || 0}/{inn1?.wickets || 0}</p>
              </div>
              <div className="text-center space-y-1 border-l border-white/10">
                <p className="text-[9px] font-black text-secondary uppercase">{getTeamName(inn2?.battingTeamId)}</p>
                <p className="text-4xl font-black">{inn2?.score || 0}/{inn2?.wickets || 0}</p>
              </div>
            </div>
            <div className="text-center p-4 bg-primary/20 rounded-xl border border-primary/30">
              <p className="text-sm font-black uppercase italic text-primary tracking-tight">{match.resultDescription}</p>
            </div>
            <div className="pt-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-secondary" /><span className="font-black text-lg text-white tracking-tighter">CricMates</span></div>
            </div>
          </div>
          <div className="mt-6 flex justify-center pb-6">
            <Button className="font-black uppercase tracking-widest" onClick={() => toast({ title: "Screenshot Ready" })}><Camera className="mr-2 w-4 h-4" /> Screenshot to Share</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WICKET DIALOG */}
      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-destructive">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-destructive">Register Out</DialogTitle>
            <DialogDescription className="text-xs uppercase font-bold text-slate-400">Details for {getPlayerName(wicketForm.batterOutId)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Dismissal Type</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}>
                <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['bowled', 'caught', 'runout', 'stumped', 'hit-wicket'].map(t => (<SelectItem key={t} value={t} className="font-bold uppercase text-xs">{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Fielder (Optional)</Label>
              <Select value={wicketForm.fielderId} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}>
                <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="font-bold text-slate-400">(NONE)</SelectItem>
                  {allPlayers?.filter(p => bowlingSquadPlayerIds.includes(p.id)).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleWicket} className="w-full h-14 bg-destructive text-white font-black uppercase shadow-xl">Confirm Wicket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POSITION ASSIGNMENT DIALOG */}
      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-primary">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Active Positions</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase text-slate-400">Assign participants to their match roles. Retired players may return to the crease.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Striker</Label>
              <Select value={assignmentForm.strikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}>
                <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Striker" /></SelectTrigger>
                <SelectContent>
                  {allPlayers?.filter(p => {
                    const isNS = p.id === assignmentForm.nonStrikerId;
                    const isSquad = battingSquadPlayerIds.includes(p.id);
                    const stats = currentStats.batting.find(b => b.id === p.id);
                    const isAvailable = !stats?.out || stats?.dismissal === 'retired';
                    return isSquad && !isNS && isAvailable;
                  }).map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">
                      {p.name} {currentStats.batting.find(b => b.id === p.id)?.dismissal === 'retired' ? '(Retired)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Non-Striker</Label>
              <Select value={assignmentForm.nonStrikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v})}>
                <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Non-Striker" /></SelectTrigger>
                <SelectContent>
                  {allPlayers?.filter(p => {
                    const isStriker = p.id === assignmentForm.strikerId;
                    const isSquad = battingSquadPlayerIds.includes(p.id);
                    const stats = currentStats.batting.find(b => b.id === p.id);
                    const isAvailable = !stats?.out || stats?.dismissal === 'retired';
                    return isSquad && !isStriker && isAvailable;
                  }).map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">
                      {p.name} {currentStats.batting.find(b => b.id === p.id)?.dismissal === 'retired' ? '(Retired)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Active Bowler</Label>
              <Select value={assignmentForm.bowlerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}>
                <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Bowler" /></SelectTrigger>
                <SelectContent>
                  {allPlayers?.filter(p => bowlingSquadPlayerIds.includes(p.id)).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateAssignment} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl">Apply Positions</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
