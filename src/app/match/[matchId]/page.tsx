
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, serverTimestamp, getDoc, limit, getDocs, increment, setDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { History, CheckCircle2, Trophy, Star, ShieldAlert, UserPlus, Info, ChevronRight, AlertCircle, Edit2, Save, Settings2, ShieldCheck, PenTool, BarChart3, LineChart as LineChartIcon, Flag, User, Target, Zap, PlayCircle, Undo2, Users2, ArrowLeftRight, Clock, Calendar, BarChart, TrendingUp, Users, ChevronDown, ChevronUp, RefreshCw, Trash2, Download, FileText, Share2, Users as UsersIcon, Sparkles, Loader2, Skull, LogOut, Search } from 'lucide-react';
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
  const [isRetireDialogOpen, setIsRetireDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isEditFullMatchOpen, setIsEditFullMatchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activeInningView, setActiveInningView] = useState<number>(1);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

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
    if (match?.currentInningNumber && isMounted && activeTab === 'live') {
      setActiveInningView(match.currentInningNumber);
    }
  }, [match?.currentInningNumber, isMounted, activeTab]);

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

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none' || pid === '') return '---';
    return allPlayers?.find(p => p.id === pid)?.name || '---';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    return allTeams?.find(t => t.id === tid)?.name || 'Unknown Team';
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

  const currentInningStats = activeInningView === 1 ? stats1 : stats2;
  const currentDeliveriesList = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;

  const definitivelyOutIds = useMemo(() => {
    const currentDeliveries = match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;
    if (!currentDeliveries) return new Set<string>();
    const outSet = new Set<string>();
    currentDeliveries.forEach(d => {
      if (d.isWicket && d.dismissalType !== 'retired') {
        outSet.add(d.batsmanOutPlayerId || d.strikerPlayerId);
      }
    });
    return outSet;
  }, [match?.currentInningNumber, inn1Deliveries, inn2Deliveries]);

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
    if (activeInningData.isDeclaredFinished) return true;
    return activeInningData.oversCompleted >= match.totalOvers || activeInningData.wickets >= 10;
  }, [match, activeInningData]);

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire || isCurrentInningFinished) return;
    
    if (!activeInningData.strikerPlayerId || (!activeInningData.isLastManActive && !activeInningData.nonStrikerPlayerId) || !activeInningData.currentBowlerPlayerId) {
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
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none',
      bowlerId: activeInningData.currentBowlerPlayerId,
      runsScored: ballRuns, extraRuns, extraType, totalRunsOnDelivery,
      isWicket: false, timestamp: Date.now()
    };

    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    const updates: any = {
      score: newScore, 
      oversCompleted: newOvers, 
      ballsInCurrentOver: newBalls
    };

    if (!activeInningData.isLastManActive) {
      if (runs % 2 !== 0) {
        updates.strikerPlayerId = activeInningData.nonStrikerPlayerId;
        updates.nonStrikerPlayerId = activeInningData.strikerPlayerId;
      }
    }

    updateDocumentNonBlocking(inningRef, updates);

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
      overNumber: activeInningData.oversCompleted + 1,
      ballNumberInOver: activeInningData.ballsInCurrentOver + 1,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none',
      bowlerId: activeInningData.currentBowlerPlayerId,
      runsScored: 0, extraRuns: 0, extraType: 'none', totalRunsOnDelivery: 0,
      isWicket: true, dismissalType: wicketForm.type, batsmanOutPlayerId: wicketForm.batterOutId, fielderPlayerId: wicketForm.fielderId,
      timestamp: Date.now()
    };

    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    const newWickets = activeInningData.wickets + (wicketForm.type === 'retired' ? 0 : 1);
    let newBalls = activeInningData.ballsInCurrentOver + (wicketForm.type === 'retired' ? 0 : 1);
    let newOvers = activeInningData.oversCompleted;
    if (newBalls === 6) { newOvers += 1; newBalls = 0; }

    const updates: any = {
      wickets: newWickets, 
      oversCompleted: newOvers, 
      ballsInCurrentOver: newBalls
    };

    if (wicketForm.decision === 'finish') {
      updates.isDeclaredFinished = true;
    } else if (wicketForm.decision === 'last_man') {
      updates.isLastManActive = true;
      updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId;
      updates.nonStrikerPlayerId = '';
    } else {
      updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId;
      updates.nonStrikerPlayerId = wicketForm.batterOutId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId;
    }

    updateDocumentNonBlocking(inningRef, updates);
    setIsWicketDialogOpen(false);
    toast({ title: wicketForm.type === 'retired' ? "RETIRED" : "OUT!", variant: "destructive" });
    
    if (newWickets < 10 && wicketForm.decision !== 'finish') {
      setIsPlayerAssignmentOpen(true);
    }
  };

  const handleRetire = async () => {
    if (!match || !activeInningData || !isUmpire || !retireForm.batterId) return;
    
    const currentInningId = `inning_${match.currentInningNumber}`;
    const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
    
    const deliveryData = {
      id: doc(collection(db, 'temp')).id,
      overNumber: activeInningData.oversCompleted + 1,
      ballNumberInOver: activeInningData.ballsInCurrentOver,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none',
      bowlerId: activeInningData.currentBowlerPlayerId,
      runsScored: 0, extraRuns: 0, extraType: 'none', totalRunsOnDelivery: 0,
      isWicket: true, dismissalType: 'retired', batsmanOutPlayerId: retireForm.batterId,
      timestamp: Date.now()
    };

    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    const updates: any = {
      isDeclaredFinished: retireForm.decision === 'finish'
    };

    if (retireForm.decision === 'finish') {
      updates.isDeclaredFinished = true;
    } else if (retireForm.decision === 'last_man') {
      updates.isLastManActive = true;
      updates.strikerPlayerId = retireForm.batterId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId;
      updates.nonStrikerPlayerId = '';
    } else {
      updates.strikerPlayerId = retireForm.batterId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId;
      updates.nonStrikerPlayerId = retireForm.batterId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId;
    }

    updateDocumentNonBlocking(inningRef, updates);
    setIsRetireDialogOpen(false);
    toast({ title: "Batter Retired" });
    
    if (retireForm.decision === 'next') {
      setIsPlayerAssignmentOpen(true);
    }
  };

  const handleUndoLastBall = async () => {
    if (!match || !activeInningData || !isUmpire || isUndoing) return;
    setIsUndoing(true);
    
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords');
    const q = query(deliveriesRef, orderBy('timestamp', 'desc'), limit(1));
    
    try {
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        toast({ title: "Nothing to undo" });
        return;
      }

      const lastBall = snapshot.docs[0].data();
      const lastBallId = snapshot.docs[0].id;

      let { score, wickets, oversCompleted, ballsInCurrentOver, strikerPlayerId, nonStrikerPlayerId, isLastManActive } = activeInningData;

      score -= lastBall.totalRunsOnDelivery;
      if (lastBall.isWicket) {
        if (lastBall.dismissalType !== 'retired') {
          wickets -= 1;
        }
        strikerPlayerId = lastBall.strikerPlayerId;
        nonStrikerPlayerId = lastBall.nonStrikerPlayerId;
        if (nonStrikerPlayerId === 'none') nonStrikerPlayerId = '';
        isLastManActive = lastBall.nonStrikerPlayerId === 'none';
      } else {
        if (!isLastManActive && lastBall.runsScored % 2 !== 0) {
          const temp = strikerPlayerId;
          strikerPlayerId = nonStrikerPlayerId;
          nonStrikerPlayerId = temp;
        }
      }

      const isLegal = lastBall.extraType !== 'wide' && lastBall.extraType !== 'noball' && lastBall.dismissalType !== 'retired';
      if (isLegal) {
        if (ballsInCurrentOver === 0) {
          oversCompleted -= 1;
          ballsInCurrentOver = 5;
        } else {
          ballsInCurrentOver -= 1;
        }
      }

      const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
      updateDocumentNonBlocking(inningRef, {
        score, wickets, oversCompleted, ballsInCurrentOver, strikerPlayerId, nonStrikerPlayerId, isLastManActive, isDeclaredFinished: false
      });

      deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', lastBallId));
      toast({ title: "Last Ball Undone" });
    } catch (e) {
      toast({ title: "Undo Failed", variant: "destructive" });
    } finally {
      setIsUndoing(false);
    }
  };

  const handleFixSummary = async (inningNumOverride?: number) => {
    const targetInningNum = inningNumOverride || match?.currentInningNumber;
    if (!match || !isUmpire || isFixing || !targetInningNum) return;
    setIsFixing(true);
    toast({ title: `Recalculating Innings ${targetInningNum}...`, description: "Scanning history to fix summary counts." });

    try {
      const currentInningId = `inning_${targetInningNum}`;
      const deliveriesRef = collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords');
      const q = query(deliveriesRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      
      let newScore = 0;
      let newWickets = 0;
      let newBalls = 0;
      let newOvers = 0;

      snapshot.docs.forEach(doc => {
        const d = doc.data();
        newScore += d.totalRunsOnDelivery || 0;
        if (d.isWicket && d.dismissalType !== 'retired') newWickets += 1;
        
        const isLegal = d.extraType !== 'wide' && d.extraType !== 'noball';
        if (isLegal) {
          newBalls += 1;
          if (newBalls === 6) {
            newOvers += 1;
            newBalls = 0;
          }
        }
      });

      const inningRef = doc(db, 'matches', matchId, 'innings', currentInningId);
      await setDoc(inningRef, {
        score: newScore,
        wickets: newWickets,
        oversCompleted: newOvers,
        ballsInCurrentOver: newBalls
      }, { merge: true });

      toast({ title: "Summary Fixed", description: `Score: ${newScore}/${newWickets}, Overs: ${newOvers}.${newBalls}` });
    } catch (e) {
      toast({ title: "Fix Failed", variant: "destructive" });
    } finally {
      setIsFixing(false);
    }
  };

  const handleDeleteBall = (ballId: string, inningNum: number) => {
    if (!isUmpire) return;
    if (!confirm("Are you sure you want to delete this ball? You must recalculate the inning afterwards.")) return;
    
    deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${inningNum}`, 'deliveryRecords', ballId));
    toast({ 
      title: "Ball Removed", 
      description: "Note: Total score is not automatically adjusted. Click 'Fix Summary' above to update scoreboard.",
      duration: 5000 
    });
  };

  const handleStartSecondInnings = async () => {
    if (!match || match.currentInningNumber !== 1 || !isUmpire) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'matches', matchId), { currentInningNumber: 2 });
    batch.set(doc(db, 'matches', matchId, 'innings', 'inning_2'), {
      id: 'inning_2', matchId, inningNumber: 2, score: 0, wickets: 0,
      oversCompleted: 0, ballsInCurrentOver: 0,
      battingTeamId: inn1?.bowlingTeamId, bowlingTeamId: inn1?.battingTeamId,
      strikerPlayerId: '', nonStrikerPlayerId: '', currentBowlerPlayerId: '',
      matchStatus: 'live', isDeclaredFinished: false, isLastManActive: false
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

  const currentBattingSquad = allPlayers?.filter(p => match.currentInningNumber === 1 ? match.team1SquadPlayerIds?.includes(p.id) : match.team2SquadPlayerIds?.includes(p.id)) || [];
  const currentBowlingSquad = allPlayers?.filter(p => match.currentInningNumber === 1 ? match.team2SquadPlayerIds?.includes(p.id) : match.team1SquadPlayerIds?.includes(p.id)) || [];

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
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">{getTeamName(inn.battingTeamId)}</p>
                    <h4 className="font-black text-xl">{inn.score}/{inn.wickets}</h4>
                    {inn.isLastManActive && <Badge className="bg-destructive text-[8px] h-4 mt-1">LAST MAN STANDING</Badge>}
                  </div>
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
                          {!activeInningData.isLastManActive && <p className="text-[9px] text-slate-400 font-bold uppercase">Non-Strike: {getPlayerName(activeInningData.nonStrikerPlayerId)}</p>}
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
                      <Button variant="outline" onClick={() => setIsRetireDialogOpen(true)} className="h-14 font-black text-blue-700 bg-blue-50 uppercase tracking-widest text-xs">RETIRE</Button>
                      <Button variant="outline" onClick={handleUndoLastBall} disabled={isUndoing} className="h-14 font-black text-slate-700 bg-slate-100 uppercase tracking-widest text-xs">
                        {isUndoing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Undo2 className="w-4 h-4 mr-2" />} UNDO
                      </Button>
                      <Button variant="outline" onClick={() => {
                        if(confirm("End current innings manually?")) {
                          updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { isDeclaredFinished: true });
                        }
                      }} className="h-14 font-black text-secondary bg-secondary/5 uppercase tracking-widest text-xs border-secondary/20">DECLARE END</Button>
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
              {(match.currentInningNumber >= 2 || inn2) && <Button size="sm" variant={activeInningView === 2 ? 'default' : 'outline'} onClick={() => setActiveInningView(2)} className="font-black text-[10px] uppercase">2nd Innings</Button>}
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

        <TabsContent value="overs" className="pt-4">
           <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <Button size="sm" variant={activeInningView === 1 ? 'default' : 'outline'} onClick={() => setActiveInningView(1)} className="font-black text-[10px] uppercase">1st Innings</Button>
                {(match.currentInningNumber >= 2 || inn2) && <Button size="sm" variant={activeInningView === 2 ? 'default' : 'outline'} onClick={() => setActiveInningView(2)} className="font-black text-[10px] uppercase">2nd Innings</Button>}
              </div>
              {isUmpire && (
                <Button size="sm" variant="secondary" className="h-8 text-[9px] font-black uppercase tracking-widest" onClick={() => handleFixSummary(activeInningView)}>
                  <Zap className="w-3 h-3 mr-1.5" /> Fix Summary
                </Button>
              )}
           </div>
           <div className="space-y-4">
              {currentDeliveriesList && currentDeliveriesList.length > 0 ? (
                (() => {
                  const overs: Record<number, any[]> = {};
                  currentDeliveriesList.forEach(d => {
                    if (!overs[d.overNumber]) overs[d.overNumber] = [];
                    overs[d.overNumber].push(d);
                  });
                  return Object.keys(overs).sort((a, b) => parseInt(b) - parseInt(a)).map(oNum => (
                    <Card key={oNum} className="overflow-hidden border-l-4 border-l-slate-200">
                      <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Over {oNum}</h4>
                        <p className="text-[9px] font-bold text-slate-400">By {getPlayerName(overs[parseInt(oNum)][0].bowlerId)}</p>
                      </div>
                      <div className="p-4 space-y-3">
                        {overs[parseInt(oNum)].map((d, idx) => (
                          <div key={d.id || idx} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border-2", 
                                d.isWicket ? "bg-red-600 border-red-700 text-white shadow-sm" : 
                                d.runsScored >= 4 ? "bg-blue-600 border-blue-700 text-white shadow-sm" :
                                d.extraType !== 'none' ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-slate-100 text-slate-700")}>
                                {d.isWicket ? "W" : d.extraType === 'wide' ? `${d.totalRunsOnDelivery}wd` : d.extraType === 'noball' ? `${d.totalRunsOnDelivery}nb` : d.runsScored}
                              </div>
                              <div className="flex flex-col">
                                <p className="text-[10px] font-black uppercase">{getPlayerName(d.strikerPlayerId)}</p>
                                <p className="text-[8px] text-slate-400 font-bold uppercase">{d.extraType !== 'none' ? `(+${d.extraRuns} extras)` : `${d.runsScored} runs`}</p>
                              </div>
                            </div>
                            {isUmpire && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-300 hover:text-destructive transition-colors" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBall(d.id, activeInningView);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ));
                })()
              ) : (
                <div className="py-20 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                  <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No deliveries found for Inning {activeInningView}</p>
                </div>
              )}
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditFullMatchOpen} onOpenChange={setIsEditFullMatchOpen}>
        <DialogContent className="max-w-2xl rounded-xl border-t-8 border-t-primary">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> CORRECTION ENGINE</DialogTitle></DialogHeader>
          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Match Status</Label>
                <Select value={match.status} onValueChange={v => updateDocumentNonBlocking(matchRef, {status: v})}>
                  <SelectTrigger className="font-bold h-12 shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="live">Live</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Active Inning (Correct Here)</Label>
                <Select value={match.currentInningNumber.toString()} onValueChange={v => updateDocumentNonBlocking(matchRef, {currentInningNumber: parseInt(v)})}>
                  <SelectTrigger className="font-bold h-12 shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">Inning 1</SelectItem><SelectItem value="2">Inning 2</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Result Description</Label><Input value={match.resultDescription} onChange={e => updateDocumentNonBlocking(matchRef, {resultDescription: e.target.value})} className="font-bold text-primary h-12 shadow-sm" /></div>
            
            <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">Professional Recovery</h4>
              <Button onClick={() => handleFixSummary()} disabled={isFixing} variant="secondary" className="w-full h-12 font-black uppercase tracking-widest text-[10px]">
                {isFixing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />} Fix Summary (Recalculate from Balls)
              </Button>
              <p className="text-[8px] text-slate-400 font-bold uppercase mt-2 text-center">Use this if the total score does not match history records.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsEditFullMatchOpen(false)} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl">CLOSE TOOLS</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="rounded-xl border-t-8 border-t-destructive">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2 text-destructive"><Skull className="w-5 h-5" /> Register Wicket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Wicket Type</Label><Select value={wicketForm.type} onValueChange={v => setWicketForm({...wicketForm, type: v})}><SelectTrigger className="font-bold"><SelectValue /></SelectTrigger><SelectContent>{['bowled', 'caught', 'lbw', 'runout', 'stumped'].map(t => <SelectItem key={t} value={t} className="uppercase font-bold text-[10px]">{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label><Select value={wicketForm.batterOutId} onValueChange={v => setWicketForm({...wicketForm, batterOutId: v})}><SelectTrigger className="font-bold"><SelectValue placeholder="Select Batter" /></SelectTrigger><SelectContent>
              {activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)}</SelectItem>}
              {activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>}
            </SelectContent></Select></div>
            
            <div className="space-y-1 p-3 bg-slate-50 rounded-lg border">
              <Label className="text-[10px] font-black uppercase text-primary mb-2 block">Post-Wicket Action</Label>
              <Select value={wicketForm.decision} onValueChange={v => setWicketForm({...wicketForm, decision: v})}>
                <SelectTrigger className="font-bold h-12 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="next" className="font-bold">Next Batter (Regular)</SelectItem>
                  <SelectItem value="last_man" className="font-bold">Play as Last Man Standing</SelectItem>
                  <SelectItem value="finish" className="font-bold text-destructive">Finish Innings Now</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={handleWicket} className="w-full h-12 font-black uppercase tracking-widest shadow-lg">Confirm Out</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRetireDialogOpen} onOpenChange={setIsRetireDialogOpen}>
        <DialogContent className="rounded-xl border-t-8 border-t-blue-500">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2 text-blue-600"><LogOut className="w-5 h-5" /> Retire Batter</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Batter Retiring</Label><Select value={retireForm.batterId} onValueChange={v => setRetireForm({...retireForm, batterId: v})}><SelectTrigger className="font-bold"><SelectValue placeholder="Select Batter" /></SelectTrigger><SelectContent>
              {activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)} (Striker)</SelectItem>}
              {activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)} (Non-Striker)</SelectItem>}
            </SelectContent></Select></div>
            
            <div className="space-y-1 p-3 bg-slate-50 rounded-lg border">
              <Label className="text-[10px] font-black uppercase text-primary mb-2 block">Post-Retire Action</Label>
              <Select value={retireForm.decision} onValueChange={v => setRetireForm({...retireForm, decision: v})}>
                <SelectTrigger className="font-bold h-12 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="next" className="font-bold">Replace with Next Batter</SelectItem>
                  <SelectItem value="last_man" className="font-bold">Leave as Last Man Standing</SelectItem>
                  <SelectItem value="finish" className="font-bold text-destructive">Finish Innings Now</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleRetire} className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-black uppercase tracking-widest shadow-lg">Confirm Retirement</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="rounded-xl border-t-8 border-t-primary">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-widest">Assign Positions</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400">Striker</Label>
                <Select 
                  value={activeInningData?.strikerPlayerId || undefined} 
                  onValueChange={v => {
                    const updates: any = { strikerPlayerId: v };
                    if (v === activeInningData?.currentBowlerPlayerId) updates.currentBowlerPlayerId = '';
                    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), updates);
                  }}
                >
                  <SelectTrigger className="font-bold"><SelectValue placeholder="Striker" /></SelectTrigger>
                  <SelectContent>
                    {currentBattingSquad
                      .filter(p => !definitivelyOutIds.has(p.id))
                      .filter(p => p.id !== activeInningData?.nonStrikerPlayerId && p.id !== activeInningData?.currentBowlerPlayerId)
                      .map(p => (
                      <SelectItem key={p.id} value={p.id} className="font-bold">
                        {p.name} <span className="text-[8px] opacity-50 ml-1">({p.role})</span>
                        {p.id === match.commonPlayerId && <span className="text-[8px] text-secondary ml-1">[CP]</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!activeInningData?.isLastManActive && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Non-Striker</Label>
                  <Select 
                    value={activeInningData?.nonStrikerPlayerId || undefined} 
                    onValueChange={v => {
                      const updates: any = { nonStrikerPlayerId: v };
                      if (v === activeInningData?.currentBowlerPlayerId) updates.currentBowlerPlayerId = '';
                      updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), updates);
                    }}
                  >
                    <SelectTrigger className="font-bold"><SelectValue placeholder="Non-Striker" /></SelectTrigger>
                    <SelectContent>
                      {currentBattingSquad
                        .filter(p => !definitivelyOutIds.has(p.id))
                        .filter(p => p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.currentBowlerPlayerId)
                        .map(p => (
                        <SelectItem key={p.id} value={p.id} className="font-bold">
                          {p.name} <span className="text-[8px] opacity-50 ml-1">({p.role})</span>
                          {p.id === match.commonPlayerId && <span className="text-[8px] text-secondary ml-1">[CP]</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Current Bowler</Label>
              <Select 
                value={activeInningData?.currentBowlerPlayerId || undefined} 
                onValueChange={v => {
                  const updates: any = { currentBowlerPlayerId: v };
                  if (v === activeInningData?.strikerPlayerId) updates.strikerPlayerId = '';
                  if (v === activeInningData?.nonStrikerPlayerId) updates.nonStrikerPlayerId = '';
                  updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), updates);
                }}
              >
                <SelectTrigger className="font-bold"><SelectValue placeholder="Bowler" /></SelectTrigger>
                <SelectContent>
                  {currentBowlingSquad.filter(p => p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.nonStrikerPlayerId).map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">
                      {p.name} <span className="text-[8px] opacity-50 ml-1">({p.role})</span>
                      {p.id === match.commonPlayerId && <span className="text-[8px] text-secondary ml-1">[CP]</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsPlayerAssignmentOpen(false)} className="w-full h-12 font-black uppercase tracking-widest shadow-lg">Confirm Rotation</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
