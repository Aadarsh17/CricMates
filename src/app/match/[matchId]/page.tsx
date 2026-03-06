
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Info, Trash2, Download, Loader2, Zap, LineChart as LineChartIcon, BarChart, ChevronRight, History, PlayCircle, CheckCircle2, Star, Users, Clock, Calendar as CalendarIcon, Undo2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, BarChart as ReBarChart, Bar } from "recharts";
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { generateHTMLReport, getExtendedInningStats, getMatchFlow } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activeScorecardSubTab, setActiveScorecardSubTab] = useState<'inn1' | 'inn2' | 'flow'>('inn1');
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [wicketForm, setWicketForm] = useState({
    type: 'bowled',
    batterOutId: '',
    fielderId: 'none',
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

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || []), [inn1Deliveries]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || []), [inn2Deliveries]);

  const inn1Score = useMemo(() => inn1Deliveries?.reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0) || 0, [inn1Deliveries]);
  const inn1Wickets = useMemo(() => inn1Deliveries?.filter(d => d.isWicket && d.dismissalType !== 'retired').length || 0, [inn1Deliveries]);
  const inn1BallsCount = useMemo(() => inn1Deliveries?.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length || 0, [inn1Deliveries]);
  const inn1OversDisplay = `${Math.floor(inn1BallsCount / 6)}.${inn1BallsCount % 6}`;

  const inn2Score = useMemo(() => inn2Deliveries?.reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0) || 0, [inn2Deliveries]);
  const inn2Wickets = useMemo(() => inn2Deliveries?.filter(d => d.isWicket && d.dismissalType !== 'retired').length || 0, [inn2Deliveries]);
  const inn2BallsCount = useMemo(() => inn2Deliveries?.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length || 0, [inn2Deliveries]);
  const inn2OversDisplay = `${Math.floor(inn2BallsCount / 6)}.${inn2BallsCount % 6}`;

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

  // Header Team Mapping Fix
  const t1Header = useMemo(() => {
    if (!match) return { name: '---', score: 0, wkts: 0, overs: '0.0' };
    if (inn1?.battingTeamId === match.team1Id) return { name: getTeamName(match.team1Id), score: inn1Score, wkts: inn1Wickets, overs: inn1OversDisplay };
    if (inn2?.battingTeamId === match.team1Id) return { name: getTeamName(match.team1Id), score: inn2Score, wkts: inn2Wickets, overs: inn2OversDisplay };
    return { name: getTeamName(match.team1Id), score: 0, wkts: 0, overs: '0.0' };
  }, [match, inn1, inn2, inn1Score, inn1Wickets, inn1OversDisplay, inn2Score, inn2Wickets, inn2OversDisplay, allTeams]);

  const t2Header = useMemo(() => {
    if (!match) return { name: '---', score: 0, wkts: 0, overs: '0.0' };
    if (inn1?.battingTeamId === match.team2Id) return { name: getTeamName(match.team2Id), score: inn1Score, wkts: inn1Wickets, overs: inn1OversDisplay };
    if (inn2?.battingTeamId === match.team2Id) return { name: getTeamName(match.team2Id), score: inn2Score, wkts: inn2Wickets, overs: inn2OversDisplay };
    return { name: getTeamName(match.team2Id), score: 0, wkts: 0, overs: '0.0' };
  }, [match, inn1, inn2, inn1Score, inn1Wickets, inn1OversDisplay, inn2Score, inn2Wickets, inn2OversDisplay, allTeams]);

  const currentBattingSquadIds = useMemo(() => {
    if (!match) return '';
    if (match.currentInningNumber === 1) {
      return match.tossWinnerTeamId === match.team1Id 
        ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id)
        : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
    } else {
      return inn1?.bowlingTeamId || '';
    }
  }, [match, inn1]);

  const isInningsOver = useMemo(() => {
    if (!activeInningData || !match) return false;
    const currentBalls = match.currentInningNumber === 1 ? inn1BallsCount : inn2BallsCount;
    return currentBalls >= (match.totalOvers * 6) || activeInningData.isDeclaredFinished;
  }, [activeInningData, match, inn1BallsCount, inn2BallsCount]);

  const overGroups1 = useMemo(() => {
    if (!inn1Deliveries) return null;
    const groups: Record<number, any[]> = {};
    inn1Deliveries.forEach(d => {
      if (!groups[d.overNumber]) groups[d.overNumber] = [];
      groups[d.overNumber].push(d);
    });
    return groups;
  }, [inn1Deliveries]);

  const overGroups2 = useMemo(() => {
    if (!inn2Deliveries) return null;
    const groups: Record<number, any[]> = {};
    inn2Deliveries.forEach(d => {
      if (!groups[d.overNumber]) groups[d.overNumber] = [];
      groups[d.overNumber].push(d);
    });
    return groups;
  }, [inn2Deliveries]);

  const wormData = useMemo(() => {
    const data: any[] = [];
    const maxBalls = Math.max(inn1Deliveries?.length || 0, inn2Deliveries?.length || 0);
    let s1 = 0; let s2 = 0;
    for (let i = 0; i < maxBalls; i++) {
      const d1 = inn1Deliveries?.[i]; const d2 = inn2Deliveries?.[i];
      if (d1) s1 += (d1.totalRunsOnDelivery || 0);
      if (d2) s2 += (d2.totalRunsOnDelivery || 0);
      data.push({ 
        ball: i + 1, 
        team1: d1 ? s1 : null, 
        team2: d2 ? s2 : null,
        team1Wicket: d1?.isWicket && d1.dismissalType !== 'retired',
        team2Wicket: d2?.isWicket && d2.dismissalType !== 'retired'
      });
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries]);

  const manhattanData = useMemo(() => {
    const data: any[] = [];
    const maxOvers = Math.max(match?.totalOvers || 0, Object.keys(overGroups1 || {}).length, Object.keys(overGroups2 || {}).length);
    for (let o = 1; o <= maxOvers; o++) {
      data.push({
        over: o,
        team1: overGroups1?.[o]?.reduce((acc, d) => acc + d.totalRunsOnDelivery, 0) || 0,
        team2: overGroups2?.[o]?.reduce((acc, d) => acc + d.totalRunsOnDelivery, 0) || 0,
      });
    }
    return data;
  }, [overGroups1, overGroups2, match?.totalOvers]);

  const flowEvents = useMemo(() => {
    if (!match || !allPlayers || !inn1) return [];
    const flow1 = getMatchFlow(inn1Deliveries || [], getTeamName(inn1.battingTeamId), allPlayers || []);
    const flow2 = inn2 ? getMatchFlow(inn2Deliveries || [], getTeamName(inn2.battingTeamId), allPlayers || []) : [];
    const events = [...flow1, ...flow2];
    if (match.status === 'completed') {
      events.push({ type: 'header', title: match.resultDescription });
    }
    return events;
  }, [match, inn1Deliveries, inn2Deliveries, allPlayers, inn1, inn2]);

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none', noStrikeChange: boolean = false) => {
    if (!match || !activeInningData || !isUmpire || isInningsOver) return;
    if (!activeInningData.currentBowlerPlayerId) { setIsPlayerAssignmentOpen(true); return; }

    const currentInningId = `inning_${match.currentInningNumber}`;
    let ballRuns = runs; let extraRuns = 0; let isLegalBall = true;
    if (extraType === 'wide') { extraRuns = runs + 1; ballRuns = 0; isLegalBall = false; }
    else if (extraType === 'noball') { extraRuns = 1; ballRuns = runs; isLegalBall = false; }
    else if (extraType === 'bye' || extraType === 'legbye') { extraRuns = runs; ballRuns = 0; }
    
    const totalRunsOnDelivery = ballRuns + extraRuns;
    const currentBallsCount = match.currentInningNumber === 1 ? inn1BallsCount : inn2BallsCount;
    
    let newBallsInOver = activeInningData.ballsInCurrentOver + (isLegalBall ? 1 : 0);
    let newOversComp = activeInningData.oversCompleted;
    let shouldClearBowler = false;
    if (newBallsInOver === 6) { newOversComp += 1; newBallsInOver = 0; shouldClearBowler = true; }

    const isTerminallyFinished = (currentBallsCount + (isLegalBall ? 1 : 0)) >= (match.totalOvers * 6);

    let nextStriker = activeInningData.strikerPlayerId;
    let nextNonStriker = activeInningData.nonStrikerPlayerId || 'none';

    if (!activeInningData.isLastManActive && !noStrikeChange && runs % 2 !== 0) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }

    if (shouldClearBowler && !activeInningData.isLastManActive) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }

    const deliveryData = { 
      id: doc(collection(db, 'temp')).id, 
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
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    const updates: any = { 
      score: activeInningData.score + totalRunsOnDelivery, 
      oversCompleted: newOversComp, 
      ballsInCurrentOver: newBallsInOver,
      strikerPlayerId: nextStriker,
      nonStrikerPlayerId: nextNonStriker
    };
    
    if (shouldClearBowler) updates.currentBowlerPlayerId = '';
    if (isTerminallyFinished) updates.isDeclaredFinished = true;
    
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    if (shouldClearBowler && !isTerminallyFinished) setIsPlayerAssignmentOpen(true);
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
    const team1Name = getTeamName(inn1.battingTeamId); // Batted 1st (Defending)
    const team2Name = getTeamName(inn2.battingTeamId); // Batted 2nd (Chasing)

    if (inn2Score > inn1Score) { 
      const squadSize = match.team2SquadPlayerIds?.length || 11;
      const wicketsRemaining = Math.max(0, (squadSize - 1) - inn2Wickets);
      result = `${team2Name} won by ${wicketsRemaining} ${wicketsRemaining === 1 ? 'wicket' : 'wickets'}.`; 
    }
    else if (inn1Score > inn2Score) { 
      result = `${team1Name} won by ${inn1Score - inn2Score} runs.`; 
    }
    else { 
      result = "Match Tied."; 
    }

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
    const currentBallsCount = (match.currentInningNumber === 1 ? inn1BallsCount : inn2BallsCount) + 1;
    const isTerminallyFinished = currentBallsCount >= (match.totalOvers * 6);
    const deliveryData = { id: doc(collection(db, 'temp')).id, overNumber: newBalls === 0 ? newOvers : newOvers + 1, ballNumberInOver: newBalls === 0 ? 6 : newBalls, strikerPlayerId: activeInningData.strikerPlayerId, nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', bowlerId: activeInningData.currentBowlerPlayerId, runsScored: 0, extraRuns: 0, extraType: 'none', totalRunsOnDelivery: 0, isWicket: true, dismissalType: wicketForm.type, batsmanOutPlayerId: wicketForm.batterOutId, fielderPlayerId: wicketForm.fielderId, timestamp: Date.now() };
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    let nextStriker = wicketForm.batterOutId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId;
    let nextNonStriker = wicketForm.batterOutId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId;

    if (newBalls === 0 && !activeInningData.isLastManActive) {
      [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
    }

    const updates: any = { 
      wickets: activeInningData.wickets + (wicketForm.type === 'retired' ? 0 : 1), 
      oversCompleted: newOvers, 
      ballsInCurrentOver: newBalls,
      strikerPlayerId: nextStriker,
      nonStrikerPlayerId: nextNonStriker
    };

    if (newBalls === 0) updates.currentBowlerPlayerId = '';
    if (isTerminallyFinished) updates.isDeclaredFinished = true;
    if (wicketForm.decision === 'finish') updates.isDeclaredFinished = true;
    else if (wicketForm.decision === 'last_man') { 
      updates.isLastManActive = true; 
      updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId; 
      updates.nonStrikerPlayerId = ''; 
    }
    
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsWicketDialogOpen(false); if (newBalls === 0 && !updates.isDeclaredFinished) setIsPlayerAssignmentOpen(true);
  };

  const handleUndo = async () => {
    if (!match || !activeInningData || !isUmpire) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords');
    const q = query(deliveriesRef, orderBy('timestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      toast({ title: "Nothing to undo" });
      return;
    }

    const lastBall = snapshot.docs[0].data();
    await deleteDocumentNonBlocking(snapshot.docs[0].ref);

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

    toast({ title: "Undone successfully" });
  };

  const handleDeleteHistoricalBall = async (ball: any, inningId: string) => {
    if (!isUmpire) return;
    if (!confirm("Delete this delivery? The match will be reverted to 'Live' status for corrections.")) return;

    await deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords', ball.id));

    const currentList = inningId === 'inning_1' ? inn1Deliveries : inn2Deliveries;
    if (!currentList) return;

    const remaining = currentList.filter(d => d.id !== ball.id);
    const score = remaining.reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
    const wkts = remaining.filter(d => d.isWicket && d.dismissalType !== 'retired').length;
    const legalBalls = remaining.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length;

    const updates: any = {
      score: score,
      wickets: wkts,
      oversCompleted: Math.floor(legalBalls / 6),
      ballsInCurrentOver: legalBalls % 6,
      isDeclaredFinished: false 
    };

    const sorted = [...remaining].sort((a,b) => b.timestamp - a.timestamp);
    if (sorted.length > 0) {
      const latest = sorted[0];
      updates.strikerPlayerId = latest.strikerPlayerId;
      updates.nonStrikerPlayerId = latest.nonStrikerPlayerId;
      updates.currentBowlerPlayerId = latest.bowlerId;
    } else {
      updates.strikerPlayerId = '';
      updates.nonStrikerPlayerId = '';
      updates.currentBowlerPlayerId = '';
    }

    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates);
    
    if (match?.status === 'completed') {
      updateDocumentNonBlocking(matchRef, { 
        status: 'live', 
        resultDescription: 'Match in Progress' 
      });
      toast({ title: "Match Reverted", description: "The match is now LIVE. You can add corrected deliveries." });
    } else {
      toast({ title: "Ball Deleted", description: "Innings totals have been synchronized." });
    }
  };

  const InningsLiveStats = ({ stats, title, score, wkts, overs, inningData }: { stats: any, title: string, score: number, wkts: number, overs: string, inningData: any }) => {
    if (!inningData) return null;
    return (
      <div className="space-y-4">
        <div className="bg-slate-50 px-4 py-2 border rounded-lg flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500">{title}</span><span className="text-xs font-black text-primary">{score}/{wkts} ({overs} OV)</span></div>
        <Card className="shadow-sm border-none bg-white overflow-hidden">
          <div className="overflow-x-auto"><Table className="min-w-max w-full">
            <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase py-3 px-3">Batters</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">4s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">6s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Status</TableHead></TableRow></TableHeader>
            <TableBody>{stats.batting.map((b: any) => (
              <TableRow key={b.id} className={b.id === inningData.strikerPlayerId ? "bg-primary/5" : ""}>
                <TableCell className="py-2 px-3">
                  <Link href={`/players/${b.id}`} className="group hover:opacity-80 transition-opacity">
                    <p className={cn("font-black text-sm uppercase group-hover:text-primary transition-colors", b.out ? "text-slate-400" : "text-slate-900")}>
                      {getPlayerName(b.id)}{b.id === inningData.strikerPlayerId ? "*" : ""}
                    </p>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-black">{b.runs}</TableCell>
                <TableCell className="text-right text-xs text-slate-500">{b.balls}</TableCell>
                <TableCell className="text-right text-xs text-slate-500">{b.fours}</TableCell>
                <TableCell className="text-right text-xs text-slate-500">{b.sixes}</TableCell>
                <TableCell className="text-right text-xs font-bold text-slate-400">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right"><Badge variant="outline" className={cn("text-[8px] font-black uppercase", b.out ? "text-red-500 border-red-200" : "text-emerald-500 border-emerald-200")}>{b.out ? "OUT" : "BAT"}</Badge></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
          <div className="border-t overflow-x-auto"><Table className="min-w-max w-full">
            <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase py-3 px-3">Bowlers</TableHead><TableHead className="text-right text-[9px] font-black uppercase">O</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">W</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Eco</TableHead></TableRow></TableHeader>
            <TableBody>{stats.bowling.map((bw: any) => (
              <TableRow key={bw.id} className={bw.id === inningData.currentBowlerPlayerId ? "bg-secondary/5" : ""}>
                <TableCell className="py-2 px-3">
                  <Link href={`/players/${bw.id}`} className="hover:opacity-80 transition-opacity">
                    <p className="font-black text-sm uppercase text-slate-900">{getPlayerName(bw.id)}</p>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-bold">{bw.oversDisplay}</TableCell><TableCell className="text-right text-xs text-slate-500">{bw.runs}</TableCell><TableCell className="text-right font-black text-primary">{bw.wickets}</TableCell><TableCell className="text-right text-xs font-bold text-slate-400">{bw.balls > 0 ? (bw.runs/(bw.balls/6)).toFixed(2) : '0.00'}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        </Card>
      </div>
    );
  };

  const HistoryCard = ({ title, groups, isLoading, icon: Icon }: { title: string, groups: Record<number, any[]> | null, isLoading: boolean, icon: any }) => (
    <Card className="shadow-sm border-none bg-white">
      <CardHeader className="py-4 border-b"><CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Icon className="w-4 h-4 text-primary" /> {title}</CardTitle></CardHeader>
      <CardContent className="p-4 space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide">
        {isLoading ? (<div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>) : groups && Object.keys(groups).length > 0 ? Object.keys(groups).sort((a, b) => parseInt(b) - parseInt(a)).map(oNum => {
          const over = groups[parseInt(oNum)];
          return (
            <div key={oNum} className="space-y-2 pb-4 border-b last:border-none">
              <div className="flex justify-between items-center"><span className="text-[9px] font-black uppercase text-slate-400">Over {oNum}</span><span className="text-[9px] font-black text-primary uppercase">{over.reduce((acc, curr) => acc + curr.totalRunsOnDelivery, 0)} Runs</span></div>
              <div className="flex flex-wrap gap-1.5">{over.map((d, idx) => {
                const label = d.isWicket ? "W" : d.extraType === 'wide' ? `WD+${d.runsScored}` : d.extraType === 'noball' ? `NB+${d.runsScored}` : d.runsScored === 0 ? "•" : d.runsScored;
                return (
                  <div key={idx} className={cn("w-fit min-w-[28px] h-7 px-1.5 rounded-lg flex items-center justify-center text-[10px] font-black border shadow-sm", d.isWicket ? "bg-red-600 text-white border-red-700" : d.extraType !== 'none' ? "bg-amber-100 text-amber-700 border-amber-200" : d.runsScored === 4 ? "bg-green-100 text-green-700 border-green-200" : d.runsScored === 6 ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-white text-slate-700 border-slate-200")}>
                    {label}
                  </div>
                );
              })}</div>
            </div>
          );
        }) : <p className="py-12 text-center text-slate-300 font-black text-[9px] uppercase">No deliveries</p>}
      </CardContent>
    </Card>
  );

  const FullScorecardView = ({ stats, teamName, oppTeamName }: { stats: any, teamName: string, oppTeamName: string }) => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="rounded-xl overflow-hidden border shadow-md bg-white">
        <div className="bg-primary/5 px-4 py-3 border-b flex justify-between items-center">
          <span className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Zap className="w-3 h-3"/> Batting: {teamName}</span>
        </div>
        <div className="overflow-x-auto"><Table className="min-w-max w-full">
          <TableHeader className="bg-slate-50/50"><TableRow><TableHead className="text-[9px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">4s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">6s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
          <TableBody>{stats.batting.map((b: any, idx: number) => (<TableRow key={idx} className="hover:bg-slate-50/50 transition-colors"><TableCell className="py-3 px-4">
            <Link href={`/players/${b.id}`} className="hover:opacity-80 transition-opacity">
              <p className="font-black text-xs uppercase text-slate-900">{getPlayerName(b.id)}</p>
            </Link>
            <p className="text-[8px] text-slate-400 font-bold uppercase italic">{b.out ? `${b.dismissal} b ${getPlayerName(b.bowlerId)}` : '(not out)'}</p></TableCell><TableCell className="text-right font-black text-sm">{b.runs}</TableCell><TableCell className="text-right text-xs text-slate-500">{b.balls}</TableCell><TableCell className="text-right text-xs text-slate-500">{b.fours}</TableCell><TableCell className="text-right text-xs text-slate-500">{b.sixes}</TableCell><TableCell className="text-right text-[10px] font-black text-primary">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell></TableRow>))}</TableBody>
        </Table></div>
      </Card>

      <Card className="rounded-xl overflow-hidden border shadow-md bg-white">
        <div className="bg-secondary/5 px-4 py-3 border-b flex justify-between items-center">
          <span className="text-[11px] font-black uppercase tracking-widest text-secondary flex items-center gap-2"><History className="w-3 h-3"/> Bowling: {oppTeamName}</span>
        </div>
        <div className="overflow-x-auto"><Table className="min-w-max w-full">
          <TableHeader className="bg-slate-50/50"><TableRow><TableHead className="text-[9px] font-black uppercase">Bowler</TableHead><TableHead className="text-right text-[9px] font-black uppercase">O</TableHead><TableHead className="text-right text-[9px] font-black uppercase">M</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">W</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Eco</TableHead></TableRow></TableHeader>
          <TableBody>{stats.bowling.map((bw: any, idx: number) => (<TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
            <TableCell className="py-3 px-4">
              <Link href={`/players/${bw.id}`} className="hover:opacity-80 transition-opacity">
                <p className="font-black text-xs uppercase text-slate-900">{getPlayerName(bw.id)}</p>
              </Link>
            </TableCell>
            <TableCell className="text-right font-bold text-xs">{bw.oversDisplay}</TableCell><TableCell className="text-right text-xs text-slate-500">{bw.maidens || 0}</TableCell><TableCell className="text-right font-bold text-xs">{bw.runs}</TableCell><TableCell className="text-right font-black text-sm text-primary">{bw.wickets}</TableCell><TableCell className="text-right text-[10px] font-black text-slate-400">{bw.balls > 0 ? (bw.runs/(bw.balls/6)).toFixed(2) : '0.00'}</TableCell></TableRow>))}</TableBody>
        </Table></div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-xl overflow-hidden border shadow-md bg-white">
          <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Fall of Wickets</span></div>
          <div className="p-4 space-y-3">
            {stats.fow.length > 0 ? stats.fow.map((f: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-[10px] border-b border-dashed pb-2 last:border-none">
                <span className="font-black text-slate-400">{f.wicketNum}-{f.scoreAtWicket}</span>
                <Link href={`/players/${f.playerOutId}`} className="hover:opacity-80 transition-opacity">
                  <span className="font-bold uppercase text-slate-700">{getPlayerName(f.playerOutId)}</span>
                </Link>
                <span className="text-slate-400 font-medium">({f.overs} OV)</span>
              </div>
            )) : <p className="text-center py-4 text-[10px] font-black uppercase text-slate-300">No wickets fell</p>}
          </div>
        </Card>
        <Card className="rounded-xl overflow-hidden border shadow-md bg-white">
          <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Match Partnerships</span></div>
          <div className="p-4 space-y-4">
            {stats.partnerships.length > 0 ? stats.partnerships.map((p: any, idx: number) => (
              <div key={idx} className="space-y-2 border-b border-dashed pb-3 last:border-none">
                <div className="flex justify-between items-center text-[10px]">
                  <div className="flex flex-col gap-1">
                    <Link href={`/players/${p.batter1Id}`} className="hover:opacity-80 transition-opacity">
                      <span className="font-black uppercase truncate max-w-[120px] block">{getPlayerName(p.batter1Id)} <span className="text-primary">({p.batter1Runs})</span></span>
                    </Link>
                    <Link href={`/players/${p.batter2Id}`} className="hover:opacity-80 transition-opacity">
                      <span className="font-black uppercase truncate max-w-[120px] block">{getPlayerName(p.batter2Id)} <span className="text-secondary">({p.batter2Runs})</span></span>
                    </Link>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-slate-900 leading-none">{p.runs}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{p.balls} Balls</p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-primary" style={{ width: `${(p.batter1Runs/(p.runs||1))*100}%` }} title={getPlayerName(p.batter1Id)} />
                  <div className="h-full bg-secondary" style={{ width: `${(p.batter2Runs/(p.runs||1))*100}%` }} title={getPlayerName(p.batter2Id)} />
                </div>
              </div>
            )) : <p className="text-center py-4 text-[10px] font-black uppercase text-slate-300">No partnership data</p>}
          </div>
        </Card>
      </div>
    </div>
  );

  const OverLogList = ({ groups, inningId }: { groups: Record<number, any[]> | null, inningId: string }) => {
    if (!groups || Object.keys(groups).length === 0) return <div className="text-center py-20 font-black text-slate-300 uppercase text-xs">No over data found</div>;
    return (
      <div className="space-y-4">
        {Object.keys(groups).sort((a, b) => parseInt(b) - parseInt(a)).map(oNum => {
          const overBalls = groups[parseInt(oNum)];
          return (
            <Card key={`${inningId}-${oNum}`} className={cn("overflow-hidden border-l-4 mb-4", inningId === 'inning_1' ? "border-l-primary" : "border-l-secondary")}>
              <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b">
                <h4 className="text-[10px] font-black uppercase text-slate-500">Over {oNum}</h4>
                <Link href={`/players/${overBalls[0]?.bowlerId}`} className="hover:opacity-80 transition-opacity">
                  <span className={cn("text-[9px] font-black uppercase", inningId === 'inning_1' ? "text-primary" : "text-secondary")}>Bowler: {getPlayerName(overBalls[0]?.bowlerId)}</span>
                </Link>
              </div>
              <div className="p-4 space-y-3">
                {overBalls.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-[8px] font-black text-slate-400 w-6">{(d.overNumber - 1)}.{d.ballNumberInOver}</div>
                      <div className={cn("w-fit min-w-[32px] h-8 px-2 rounded-full flex items-center justify-center text-[10px] font-black border-2", d.isWicket ? "bg-red-600 text-white border-red-700" : d.extraType !== 'none' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-white text-slate-700 border-slate-200")}>
                        {d.isWicket ? "W" : d.extraType === 'wide' ? `WD+${d.runsScored}` : d.extraType === 'noball' ? `NB+${d.runsScored}` : d.runsScored}
                      </div>
                      <div>
                        <Link href={`/players/${d.strikerPlayerId}`} className="hover:opacity-80 transition-opacity">
                          <p className="text-[10px] font-black uppercase">{getPlayerName(d.strikerPlayerId)}</p>
                        </Link>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">
                          {d.extraType !== 'none' ? `${d.extraType.toUpperCase()} DELIVERY` : `${d.totalRunsOnDelivery} runs`}
                        </p>
                      </div>
                    </div>
                    {isUmpire && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-destructive" onClick={() => handleDeleteHistoricalBall(d, inningId)}>
                        <Trash2 className="w-3.5 h-3.5"/>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase tracking-widest">Syncing Match Engine...</div>;
  if (!match) return <div className="p-20 text-center">Match missing.</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="bg-white rounded-2xl shadow-xl border-t-8 border-t-primary overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3 flex-1 w-full">
              <div className="flex items-center justify-between">
                <div className="flex flex-col"><span className={cn("font-black text-xl md:text-2xl uppercase truncate max-w-[200px]", match.currentInningNumber === 1 && inn1?.battingTeamId === match.team1Id ? "text-slate-900" : "text-slate-400")}>{t1Header.name}</span><span className="text-[10px] font-black text-slate-400 uppercase">({t1Header.overs}/{match.totalOvers} OV)</span></div>
                <span className="font-black text-2xl md:text-3xl text-slate-900">{t1Header.score}/{t1Header.wkts}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col"><span className={cn("font-black text-xl md:text-2xl uppercase truncate max-w-[200px]", match.currentInningNumber === 2 && inn2?.battingTeamId === match.team2Id ? "text-slate-900" : "text-slate-400")}>{t2Header.name}</span><span className="text-[10px] font-black text-slate-400 uppercase">({t2Header.overs}/{match.totalOvers} OV)</span></div>
                <span className="font-black text-2xl md:text-3xl text-slate-900">{t2Header.score}/{t2Header.wkts}</span>
              </div>
            </div>
            <div className="w-px h-20 bg-slate-100 hidden md:block mx-4" />
            <div className="flex flex-row md:flex-col items-center md:items-end gap-3 w-full md:w-auto">
              <Button size="sm" variant="secondary" className="flex-1 md:flex-none h-12 px-6 font-black text-[10px] uppercase bg-secondary text-white shadow-md" onClick={() => {
                const report = generateHTMLReport(match, inn1, inn2, stats1, stats2, allTeams || [], allPlayers || []);
                const blob = new Blob([report], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `CricMates_${matchId}.html`; a.click();
              }}><Download className="w-4 h-4 mr-2" /> Match Report</Button>
            </div>
          </div>
          <div className="flex justify-between items-center border-t pt-4">
            <p className="text-[10px] md:text-xs font-black uppercase text-primary tracking-[0.2em]">{match.status === 'completed' ? match.resultDescription : "Match in Progress"}</p>
            {match.status === 'completed' && match.potmPlayerId && (
              <Badge className="bg-amber-500 text-white font-black uppercase text-[8px] flex items-center gap-1 shrink-0 whitespace-nowrap px-3 py-1.5 h-auto">
                <Star className="w-2.5 h-2.5" /> POTM: 
                <Link href={`/players/${match.potmPlayerId}`} className="hover:underline ml-1">
                  {getPlayerName(match.potmPlayerId)}
                </Link>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-8">
              {isUmpire && match.status !== 'completed' && activeInningData && (
                <Card className="shadow-lg border-none overflow-hidden bg-slate-900 text-white">
                  <CardHeader className="bg-white/5 py-4 border-b border-white/5 flex flex-row justify-between items-center">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Official Scorer</CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleUndo} className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/10">
                      <Undo2 className="w-3 h-3 mr-1" /> Undo Ball
                    </Button>
                  </CardHeader>
                  <CardContent className="p-6">
                    {isInningsOver ? (
                      <div className="py-8 text-center space-y-6">
                        <div className="p-4 bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
                          <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                          <h3 className="text-xl font-black uppercase tracking-tighter">Innings Complete</h3>
                        </div>
                        {match.currentInningNumber === 1 ? (
                          <Button onClick={handleStartSecondInnings} className="w-full h-16 bg-primary text-white font-black uppercase text-lg tracking-widest shadow-2xl group">START 2ND INNINGS <ChevronRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" /></Button>
                        ) : (
                          <Button onClick={handleFinishMatch} variant="secondary" disabled={isFinalizing} className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-lg tracking-widest shadow-2xl">
                            {isFinalizing ? <Loader2 className="animate-spin w-6 h-6" /> : <>FINISH MATCH <CheckCircle2 className="ml-2 w-6 h-6" /></>}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-2 md:gap-3 mb-6">
                          {[0, 1, 2, 3, 4, 6].map(r => (<Button key={r} onClick={() => handleRecordBall(r)} className={cn("h-14 md:h-16 text-xl md:text-2xl font-black bg-white/5 border-2 border-white/10", r >= 4 ? "text-primary" : "text-white")}>{r === 0 ? "•" : r}</Button>))}
                          <Button onClick={() => handleRecordBall(1, 'none', true)} className="h-14 md:h-16 flex flex-col items-center justify-center bg-secondary/20 border-2 border-secondary/40 text-secondary"><span className="text-lg font-black">1D</span><span className="text-[6px] font-bold uppercase">No Strike</span></Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-10 font-black text-[9px] border-amber-500/40 text-amber-500 uppercase">Wide</Button>
                          <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-10 font-black text-[9px] border-amber-500/40 text-amber-500 uppercase">No Ball</Button>
                          <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-10 font-black text-[9px] border-red-500/40 text-red-500 uppercase">Wicket</Button>
                          <Button variant="outline" onClick={() => setIsPlayerAssignmentOpen(true)} className="h-10 font-black text-[9px] border-white/20 text-white uppercase">Positions</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
              <div className="space-y-8">
                {match.currentInningNumber === 2 && <InningsLiveStats title="Second Innings" inningData={inn2} stats={stats2} score={inn2Score} wkts={inn2Wickets} overs={inn2OversDisplay} />}
                <InningsLiveStats title={match.currentInningNumber === 2 ? "First Innings" : "Current Innings"} inningData={inn1} stats={stats1} score={inn1Score} wkts={inn1Wickets} overs={inn1OversDisplay} />
              </div>
            </div>
            <div className="space-y-4">
              <HistoryCard title="Recent History" groups={match.currentInningNumber === 2 ? overGroups2 : overGroups1} isLoading={match.currentInningNumber === 2 ? isInn2Loading : isInn1Loading} icon={Zap} />
              {match.currentInningNumber === 2 && <HistoryCard title="Previous History" groups={overGroups1} isLoading={isInn1Loading} icon={History} />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scorecard" className="pt-4 space-y-6">
          <div className="flex gap-2 scrollbar-hide overflow-x-auto pb-2">
            {['inn1', 'inn2', 'flow'].map(s => (
              <Button key={s} size="sm" variant={activeScorecardSubTab === s ? 'default' : 'outline'} onClick={() => setActiveScorecardSubTab(s as any)} className="font-black text-[10px] uppercase shrink-0">
                {s === 'flow' ? 'Match Flow' : s === 'inn1' ? getTeamName(inn1?.battingTeamId) : getTeamName(inn2?.battingTeamId)}
              </Button>
            ))}
          </div>
          {activeScorecardSubTab === 'flow' ? (
            <div className="space-y-8 pl-4 py-4 relative"><div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200" />
              {flowEvents.map((e, idx) => (
                <div key={idx} className="relative pl-8 group"><div className={cn("absolute left-[-11px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10", e.type === 'header' ? "bg-slate-900 w-4 h-4 left-[-13px]" : "bg-slate-300")} />
                  <div className="space-y-1"><p className={cn("font-black uppercase text-xs", e.type === 'header' ? "text-lg text-slate-900" : "text-slate-700")}>{e.title}</p>{e.detail && <p className="text-[10px] font-bold text-slate-400 uppercase">{e.detail}</p>}</div>
                </div>
              ))}
            </div>
          ) : activeScorecardSubTab === 'inn1' ? (
            <FullScorecardView stats={stats1} teamName={getTeamName(inn1?.battingTeamId)} oppTeamName={getTeamName(inn1?.bowlingTeamId)} />
          ) : (
            <FullScorecardView stats={stats2} teamName={getTeamName(inn2?.battingTeamId)} oppTeamName={getTeamName(inn2?.bowlingTeamId)} />
          )}
        </TabsContent>

        <TabsContent value="analytics" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-md border-none p-6 bg-white overflow-hidden">
              <div className="mb-6"><h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><LineChartIcon className="w-4 h-4 text-primary"/> Inning Progression (Worm)</h3></div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={wormData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="ball" fontSize={8} stroke="#94a3b8" />
                    <YAxis fontSize={8} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="team1" stroke="#1e40af" fill="#1e40af" fillOpacity={0.1} strokeWidth={2} name={getTeamName(inn1?.battingTeamId)} dot={<CustomWicketDot team="team1" />} />
                    <Area type="monotone" dataKey="team2" stroke="#0d9488" fill="#0d9488" fillOpacity={0.1} strokeWidth={2} name={getTeamName(inn2?.battingTeamId)} dot={<CustomWicketDot team="team2" />} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="shadow-md border-none p-6 bg-white overflow-hidden">
              <div className="mb-6"><h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><BarChart className="w-4 h-4 text-secondary"/> Runs Per Over (Manhattan)</h3></div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={manhattanData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="over" fontSize={8} stroke="#94a3b8" />
                    <YAxis fontSize={8} stroke="#94a3b8" />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="team1" fill="#1e40af" radius={[2, 2, 0, 0]} name={getTeamName(inn1?.battingTeamId)} />
                    <Bar dataKey="team2" fill="#0d9488" radius={[2, 2, 0, 0]} name={getTeamName(inn2?.battingTeamId)} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overs" className="pt-4 space-y-4">
          <Tabs defaultValue="inn1" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="inn1" className="font-black uppercase text-[10px]">1st Innings</TabsTrigger>
              <TabsTrigger value="inn2" className="font-black uppercase text-[10px]" disabled={!inn2}>2nd Innings</TabsTrigger>
            </TabsList>
            <TabsContent value="inn1">
              <OverLogList groups={overGroups1} inningId="inning_1" />
            </TabsContent>
            <TabsContent value="inn2">
              <OverLogList groups={overGroups2} inningId="inning_2" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="info" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-t-4 border-t-primary">
              <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary"><Info className="w-4 h-4" /> Match Particulars</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Event Date</p>
                    <div className="flex items-center gap-2"><CalendarIcon className="w-3.5 h-3.5 text-slate-400"/><p className="text-xs font-bold">{match.matchDate ? new Date(match.matchDate).toLocaleDateString() : '---'}</p></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Start Time</p>
                    <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-400"/><p className="text-xs font-bold">{match.matchDate ? new Date(match.matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}</p></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Tournament Format</p>
                  <p className="text-sm font-black text-slate-900">{match.totalOvers} Overs Professional Match</p>
                </div>
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Officials</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">Umpire</Badge>
                    <Link href={`/players/${match.umpireId}`} className="text-xs font-bold hover:text-primary hover:underline">
                      {getPlayerName(match.umpireId)}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-t-4 border-t-secondary">
              <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-secondary"><Users className="w-4 h-4" /> Team Squads</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-900 uppercase border-b pb-1">{getTeamName(match.team1Id)}</p>
                  <div className="flex flex-wrap gap-2">
                    {match.team1SquadPlayerIds?.map((pid: string) => (
                      <Link key={pid} href={`/players/${pid}`}>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-900 hover:bg-primary hover:text-white transition-colors text-[9px] font-black uppercase px-2 py-1 cursor-pointer border shadow-sm border-slate-200">
                          {getPlayerName(pid)}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-900 uppercase border-b pb-1">{getTeamName(match.team2Id)}</p>
                  <div className="flex flex-wrap gap-2">
                    {match.team2SquadPlayerIds?.map((pid: string) => (
                      <Link key={pid} href={`/players/${pid}`}>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-900 hover:bg-primary hover:text-white transition-colors text-[9px] font-black uppercase px-2 py-1 cursor-pointer border shadow-sm border-slate-200">
                          {getPlayerName(pid)}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}><DialogContent className="max-w-[90vw] md:max-w-md rounded-xl border-t-8 border-t-destructive"><DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-destructive">Register Wicket</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Type</Label><Select value={wicketForm.type} onValueChange={v => setWicketForm({...wicketForm, type: v})}><SelectTrigger className="font-bold"><SelectValue /></SelectTrigger><SelectContent>{['bowled', 'caught', 'lbw', 'runout', 'stumped', 'retired'].map(t => <SelectItem key={t} value={t} className="uppercase font-bold text-[10px]">{t}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label><Select value={wicketForm.batterOutId} onValueChange={v => setWicketForm({...wicketForm, batterOutId: v})}><SelectTrigger className="font-bold"><SelectValue placeholder="Select Batter" /></SelectTrigger><SelectContent>{activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)}</SelectItem>}{activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>}</SelectContent></Select></div>{['caught', 'runout', 'stumped'].includes(wicketForm.type) && (<div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Fielder</Label><Select value={wicketForm.fielderId} onValueChange={v => setWicketForm({...wicketForm, fielderId: v})}><SelectTrigger className="font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">---</SelectItem>{allPlayers?.filter(p => p.teamId !== activeInningData?.battingTeamId).map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>)}<div className="space-y-1 p-3 bg-slate-50 rounded-lg border"><Label className="text-[10px] font-black uppercase text-primary mb-2 block">Action</Label><Select value={wicketForm.decision} onValueChange={v => setWicketForm({...wicketForm, decision: v})}><SelectTrigger className="font-bold h-12 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="next" className="font-bold">Next Batter</SelectItem><SelectItem value="last_man" className="font-bold">Last Man</SelectItem><SelectItem value="finish" className="font-bold text-destructive">Finish Innings</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="destructive" onClick={handleWicket} className="w-full h-12 font-black uppercase shadow-lg">Confirm</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}><DialogContent className="max-w-[90vw] md:max-w-md rounded-xl border-t-8 border-t-primary"><DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-center">Assign Positions</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Striker</Label><Select value={activeInningData?.strikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => currentBattingSquadIds === p.teamId && p.id !== activeInningData?.currentBowlerPlayerId && !(match.currentInningNumber === 1 ? stats1 : stats2).batting.find(b => b.id === p.id && b.out)).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>{!activeInningData?.isLastManActive && (<div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Non-Striker</Label><Select value={activeInningData?.nonStrikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { nonStrikerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Non-Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => currentBattingSquadIds === p.teamId && p.id !== activeInningData?.currentBowlerPlayerId && !(match.currentInningNumber === 1 ? stats1 : stats2).batting.find(b => b.id === p.id && b.out)).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>)}</div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Current Bowler</Label><Select value={activeInningData?.currentBowlerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { currentBowlerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Bowler" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => currentBattingSquadIds !== p.teamId && p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.nonStrikerPlayerId).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div></div><DialogFooter><Button onClick={() => setIsPlayerAssignmentOpen(false)} className="w-full h-14 font-black uppercase shadow-xl">Confirm</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
