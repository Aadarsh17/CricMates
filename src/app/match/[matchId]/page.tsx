
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { History, CheckCircle2, Trophy, Star, ShieldAlert, UserPlus, Info, ChevronRight, AlertCircle, Edit2, Save, Settings2, ShieldCheck, PenTool, BarChart3, LineChart as LineChartIcon, Flag, User, Target, Zap } from 'lucide-react';
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
  Cell,
  ReferenceDot
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
    resultDescription: ''
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
        matchDate: match.matchDate.split('T')[0],
        tossWinner: match.tossWinnerTeamId,
        tossDecision: match.tossDecision,
        inn1Score: inn1.score || 0,
        inn1Wickets: inn1.wickets || 0,
        inn1Overs: inn1.oversCompleted || 0,
        inn1Balls: inn1.ballsInCurrentOver || 0,
        inn2Score: inn2?.score || 0,
        inn2Wickets: inn2?.wickets || 0,
        inn2Overs: inn2?.oversCompleted || 0,
        inn2Balls: inn2?.ballsInCurrentOver || 0,
        resultDescription: match.resultDescription || ''
      });
    }
  }, [match, inn1, inn2]);

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

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const getPlayer = (pid: string) => allPlayers?.find(p => p.id === pid);
  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none') return '---';
    const p = getPlayer(pid);
    return p ? p.name : 'Unknown Player';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    const t = allTeams?.find(t => t.id === tid);
    return t ? t.name : 'Unknown Team';
  };

  const getAbbr = (name: string) => (name || 'UNK').substring(0, 3).toUpperCase();

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire) return;

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

  const handleWicket = async () => {
    if (!match || !activeInningData || !isUmpire) return;

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
      strikerPlayerId: 'none' 
    });

    setIsWicketDialogOpen(false);
    toast({ title: "OUT!", variant: "destructive" });
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

    await batch.commit();
    setIsEditFullMatchOpen(false);
    toast({ title: "Match Updated", description: "Corrections have been saved." });
  };

  const handleEndMatch = async () => {
    if (!match || !inn1 || !allTeams) return;
    
    const team1Id = match.team1Id;
    const team2Id = match.team2Id;
    
    const i1Score = inn1.score;
    const i1Balls = (inn1.oversCompleted * 6) + (inn1.ballsInCurrentOver || 0);
    
    const i2Score = inn2?.score || 0;
    const i2Balls = inn2 ? (inn2.oversCompleted * 6) + (inn2.ballsInCurrentOver || 0) : 0;

    let result = '';
    let winnerId = '';
    let loserId = '';

    if (i1Score > i2Score) {
      result = `${getTeamName(team1Id)} won by ${i1Score - i2Score} runs`;
      winnerId = team1Id;
      loserId = team2Id;
    } else if (i2Score > i1Score) {
      result = `${getTeamName(team2Id)} won by ${10 - (inn2?.wickets || 0)} wickets`;
      winnerId = team2Id;
      loserId = team1Id;
    } else {
      result = "Match Drawn";
    }

    const allDeliveries = [...(inn1Deliveries || []), ...(inn2Deliveries || [])];
    const perfMap: Record<string, PlayerMatchStats> = {};

    [...match.team1SquadPlayerIds, ...match.team2SquadPlayerIds].forEach(pid => {
      perfMap[pid] = {
        id: pid, name: getPlayerName(pid),
        runs: 0, ballsFaced: 0, fours: 0, sixes: 0,
        wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0,
        catches: 0, stumpings: 0, runOuts: 0
      };
    });

    allDeliveries.forEach(d => {
      if (d.strikerPlayerId && perfMap[d.strikerPlayerId]) {
        perfMap[d.strikerPlayerId].runs += d.runsScored;
        if (d.extraType === 'none') perfMap[d.strikerPlayerId].ballsFaced += 1;
        if (d.runsScored === 4) perfMap[d.strikerPlayerId].fours += 1;
        if (d.runsScored === 6) perfMap[d.strikerPlayerId].sixes += 1;
      }
      if (d.bowlerPlayerId && perfMap[d.bowlerPlayerId]) {
        if (d.extraType === 'none') perfMap[d.bowlerPlayerId].ballsBowled += 1;
        if (d.extraType === 'wide') perfMap[d.bowlerPlayerId].runsConceded += d.extraRuns;
        else if (d.extraType === 'noball') perfMap[d.bowlerPlayerId].runsConceded += (d.runsScored + 1);
        else perfMap[d.bowlerPlayerId].runsConceded += d.runsScored;
        
        if (d.isWicket && !['runout'].includes(d.dismissalType)) perfMap[d.bowlerPlayerId].wickets += 1;
      }
      if (d.isWicket && d.fielderPlayerId && perfMap[d.fielderPlayerId]) {
        if (d.dismissalType === 'catch') perfMap[d.fielderPlayerId].catches += 1;
        if (d.dismissalType === 'stumping') perfMap[d.fielderPlayerId].stumpings += 1;
        if (d.dismissalType === 'runout') perfMap[d.fielderPlayerId].runOuts += 1;
      }
    });

    let maxCVP = -Infinity;
    let potmId = '';
    const playerMatchPoints: Record<string, number> = {};

    Object.entries(perfMap).forEach(([pid, stats]) => {
      const pts = calculatePlayerCVP(stats);
      playerMatchPoints[pid] = pts;
      if (pts > maxCVP) {
        maxCVP = pts;
        potmId = pid;
      }
    });

    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), { 
      status: 'completed', 
      resultDescription: result,
      potmPlayerId: potmId,
      potmCvpScore: maxCVP
    });

    Object.entries(playerMatchPoints).forEach(([pid, pts]) => {
      const p = getPlayer(pid);
      if (p) {
        batch.update(doc(db, 'players', pid), {
          careerCVP: (p.careerCVP || 0) + pts,
          matchesPlayed: (p.matchesPlayed || 0) + 1
        });
      }
    });

    const t1 = allTeams?.find(t => t.id === team1Id);
    const t2 = allTeams?.find(t => t.id === team2Id);

    if (t1 && t2) {
      const newT1RunsScored = (t1.totalRunsScored || 0) + i1Score;
      const newT1RunsConceded = (t1.totalRunsConceded || 0) + i2Score;
      const newT1BallsFaced = (t1.totalBallsFaced || 0) + i1Balls;
      const newT1BallsBowled = (t1.totalBallsBowled || 0) + i2Balls;

      const newT2RunsScored = (t2.totalRunsScored || 0) + i2Score;
      const newT2RunsConceded = (t2.totalRunsConceded || 0) + i1Score;
      const newT2BallsFaced = (t2.totalBallsFaced || 0) + i2Balls;
      const newT2BallsBowled = (t2.totalBallsBowled || 0) + i1Balls;

      const t1NRR = (newT1RunsScored * 6 / (newT1BallsFaced || 1)) - (newT1RunsConceded * 6 / (newT1BallsBowled || 1));
      const t2NRR = (newT2RunsScored * 6 / (newT2BallsFaced || 1)) - (newT2RunsConceded * 6 / (newT2BallsBowled || 1));

      batch.update(doc(db, 'teams', team1Id), {
        matchesWon: (t1.matchesWon || 0) + (winnerId === team1Id ? 1 : 0),
        matchesLost: (t1.matchesLost || 0) + (loserId === team1Id ? 1 : 0),
        matchesDrawn: (t1.matchesDrawn || 0) + (winnerId === '' ? 1 : 0),
        totalRunsScored: newT1RunsScored,
        totalRunsConceded: newT1RunsConceded,
        totalBallsFaced: newT1BallsFaced,
        totalBallsBowled: newT1BallsBowled,
        netRunRate: t1NRR
      });

      batch.update(doc(db, 'teams', team2Id), {
        matchesWon: (t2.matchesWon || 0) + (winnerId === team2Id ? 1 : 0),
        matchesLost: (t2.matchesLost || 0) + (loserId === team2Id ? 1 : 0),
        matchesDrawn: (t2.matchesDrawn || 0) + (winnerId === '' ? 1 : 0),
        totalRunsScored: newT2RunsScored,
        totalRunsConceded: newT2RunsConceded,
        totalBallsFaced: newT2BallsFaced,
        totalBallsBowled: newT2BallsBowled,
        netRunRate: t2NRR
      });
    }

    await batch.commit();
    toast({ title: "Match Concluded", description: result });
  };

  const inningPerformances = useMemo(() => {
    const deliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;
    if (!deliveries || !match) return { batting: [], bowling: [] };

    const battingMap: Record<string, any> = {};
    const bowlingMap: Record<string, any> = {};

    const squadIds = activeInningView === 1 
      ? (inn1?.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds)
      : (inn2?.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds);
    
    const opponentSquadIds = activeInningView === 1
      ? (inn1?.bowlingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds)
      : (inn2?.bowlingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds);

    squadIds.forEach(id => {
      battingMap[id] = { id, name: getPlayerName(id), runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '' };
    });

    opponentSquadIds.forEach(id => {
      bowlingMap[id] = { id, name: getPlayerName(id), overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 };
    });

    deliveries.forEach(d => {
      if (d.strikerPlayerId && battingMap[d.strikerPlayerId]) {
        battingMap[d.strikerPlayerId].runs += d.runsScored;
        if (d.extraType === 'none') battingMap[d.strikerPlayerId].balls += 1;
        if (d.runsScored === 4) battingMap[d.strikerPlayerId].fours += 1;
        if (d.runsScored === 6) battingMap[d.strikerPlayerId].sixes += 1;
      }
      if (d.isWicket && d.batsmanOutPlayerId && battingMap[d.batsmanOutPlayerId]) {
        battingMap[d.batsmanOutPlayerId].out = true;
        battingMap[d.batsmanOutPlayerId].dismissal = d.outcomeDescription || 'out';
      }
      if (d.bowlerPlayerId && bowlingMap[d.bowlerPlayerId]) {
        if (d.extraType === 'none') bowlingMap[d.bowlerPlayerId].balls += 1;
        if (d.extraType === 'wide') bowlingMap[d.bowlerPlayerId].runs += d.extraRuns;
        else if (d.extraType === 'noball') bowlingMap[d.bowlerPlayerId].runs += (d.runsScored + 1);
        else bowlingMap[d.bowlerPlayerId].runs += d.runsScored;
        if (d.isWicket && d.dismissalType !== 'runout') bowlingMap[d.bowlerPlayerId].wickets += 1;
      }
    });

    return {
      batting: Object.values(battingMap).filter((p: any) => p.runs > 0 || p.balls > 0 || p.out),
      bowling: Object.values(bowlingMap).filter((p: any) => p.balls > 0 || p.runs > 0)
    };
  }, [activeInningView, inn1Deliveries, inn2Deliveries, match, inn1, inn2]);

  const groupedOvers = useMemo(() => {
    const deliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;
    if (!deliveries) return [];
    
    const oversMap: Record<number, { 
      overNumber: number; 
      balls: any[]; 
      overRuns: number; 
      cumulativeScore: number; 
      cumulativeWickets: number;
      bowlerId: string;
      batterIds: string[];
    }> = {};

    let runningScore = 0;
    let runningWickets = 0;

    const sortedDeliveries = [...deliveries].sort((a, b) => a.timestamp - b.timestamp);

    sortedDeliveries.forEach(d => {
      runningScore += d.totalRunsOnDelivery;
      if (d.isWicket) runningWickets++;

      if (!oversMap[d.overNumber]) {
        oversMap[d.overNumber] = {
          overNumber: d.overNumber,
          balls: [],
          overRuns: 0,
          cumulativeScore: 0,
          cumulativeWickets: 0,
          bowlerId: d.bowlerPlayerId,
          batterIds: []
        };
      }
      
      oversMap[d.overNumber].balls.push(d);
      oversMap[d.overNumber].overRuns += d.totalRunsOnDelivery;
      oversMap[d.overNumber].cumulativeScore = runningScore;
      oversMap[d.overNumber].cumulativeWickets = runningWickets;
      if (!oversMap[d.overNumber].batterIds.includes(d.strikerPlayerId)) {
        oversMap[d.overNumber].batterIds.push(d.strikerPlayerId);
      }
    });
    
    return Object.values(oversMap).sort((a, b) => b.overNumber - a.overNumber);
  }, [activeInningView, inn1Deliveries, inn2Deliveries]);

  const chartData = useMemo(() => {
    if (!inn1Deliveries || !match) return { worm: [], manhattan: [] };
    const totalOvers = match.totalOvers;
    const worm: any[] = [{ over: 0, inn1: 0, inn2: 0 }];
    const manhattan: any[] = [];
    for (let i = 1; i <= totalOvers; i++) {
      worm.push({ over: i, inn1: null, inn2: null });
      manhattan.push({ over: i, inn1Runs: 0, inn1Wickets: 0, inn2Runs: 0, inn2Wickets: 0 });
    }
    let cumulative1 = 0;
    const inn1OversMap: Record<number, { runs: number, wickets: number }> = {};
    inn1Deliveries.forEach(d => {
      if (!inn1OversMap[d.overNumber]) inn1OversMap[d.overNumber] = { runs: 0, wickets: 0 };
      inn1OversMap[d.overNumber].runs += d.totalRunsOnDelivery;
      if (d.isWicket) inn1OversMap[d.overNumber].wickets += 1;
    });
    Object.entries(inn1OversMap).forEach(([oStr, stats]) => {
      const o = parseInt(oStr);
      cumulative1 += stats.runs;
      if (worm[o]) worm[o].inn1 = cumulative1;
      if (manhattan[o-1]) { manhattan[o-1].inn1Runs = stats.runs; manhattan[o-1].inn1Wickets = stats.wickets; }
    });
    if (inn2Deliveries) {
      let cumulative2 = 0;
      const inn2OversMap: Record<number, { runs: number, wickets: number }> = {};
      inn2Deliveries.forEach(d => {
        if (!inn2OversMap[d.overNumber]) inn2OversMap[d.overNumber] = { runs: 0, wickets: 0 };
        inn2OversMap[d.overNumber].runs += d.totalRunsOnDelivery;
        if (d.isWicket) inn2OversMap[d.overNumber].wickets += 1;
      });
      Object.entries(inn2OversMap).forEach(([oStr, stats]) => {
        const o = parseInt(oStr);
        cumulative2 += stats.runs;
        if (worm[o]) worm[o].inn2 = cumulative2;
        if (manhattan[o-1]) { manhattan[o-1].inn2Runs = stats.runs; manhattan[o-1].inn2Wickets = stats.wickets; }
      });
    }
    return { worm, manhattan };
  }, [inn1Deliveries, inn2Deliveries, match]);

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center font-black animate-pulse">LOADING SCOREBOARD...</div>;
  if (!match) return <div className="p-20 text-center">Match data missing.</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="border-b bg-white p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              {getTeamName(match.team1Id)} <span className="text-slate-300 mx-1">VS</span> {getTeamName(match.team2Id)}
            </h1>
            <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-1">
              {match.status === 'completed' ? match.resultDescription : 'Match In Progress'}
            </p>
          </div>
          {isUmpire && (
            <Button size="sm" variant="outline" onClick={() => setIsEditFullMatchOpen(true)} className="rounded-full bg-slate-50 border-slate-200 text-[10px] font-black uppercase tracking-widest h-8 px-3">
              <ShieldCheck className="w-3 h-3 mr-1 text-secondary" /> Umpire Tools
            </Button>
          )}
        </div>
      </div>

      <div className="sticky top-16 z-50 bg-white border-b shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-start overflow-x-auto rounded-none bg-transparent h-auto p-0 scrollbar-hide">
            {['Info', 'Live', 'Scorecard', 'Overs', 'Charts'].map((tab) => (
              <TabsTrigger 
                key={tab}
                value={tab.toLowerCase()} 
                className="flex-1 px-4 py-4 text-xs font-black rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary whitespace-nowrap uppercase tracking-widest"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsContent value="info" className="mt-4 space-y-4">
          <Card className="border shadow-none rounded-sm overflow-hidden">
            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
              <CardTitle className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2">MATCH DETAILS</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-xs">
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Venue</span><span className="font-black text-slate-900">League Grounds</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Date</span><span className="font-medium text-slate-900">{new Date(match.matchDate).toLocaleDateString()}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Toss</span><span className="font-medium text-slate-900">{match.tossWinnerTeamId ? `${getTeamName(match.tossWinnerTeamId)} won & opt to ${match.tossDecision}` : '---'}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="mt-4 space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inn1 && <div className={cn("p-4 rounded-xl border flex justify-between items-center transition-all", match.currentInningNumber === 1 ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" : "bg-slate-50 opacity-60")}><div className="space-y-1"><p className="text-[10px] font-black uppercase text-slate-400">1st Innings</p><h4 className="font-black text-xl">{getAbbr(getTeamName(match.team1Id))} {inn1.score}/{inn1.wickets}</h4></div><div className="text-right"><p className="text-[10px] font-black uppercase text-slate-400">Overs</p><h4 className="font-bold">{inn1.oversCompleted}.{inn1.ballsInCurrentOver}</h4></div></div>}
              {inn2 && <div className={cn("p-4 rounded-xl border flex justify-between items-center transition-all", match.currentInningNumber === 2 ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" : "bg-slate-50 opacity-60")}><div className="space-y-1"><p className="text-[10px] font-black uppercase text-slate-400">2nd Innings</p><h4 className="font-black text-xl">{getAbbr(getTeamName(match.team2Id))} {inn2.score}/{inn2.wickets}</h4></div><div className="text-right"><p className="text-[10px] font-black uppercase text-slate-400">Overs</p><h4 className="font-bold">{inn2.oversCompleted}.{inn2.ballsInCurrentOver}</h4></div></div>}
            </div>

            {isUmpire && match.status === 'live' && activeInningData && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center font-black text-xs ring-4 ring-primary/20">BAT</div>
                    <div>
                      <p className="text-[9px] font-black text-primary uppercase">On Strike</p>
                      <p className="text-sm font-black truncate max-w-[150px]">{getPlayerName(activeInningData.strikerPlayerId)}*</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Target</p>
                    <p className="text-sm font-black text-secondary">{match.currentInningNumber === 2 && inn1 ? inn1.score + 1 : '---'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2, 3, 4, 6].map(runs => (
                    <Button key={runs} onClick={() => handleRecordBall(runs)} className="h-16 font-black text-2xl bg-white text-slate-900 border-2 border-slate-200 hover:bg-slate-50 hover:border-primary/50 shadow-sm transition-all active:scale-95">
                      {runs === 0 ? "•" : runs}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-14 font-black border-amber-200 text-amber-700 bg-amber-50 uppercase tracking-widest text-xs">WIDE</Button>
                  <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-14 font-black border-amber-200 text-amber-700 bg-amber-50 uppercase tracking-widest text-xs">NO BALL</Button>
                  <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-14 font-black border-red-200 text-red-700 bg-red-50 uppercase tracking-widest text-xs">OUT / WICKET</Button>
                  <Button variant="outline" onClick={() => setIsBowlerDialogOpen(true)} className="h-14 font-black border-slate-200 text-slate-600 uppercase tracking-widest text-xs">NEW BOWLER</Button>
                </div>
                <Button onClick={handleEndMatch} variant="destructive" className="w-full font-black uppercase text-sm h-14 tracking-widest mt-4 shadow-xl">
                  <CheckCircle2 className="w-5 h-5 mr-2" /> FINISH & SAVE MATCH
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="scorecard" className="mt-4 space-y-6">
          <div className="flex gap-2 overflow-x-auto p-4 border-b bg-slate-50/50 rounded-t-lg">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-black h-8 px-4">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-black h-8 px-4" disabled={!inn2}>Innings 2</Button>
          </div>

          <div className="space-y-6">
            <Card className="border shadow-none rounded-none border-x-0">
              <CardHeader className="py-3 px-4 bg-slate-50 border-y"><CardTitle className="text-[10px] font-black uppercase text-slate-400">BATTING</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[10px] font-black uppercase">R</TableHead><TableHead className="text-right text-[10px] font-black uppercase">B</TableHead><TableHead className="text-right text-[10px] font-black uppercase">4s</TableHead><TableHead className="text-right text-[10px] font-black uppercase">6s</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {inningPerformances.batting.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="py-3">
                          <p className="font-bold text-xs">{p.name}{p.out ? '' : '*'}</p>
                          <p className="text-[8px] text-slate-400 uppercase italic truncate max-w-[120px]">{p.dismissal}</p>
                        </TableCell>
                        <TableCell className="text-right font-black text-xs">{p.runs}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">{p.balls}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">{p.fours}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">{p.sixes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border shadow-none rounded-none border-x-0">
              <CardHeader className="py-3 px-4 bg-slate-50 border-y"><CardTitle className="text-[10px] font-black uppercase text-slate-400">BOWLING</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[10px] font-black uppercase">Bowler</TableHead><TableHead className="text-right text-[10px] font-black uppercase">O</TableHead><TableHead className="text-right text-[10px] font-black uppercase">R</TableHead><TableHead className="text-right text-[10px] font-black uppercase">W</TableHead><TableHead className="text-right text-[10px] font-black uppercase">E</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {inningPerformances.bowling.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="py-3 font-bold text-xs">{p.name}</TableCell>
                        <TableCell className="text-right text-xs font-bold">{Math.floor(p.balls / 6)}.{p.balls % 6}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">{p.runs}</TableCell>
                        <TableCell className="text-right text-xs font-black text-primary">{p.wickets}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">{(p.runs / (p.balls / 6 || 1)).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {isUmpire && (
              <div className="p-4 bg-slate-50 border-y border-dashed space-y-3">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Administrative Tools</p>
                 <Button variant="outline" onClick={() => setIsEditFullMatchOpen(true)} className="w-full h-12 font-black text-[10px] uppercase tracking-widest bg-white">
                   <PenTool className="w-3 h-3 mr-2" /> Correct Full Scorecard & Meta
                 </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overs" className="mt-4 space-y-0 divide-y bg-white rounded-lg border shadow-sm">
          <div className="flex gap-2 overflow-x-auto p-4 border-b bg-slate-50/50">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-black h-8 px-4">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-black h-8 px-4" disabled={!inn2}>Innings 2</Button>
          </div>
          {groupedOvers.map((over) => (
            <div key={over.overNumber} className="p-4 flex flex-col md:flex-row gap-4 md:items-start md:justify-between hover:bg-slate-50 transition-colors">
              <div className="space-y-1 min-w-[140px]">
                <p className="font-black text-sm text-slate-900">Over {over.overNumber} <span className="text-slate-400 font-bold ml-1">- {over.overRuns} runs</span></p>
                <p className="text-xs font-black text-slate-500 uppercase tracking-tighter">
                  {getAbbr(getTeamName(activeInningView === 1 ? match.team1Id : match.team2Id))} {over.cumulativeScore}-{over.cumulativeWickets}
                </p>
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-xs font-bold text-slate-700">
                  {getPlayerName(over.bowlerId)} to {over.batterIds.map((id, idx) => (<span key={id}>{idx > 0 && ' & '}{getPlayerName(id)}</span>))}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {over.balls.map((ball, idx) => {
                    let bgColor = 'bg-slate-400';
                    let text = ball.totalRunsOnDelivery;
                    if (ball.isWicket) { bgColor = 'bg-red-600'; text = 'W'; }
                    else if (ball.runsScored === 6) bgColor = 'bg-purple-600';
                    else if (ball.runsScored === 4) bgColor = 'bg-blue-600';
                    else if (ball.extraType === 'wide') { bgColor = 'bg-amber-700'; text = 'Wd'; }
                    else if (ball.extraType === 'noball') { bgColor = 'bg-amber-700'; text = 'Nb'; }
                    return (<div key={idx} className={cn("w-8 h-8 flex items-center justify-center rounded-sm text-[10px] font-black text-white shadow-sm", bgColor)}>{text}</div>);
                  })}
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="charts" className="mt-4 space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><LineChartIcon className="w-4 h-4 text-primary" /> Progress</CardTitle></CardHeader>
            <CardContent><div className="h-[300px] w-full mt-4"><ChartContainer config={{ inn1: { label: getAbbr(getTeamName(match.team1Id)), color: "hsl(var(--primary))" }, inn2: { label: getAbbr(getTeamName(match.team2Id)), color: "hsl(var(--accent))" } }}><LineChart data={chartData.worm} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="over" fontSize={10} tickLine={false} axisLine={false} /><YAxis fontSize={10} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} /><Line type="monotone" dataKey="inn1" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} connectNulls /><Line type="monotone" dataKey="inn2" stroke="hsl(var(--accent))" strokeWidth={3} dot={false} connectNulls /></LineChart></ChartContainer></div></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* FULL MATCH EDITOR DIALOG */}
      <Dialog open={isEditFullMatchOpen} onOpenChange={setIsEditFullMatchOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Full Scorecard Correction</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Match Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({...editForm, status: v})}>
                    <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live">Live (Ongoing)</SelectItem>
                      <SelectItem value="completed">Completed (Finalized)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Match Date</Label>
                  <Input type="date" className="font-bold" value={editForm.matchDate} onChange={(e) => setEditForm({...editForm, matchDate: e.target.value})} />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Toss Winner</Label>
                  <Select value={editForm.tossWinner} onValueChange={(v) => setEditForm({...editForm, tossWinner: v})}>
                    <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={match.team1Id}>{getTeamName(match.team1Id)}</SelectItem>
                      <SelectItem value={match.team2Id}>{getTeamName(match.team2Id)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Toss Decision</Label>
                  <Select value={editForm.tossDecision} onValueChange={(v) => setEditForm({...editForm, tossDecision: v})}>
                    <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bat">Elect to Bat</SelectItem>
                      <SelectItem value="bowl">Elect to Bowl</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
             </div>

             <div className="space-y-4 p-4 border rounded-xl bg-primary/5">
                <p className="font-black text-xs uppercase tracking-widest text-primary">Innings 1: {getAbbr(getTeamName(match.team1Id))}</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Runs</Label><Input type="number" className="font-black" value={editForm.inn1Score} onChange={(e) => setEditForm({...editForm, inn1Score: parseInt(e.target.value)||0})} /></div>
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Wkts</Label><Input type="number" className="font-black" value={editForm.inn1Wickets} onChange={(e) => setEditForm({...editForm, inn1Wickets: parseInt(e.target.value)||0})} /></div>
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Overs</Label><Input type="number" className="font-black" value={editForm.inn1Overs} onChange={(e) => setEditForm({...editForm, inn1Overs: parseInt(e.target.value)||0})} /></div>
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Balls</Label><Input type="number" max="5" className="font-black" value={editForm.inn1Balls} onChange={(e) => setEditForm({...editForm, inn1Balls: parseInt(e.target.value)||0})} /></div>
                </div>
             </div>

             <div className="space-y-4 p-4 border rounded-xl bg-secondary/5">
                <p className="font-black text-xs uppercase tracking-widest text-secondary">Innings 2: {getAbbr(getTeamName(match.team2Id))}</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Runs</Label><Input type="number" className="font-black" value={editForm.inn2Score} onChange={(e) => setEditForm({...editForm, inn2Score: parseInt(e.target.value)||0})} /></div>
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Wkts</Label><Input type="number" className="font-black" value={editForm.inn2Wickets} onChange={(e) => setEditForm({...editForm, inn2Wickets: parseInt(e.target.value)||0})} /></div>
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Overs</Label><Input type="number" className="font-black" value={editForm.inn2Overs} onChange={(e) => setEditForm({...editForm, inn2Overs: parseInt(e.target.value)||0})} /></div>
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Balls</Label><Input type="number" max="5" className="font-black" value={editForm.inn2Balls} onChange={(e) => setEditForm({...editForm, inn2Balls: parseInt(e.target.value)||0})} /></div>
                </div>
             </div>

             <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Final Result Description</Label>
                <Input className="font-bold" value={editForm.resultDescription} onChange={(e) => setEditForm({...editForm, resultDescription: e.target.value})} />
             </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateFullMatch} className="w-full h-12 font-black uppercase tracking-widest shadow-lg"><Save className="w-4 h-4 mr-2" /> COMMIT SCORECARD CHANGES</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wicket Dialog */}
      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Record Wicket</DialogTitle></DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">Batter Dismissed</Label>
              <select className="w-full h-12 rounded-md border border-input bg-background px-3 py-2 text-sm font-bold" value={wicketForm.batterOutId} onChange={(e) => setWicketForm({...wicketForm, batterOutId: e.target.value})}>
                <option value="">Who is out?</option>
                <option value={activeInningData?.strikerPlayerId || ''}>{getPlayerName(activeInningData?.strikerPlayerId || '')} (On Strike)</option>
                <option value={activeInningData?.nonStrikerPlayerId || ''}>{getPlayerName(activeInningData?.nonStrikerPlayerId || '')} (Non-Striker)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">Method of Dismissal</Label>
              <select className="w-full h-12 rounded-md border border-input bg-background px-3 py-2 text-sm font-bold" value={wicketForm.type} onChange={(e) => setWicketForm({...wicketForm, type: e.target.value})}>
                <option value="bowled">Bowled</option><option value="catch">Caught</option><option value="lbw">LBW</option><option value="runout">Run Out</option><option value="stumping">Stumped</option><option value="hitwicket">Hit Wicket</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">Fielder Involved (Optional)</Label>
              <select className="w-full h-12 rounded-md border border-input bg-background px-3 py-2 text-sm font-bold" value={wicketForm.fielderId} onChange={(e) => setWicketForm({...wicketForm, fielderId: e.target.value})}>
                <option value="none">None / Direct</option>
                {allPlayers?.filter(p => p.teamId === activeInningData?.bowlingTeamId).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleWicket} className="w-full h-14 font-black uppercase tracking-widest shadow-xl">Confirm Wicket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bowler Dialog */}
      <Dialog open={isBowlerDialogOpen} onOpenChange={setIsBowlerDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[80vh] overflow-y-auto rounded-xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Change Bowler</DialogTitle></DialogHeader>
          <div className="space-y-4 py-6 text-center">
             <PenTool className="w-12 h-12 text-primary mx-auto opacity-20" />
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">Select Bowler for the Over</Label>
              <select className="w-full h-14 rounded-md border border-input bg-background px-3 py-2 text-sm font-bold" onChange={(e) => { updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { currentBowlerPlayerId: e.target.value }); setIsBowlerDialogOpen(false); }}>
                <option value="">Choose next bowler</option>
                {allPlayers?.filter(p => p.teamId === activeInningData?.bowlingTeamId).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

