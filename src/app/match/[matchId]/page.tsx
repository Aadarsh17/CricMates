
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History, Loader2, ArrowLeftRight, ShieldCheck, CheckCircle2, Settings2, 
  Download, Edit2, ChevronLeft, Trash2, Share2, Star, Zap, Swords, 
  Trophy, Target, Crown, Users, Info, BarChart3, LineChart, 
  UserCog, MapPin, Calendar, Clock, PlayCircle, Undo2, LayoutPanelLeft,
  AlertCircle,
  Activity,
  ArrowRight,
  CircleDot,
  TrendingUp,
  Image as ImageIcon,
  Sparkles,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatTeamName } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toPng } from 'html-to-image';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Scatter, Cell, LabelList } from 'recharts';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { generateMatchSummary } from '@/ai/flows/generate-match-summary';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();
  const [isMounted, setIsMounted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Dialog States
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isPotmDialogOpen, setIsPotmDialogOpen] = useState(false);
  const [isEditBallOpen, setIsEditBallOpen] = useState(false);
  const [isEditMatchOpen, setIsEditMatchOpen] = useState(false);
  const [isNoBallOpen, setIsNoBallOpen] = useState(false);
  
  // AI States
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Form States
  const [assignmentForm, setAssignmentForm] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });
  const [isInjuryOverride, setIsInjuryOverride] = useState(false);
  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', extraType: 'none', runsCompleted: 0, fielderId: 'none', successorId: '' });
  const [editingBall, setEditingBall] = useState<any>(null);
  const [potmId, setPotmId] = useState('');
  const [matchEditForm, setMatchEditForm] = useState({ matchNumber: '', venue: '', matchDate: '' });

  useEffect(() => { setIsMounted(true); }, []);

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);
  
  useEffect(() => {
    if (match) {
      setMatchEditForm({
        matchNumber: match.matchNumber || '',
        venue: match.venue || '',
        matchDate: match.matchDate ? match.matchDate.substring(0, 16) : '' 
      });
    }
  }, [match]);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_1'), [db, matchId]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_2'), [db, matchId]);
  const { data: inn2 } = useDoc(inn2Ref);

  const inn1DeliveriesQuery = useMemoFirebase(() => query(collection(db, 'matches', matchId, 'innings', 'inning_1', 'deliveryRecords'), orderBy('timestamp', 'asc')), [db, matchId]);
  const { data: inn1Deliveries } = useCollection(inn1DeliveriesQuery);
  const inn2DeliveriesQuery = useMemoFirebase(() => query(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'), orderBy('timestamp', 'asc')), [db, matchId]);
  const { data: inn2Deliveries } = useCollection(inn2DeliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);
  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || [], match?.team1SquadPlayerIds || []), [inn1Deliveries, match]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || [], match?.team2SquadPlayerIds || []), [inn2Deliveries, match]);

  const getPlayer = (pid: string) => allPlayers?.find(p => p.id === pid);
  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none') return '---';
    const p = getPlayer(pid);
    return p ? p.name : '---';
  };

  const getTeamName = (tid: string) => {
    const t = allTeams?.find(t => t.id === tid);
    return t ? formatTeamName(t.name) : '---';
  };

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const currentBattingSquadIds = useMemo(() => {
    if (!match || !activeInningData) return [];
    return activeInningData.battingTeamId === match.team1Id ? (match.team1SquadPlayerIds || []) : (match.team2SquadPlayerIds || []);
  }, [match, activeInningData]);

  const opponentPlayerIds = useMemo(() => {
    if (!match || !activeInningData) return [];
    const oppTeamId = activeInningData.battingTeamId === match.team1Id ? match.team2Id : match.team1Id;
    return oppTeamId === match.team1Id ? (match.team1SquadPlayerIds || []) : (match.team2SquadPlayerIds || []);
  }, [match, activeInningData]);

  const matchPerformanceMap = useMemo(() => {
    const map: Record<string, any> = {};
    [...stats1.batting, ...stats2.batting].forEach(b => {
      if (!map[b.id]) map[b.id] = { id: b.id, name: getPlayerName(b.id), runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
      map[b.id].runs = b.runs;
      map[b.id].ballsFaced = b.balls;
      map[b.id].fours = b.fours;
      map[b.id].sixes = b.sixes;
    });
    [...stats1.bowling, ...stats2.bowling].forEach(b => {
      if (!map[b.id]) map[b.id] = { id: b.id, name: getPlayerName(b.id), runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
      map[b.id].wickets = b.wickets;
      map[b.id].ballsBowled = b.balls;
      map[b.id].runsConceded = b.runs;
      map[b.id].maidens = b.maidens;
    });
    return map;
  }, [stats1, stats2, allPlayers]);

  const recalculateInningState = async (inningId: string) => {
    const inningRef = doc(db, 'matches', matchId, 'innings', inningId);
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const deliveriesSnap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveries = deliveriesSnap.docs.map(d => d.data());

    if (deliveries.length === 0) {
      await updateDocumentNonBlocking(inningRef, {
        score: 0, wickets: 0, oversCompleted: 0, ballsInCurrentOver: 0,
        strikerPlayerId: '', nonStrikerPlayerId: '', currentBowlerPlayerId: '', isDeclaredFinished: false
      });
      return;
    }

    let score = 0, wkts = 0, legalCount = 0;
    let currentS = deliveries[0].strikerPlayerId;
    let currentNS = deliveries[0].nonStrikerPlayerId;
    let currentB = deliveries[0].bowlerId;

    deliveries.forEach((d) => {
      score += (d.totalRunsOnDelivery || 0);
      const isRetirement = d.dismissalType === 'retired';
      if (d.isWicket && !isRetirement) wkts++;
      if (d.extraType === 'none' && !isRetirement) legalCount++;
      currentS = d.strikerPlayerId;
      currentNS = d.nonStrikerPlayerId;
      currentB = d.bowlerId;
      if (d.isWicket) {
        const outId = d.batsmanOutPlayerId || currentS;
        if (outId === currentS) currentS = d.successorPlayerId || '';
        else if (outId === currentNS) currentNS = d.successorPlayerId || '';
      } else {
        if (currentNS && !d.isDeclared && (d.runsScored || 0) % 2 !== 0) {
          [currentS, currentNS] = [currentNS, currentS];
        }
      }
      if (currentNS && legalCount % 6 === 0 && d.extraType === 'none' && !isRetirement && legalCount > 0) {
        [currentS, currentNS] = [currentNS, currentS];
        currentB = ''; 
      }
    });

    const maxOvers = match?.totalOvers || 6;
    const squadSize = currentBattingSquadIds.length || 11;
    const isAllOut = wkts >= (squadSize - 1);
    const isOversDone = legalCount >= maxOvers * 6;

    await updateDocumentNonBlocking(inningRef, {
      score, wickets: wkts, oversCompleted: Math.floor(legalCount / 6), ballsInCurrentOver: legalCount % 6,
      strikerPlayerId: currentS || '', nonStrikerPlayerId: currentNS || '',
      currentBowlerPlayerId: (legalCount % 6 === 0 && deliveries[deliveries.length-1].extraType === 'none' && deliveries[deliveries.length-1].dismissalType !== 'retired') ? '' : currentB,
      isDeclaredFinished: isAllOut || isOversDone
    });
  };

  const handleRecordBall = async (runs: number, extra: any = 'none', isDeclared: boolean = false) => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = {
      id: deliveryId, strikerPlayerId: activeInningData.strikerPlayerId, nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerId: activeInningData.currentBowlerPlayerId, runsScored: runs, extraType: extra, isDeclared: isDeclared,
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0), isWicket: false, timestamp: Date.now()
    };
    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData);
    await recalculateInningState(currentInningId);
    setIsNoBallOpen(false);
  };

  const handleUndoLastBall = async () => {
    const currentInningId = `inning_${match?.currentInningNumber}`;
    const deliveries = match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;
    if (!deliveries || deliveries.length === 0) return;
    const lastBall = [...deliveries].sort((a,b) => b.timestamp - a.timestamp)[0];
    if (confirm(`Undo last ball (${lastBall.runsScored} runs)?`)) {
      await deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', lastBall.id));
      await recalculateInningState(currentInningId);
      toast({ title: "Ball Recalled" });
    }
  };

  const handleRecordWicket = async () => {
    if (!match || !activeInningData || !isUmpire || !wicketForm.batterOutId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = {
      id: deliveryId, strikerPlayerId: activeInningData.strikerPlayerId, nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerId: activeInningData.currentBowlerPlayerId, runsScored: wicketForm.runsCompleted, extraType: wicketForm.extraType,
      totalRunsOnDelivery: wicketForm.runsCompleted + (wicketForm.extraType !== 'none' ? 1 : 0), isWicket: true, dismissalType: wicketForm.type,
      batsmanOutPlayerId: wicketForm.batterOutId, fielderPlayerId: wicketForm.fielderId, successorPlayerId: wicketForm.successorId, timestamp: Date.now()
    };
    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData);
    await recalculateInningState(currentInningId);
    setIsWicketDialogOpen(false);
    setWicketForm({ type: 'bowled', batterOutId: '', extraType: 'none', runsCompleted: 0, fielderId: 'none', successorId: '' });
  };

  const handleStartSecondInnings = async () => {
    if (!match || match.currentInningNumber !== 1) return;
    const bat1Id = inn1?.battingTeamId || match.team1Id;
    const bat2Id = bat1Id === match.team1Id ? match.team2Id : match.team1Id;
    const iData = { 
      id: 'inning_2', battingTeamId: bat2Id, score: 0, wickets: 0, 
      oversCompleted: 0, ballsInCurrentOver: 0, strikerPlayerId: '', 
      nonStrikerPlayerId: '', currentBowlerPlayerId: '', isDeclaredFinished: false 
    };
    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), iData);
    await updateDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: 2 });
    setAssignmentForm({ strikerId: '', nonStrikerId: '', bowlerId: '' });
    setIsPlayerAssignmentOpen(true);
  };

  const handleUpdateMatchInfo = async () => {
    if (!matchId) return;
    await updateDocumentNonBlocking(doc(db, 'matches', matchId), matchEditForm);
    setIsEditMatchOpen(false);
    toast({ title: "Match Info Updated" });
  };

  const handleDeleteBall = async (ballId: string, inningPath: string) => {
    if (!confirm("Permanently delete this delivery?")) return;
    const innId = inningPath?.split('/')[3] || `inning_${match?.currentInningNumber}`;
    const ballRef = doc(db, 'matches', matchId, 'innings', innId, 'deliveryRecords', ballId);
    await deleteDocumentNonBlocking(ballRef);
    await recalculateInningState(innId);
    toast({ title: "Ball Deleted" });
  };

  const handleGenerateAISummary = async () => {
    if (!match || !inn1 || !inn2) return;
    setIsAiLoading(true);
    try {
      const input = {
        matchId: match.id,
        matchOverall: {
          date: match.matchDate || new Date().toISOString(),
          totalOversScheduled: match.totalOvers,
          result: match.resultDescription || 'Pending',
          team1Name: getTeamName(match.team1Id),
          team2Name: getTeamName(match.team2Id),
          team1FinalScore: `${stats1.total}/${stats1.wickets} in ${stats1.overs} ov`,
          team2FinalScore: `${stats2.total}/${stats2.wickets} in ${stats2.overs} ov`,
          tossWinner: getTeamName(match.tossWinnerTeamId),
          tossDecision: match.tossDecision
        },
        inningsSummaries: [
          {
            inningNumber: 1,
            battingTeamName: getTeamName(inn1.battingTeamId),
            bowlingTeamName: getTeamName(inn1.battingTeamId === match.team1Id ? match.team2Id : match.team1Id),
            score: stats1.total,
            wickets: stats1.wickets,
            overs: parseFloat(stats1.overs),
            topPerformersBatting: stats1.batting.slice(0, 3).map(b => ({ playerName: getPlayerName(b.id), runs: b.runs, ballsFaced: b.balls, fours: b.fours, sixes: b.sixes, strikeRate: parseFloat(b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0' ) })),
            topPerformersBowling: stats1.bowling.slice(0, 3).map(b => ({ playerName: getPlayerName(b.id), overs: parseFloat(b.oversDisplay), maidens: b.maidens, runsConceded: b.runs, wickets: b.wickets, economy: parseFloat(b.economy) })),
            keyMoments: stats1.fow.map(f => `Wicket ${f.wicketNum} at ${f.scoreAtWicket} (${f.over} ov)`)
          },
          {
            inningNumber: 2,
            battingTeamName: getTeamName(inn2.battingTeamId),
            bowlingTeamName: getTeamName(inn2.battingTeamId === match.team1Id ? match.team2Id : match.team1Id),
            score: stats2.total,
            wickets: stats2.wickets,
            overs: parseFloat(stats2.overs),
            topPerformersBatting: stats2.batting.slice(0, 3).map(b => ({ playerName: getPlayerName(b.id), runs: b.runs, ballsFaced: b.balls, fours: b.fours, sixes: b.sixes, strikeRate: parseFloat(b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0' ) })),
            topPerformersBowling: stats2.bowling.slice(0, 3).map(b => ({ playerName: getPlayerName(b.id), overs: parseFloat(b.oversDisplay), maidens: b.maidens, runsConceded: b.runs, wickets: b.wickets, economy: parseFloat(b.economy) })),
            keyMoments: stats2.fow.map(f => `Wicket ${f.wicketNum} at ${f.scoreAtWicket} (${f.over} ov)`)
          }
        ],
        playerOverallPerformance: Object.values(matchPerformanceMap).map(p => ({
          playerName: p.name,
          teamName: 'Player',
          role: 'All-rounder' as any,
          cvpScore: calculatePlayerCVP(p),
          battingStats: p.runs > 0 ? { runs: p.runs, ballsFaced: p.ballsFaced, strikeRate: p.ballsFaced > 0 ? parseFloat(((p.runs/p.ballsFaced)*100).toFixed(1)) : 0, fours: p.fours, sixes: p.sixes } : undefined,
          bowlingStats: p.ballsBowled > 0 ? { overs: p.ballsBowled/6, maidens: p.maidens, runsConceded: p.runsConceded, wickets: p.wickets, economy: p.ballsBowled > 0 ? parseFloat((p.runsConceded/(p.ballsBowled/6)).toFixed(2)) : 0 } : undefined,
          fieldingStats: (p.catches + p.stumpings + p.runOuts) > 0 ? { catches: p.catches, stumpings: p.stumpings, runOuts: p.runOuts } : undefined
        })).sort((a,b) => b.cvpScore - a.cvpScore).slice(0, 5)
      };
      const summary = await generateMatchSummary(input as any);
      setAiSummary(summary);
      toast({ title: "AI Intelligence Generated" });
    } catch (err) {
      console.error(err);
      toast({ title: "AI Generation Failed", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const downloadScorecard = () => {
    if (printRef.current === null) return;
    toPng(printRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `CricMates_Detailed_Record_${match?.matchNumber || 'X'}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error(err);
        toast({ title: "Generation Failed", variant: "destructive" });
      });
  };

  const downloadMatchCard = () => {
    if (cardRef.current === null) return;
    toPng(cardRef.current, { cacheBust: true, pixelRatio: 3, backgroundColor: '#f8fafc' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `CricMates_MatchCard_${match?.matchNumber || 'X'}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error(err);
        toast({ title: "Card Export Failed", variant: "destructive" });
      });
  };

  const analysisData = useMemo(() => {
    const manhattan: any[] = [];
    const maxOvers = match?.totalOvers || 0;
    for (let i = 1; i <= maxOvers; i++) {
      const getOverRuns = (deliveries: any[]) => {
        let count = 0; let runs = 0;
        const sorted = [...(deliveries || [])].sort((a,b) => a.timestamp - b.timestamp);
        sorted.forEach(d => {
          const isRetirement = d.dismissalType === 'retired';
          if (d.extraType === 'none' && !isRetirement) count++;
          if (Math.ceil(count / 6) === i) runs += (d.totalRunsOnDelivery || 0);
        });
        return runs;
      };
      manhattan.push({ over: i, inn1: getOverRuns(inn1Deliveries || []), inn2: getOverRuns(inn2Deliveries || []) });
    }

    const processWorm = (deliveries: any[], label: string) => {
      let cumulative = 0; let legalCount = 0;
      const points: any[] = [];
      const sorted = [...(deliveries || [])].sort((a,b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id));
      sorted.forEach(d => {
        cumulative += (d.totalRunsOnDelivery || 0);
        const isRetirement = d.dismissalType === 'retired';
        if (d.extraType === 'none' && !isRetirement) legalCount++;
        const over = parseFloat(`${Math.floor(legalCount/6)}.${legalCount%6}`);
        const isTrueWicket = d.isWicket && !isRetirement;
        points.push({ over, runs: cumulative, isWicket: isTrueWicket, [label]: cumulative });
      });
      return points;
    };

    return { manhattan, worm1: processWorm(inn1Deliveries || [], 'inn1'), worm2: processWorm(inn2Deliveries || [], 'inn2') };
  }, [inn1Deliveries, inn2Deliveries, match]);

  const liveCentreSummary = useMemo(() => {
    if (!match || !activeInningData) return { prevOvers: [], partnership: null };
    const deliveries = match.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;
    if (!deliveries) return { prevOvers: [], partnership: null };
    const sorted = [...deliveries].sort((a,b) => a.timestamp - b.timestamp);
    const overs: any[] = [];
    let currentOverBalls: any[] = [];
    let legalInInning = 0;
    sorted.forEach((d) => {
      const isRetirement = d.dismissalType === 'retired';
      const isLegal = d.extraType === 'none' && !isRetirement;
      currentOverBalls.push(d);
      if (isLegal) legalInInning++;
      if (isLegal && legalInInning % 6 === 0) {
        const runs = currentOverBalls.reduce((acc, b) => acc + (b.totalRunsOnDelivery || 0), 0);
        const wkts = currentOverBalls.filter(b => b.isWicket && b.dismissalType !== 'retired').length;
        overs.push({ num: legalInInning / 6, runs, wkts, balls: [...currentOverBalls] });
        currentOverBalls = [];
      }
    });
    const activeStats = match.currentInningNumber === 1 ? stats1 : stats2;
    const partnership = activeStats.partnerships.find(p => p.isUnbroken) || activeStats.partnerships[0];
    return { prevOvers: overs.reverse().slice(0, 3), partnership };
  }, [match, activeInningData, inn1Deliveries, inn2Deliveries, stats1, stats2]);

  if (!isMounted || isMatchLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  const currentOverBalls = (match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries)
    ?.sort((a,b) => a.timestamp - b.timestamp)
    .slice(-( (activeInningData?.ballsInCurrentOver || 0) + 12))
    .filter((_, i, arr) => {
      let legalCount = 0;
      for (let j = arr.length - 1; j >= 0; j--) {
        if (arr[j].extraType === 'none') legalCount++;
        if (legalCount > (activeInningData?.ballsInCurrentOver || 0)) return i > j;
      }
      return true;
    });

  return (
    <div className="max-w-4xl mx-auto pb-32 px-1 relative">
      <div className="fixed top-16 left-0 right-0 z-[90] bg-white border-b-4 border-slate-200 shadow-xl p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="h-10 w-10 shrink-0 rounded-full hover:bg-slate-100"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="border-r pr-4">
              <p className="text-[9px] font-black uppercase text-slate-400 truncate">{getTeamName(match?.team1Id || '')}</p>
              <div className="flex items-baseline gap-2"><span className="text-2xl font-black">{stats1.total}/{stats1.wickets}</span><span className="text-xs font-bold text-slate-500">({stats1.overs})</span></div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 truncate">{getTeamName(match?.team2Id || '')}</p>
              <div className="flex items-baseline gap-2"><span className="text-2xl font-black">{stats2.total}/{stats2.wickets}</span><span className="text-xs font-bold text-slate-500">({stats2.overs})</span></div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <Badge variant="destructive" className={cn("animate-pulse uppercase text-[10px] font-black", match?.status !== 'live' && "hidden")}>LIVE</Badge>
            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">{match?.matchNumber}</p>
          </div>
        </div>
      </div>

      <div className="pt-36">
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl mb-6 sticky top-[125px] z-[80] shadow-sm">
            <TabsTrigger value="live" className="font-black text-[9px] uppercase">Live</TabsTrigger>
            <TabsTrigger value="scorecard" className="font-black text-[9px] uppercase">Scorecard</TabsTrigger>
            <TabsTrigger value="analysis" className="font-black text-[9px] uppercase">Analysis</TabsTrigger>
            <TabsTrigger value="history" className="font-black text-[9px] uppercase">History</TabsTrigger>
            <TabsTrigger value="info" className="font-black text-[9px] uppercase">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            {isUmpire && match?.status === 'live' && (
              <Card className="bg-slate-900 border-none rounded-3xl overflow-hidden shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-1 h-12 border-white/10 text-white font-black uppercase text-[10px] bg-white/5"><ShieldCheck className="w-4 h-4 mr-2" /> Umpire Actions</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 rounded-xl font-bold" align="start">
                        <DropdownMenuItem onClick={() => { setAssignmentForm({ strikerId: activeInningData?.strikerPlayerId || '', nonStrikerId: activeInningData?.nonStrikerPlayerId || '', bowlerId: activeInningData?.currentBowlerPlayerId || '' }); setIsPlayerAssignmentOpen(true); }}><Settings2 className="w-4 h-4 mr-2" /> Assign Positions</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleStartSecondInnings} disabled={match.currentInningNumber === 2 || !activeInningData?.isDeclaredFinished}><PlayCircle className="w-4 h-4 mr-2 text-primary" /> Start 2nd Innings</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsPotmDialogOpen(true)}><Star className="w-4 h-4 mr-2 text-amber-500" /> Declare POTM</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={async () => { if(confirm("Complete match?")) await updateDocumentNonBlocking(doc(db, 'matches', matchId), { status: 'completed', resultDescription: `${stats1.total > stats2.total ? getTeamName(match.team1Id) : getTeamName(match.team2Id)} won by ${Math.abs(stats1.total - stats2.total)} runs` }); }}><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Finalize Match</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: activeInningData?.nonStrikerPlayerId, nonStrikerPlayerId: activeInningData?.strikerPlayerId })} className="flex-1 h-12 border-white/10 text-white font-black uppercase text-[10px] bg-white/5"><ArrowLeftRight className="w-4 h-4 mr-2" /> Swap Ends</Button>
                  </div>
                  {!activeInningData?.isDeclaredFinished ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 1, 2, 3, 4, 5, 6].map(r => (<Button key={r} disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl", r >= 4 ? "bg-primary text-white" : "bg-white/10 text-white")}>{r === 0 ? '•' : r}</Button>))}
                        <Button disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(0, 'wide')} className="h-14 font-black text-lg rounded-2xl bg-amber-500 text-white">WD</Button>
                        <Button disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => setIsNoBallOpen(true)} className="h-14 font-black text-lg rounded-2xl bg-orange-600 text-white">NB</Button>
                        <Button disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(1, 'none', true)} className="h-14 font-black text-lg rounded-2xl bg-emerald-600 text-white">1D</Button>
                        <Button onClick={handleUndoLastBall} className="h-14 font-black rounded-2xl bg-white/5 text-white border-white/10"><Undo2 className="w-5 h-5"/></Button>
                        <Button variant="destructive" onClick={() => { setWicketForm({...wicketForm, batterOutId: activeInningData?.strikerPlayerId || ''}); setIsWicketDialogOpen(true); }} className="h-14 font-black rounded-2xl uppercase text-[10px] shadow-lg col-span-2">WICKET</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-primary/10 p-8 rounded-3xl border-2 border-dashed border-primary/30 text-center relative"><Trophy className="w-12 h-12 text-primary mx-auto mb-4" /><h3 className="text-white font-black uppercase text-lg tracking-widest">Innings Over</h3><p className="text-slate-400 text-xs font-medium mt-2">Check the scorecard for final figures</p><Button variant="ghost" size="sm" onClick={() => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { isDeclaredFinished: false })} className="mt-4 text-[10px] font-black uppercase text-primary hover:bg-primary/5">Emergency Resume</Button></div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-6">
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-black uppercase">Live Batter</TableHead><TableHead className="text-right text-[10px] font-black uppercase">R</TableHead><TableHead className="text-right text-[10px] font-black uppercase">B</TableHead><TableHead className="text-right text-[10px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[activeInningData?.strikerPlayerId, activeInningData?.nonStrikerPlayerId].map((pid, idx) => {
                      if (!pid) return null;
                      const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
                      const b = stats.batting.find((p: any) => p?.id === pid) || { runs: 0, balls: 0 };
                      return (<TableRow key={pid} className={idx === 0 ? "bg-primary/5" : ""}><TableCell className="font-black text-xs uppercase py-4">{getPlayerName(pid)}{idx === 0 ? '*' : ''}</TableCell><TableCell className="text-right font-black">{b.runs}</TableCell><TableCell className="text-right text-xs font-bold text-slate-500">{b.balls}</TableCell><TableCell className="text-right text-[10px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell></TableRow>);
                    })}
                  </TableBody>
                </Table>
              </Card>

              <div className="space-y-4">
                {/* 1. Active Bowler (TOP PRIORITY) */}
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                  <Table>
                    <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-black uppercase">Active Bowler</TableHead><TableHead className="text-right text-[10px] font-black uppercase">O</TableHead><TableHead className="text-right text-[10px] font-black uppercase">R</TableHead><TableHead className="text-right text-[10px] font-black uppercase">W</TableHead><TableHead className="text-right text-[10px] font-black uppercase">ER</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {activeInningData?.currentBowlerPlayerId && (() => {
                        const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
                        const b = stats.bowling.find((p: any) => p.id === activeInningData.currentBowlerPlayerId) || { runs: 0, wickets: 0, oversDisplay: '0.0', economy: '0.00' };
                        return (<TableRow className="bg-secondary/5"><TableCell className="font-black text-xs uppercase py-4">{getPlayerName(activeInningData.currentBowlerPlayerId)}</TableCell><TableCell className="text-right font-bold text-xs">{b.oversDisplay}</TableCell><TableCell className="text-right font-black">{b.runs}</TableCell><TableCell className="text-right font-black text-primary">{b.wickets}</TableCell><TableCell className="text-right text-[10px] font-bold text-slate-400">{b.economy}</TableCell></TableRow>);
                      })()}
                    </TableBody>
                  </Table>
                </Card>

                {/* 2. Current Over Balls */}
                <Card className="p-4 border-none shadow-lg rounded-2xl bg-white space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Over</p>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {currentOverBalls?.length > 0 ? currentOverBalls.map((b, i) => (<div key={i} className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 border-2", b.isWicket ? "bg-red-500 border-red-600 text-white" : "bg-slate-50 border-slate-100")}>{b.isWicket ? (b.dismissalType === 'retired' ? 'R' : 'W') : b.extraType === 'wide' ? 'wd' : b.extraType === 'noball' ? 'nb' : b.runsScored}</div>)) : <div className="text-[10px] font-bold text-slate-300 uppercase py-2">Waiting for first ball...</div>}
                  </div>
                </Card>

                {/* 3. Previous Overs */}
                {liveCentreSummary.prevOvers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Previous Overs</p>
                    <div className="grid grid-cols-1 gap-2">
                      {liveCentreSummary.prevOvers.map((ov, i) => (<Card key={i} className="p-3 border-none shadow-sm rounded-xl bg-slate-50 flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Over {ov.num}</span><div className="flex gap-1">{ov.balls.map((b: any, j: number) => (<span key={j} className={cn("text-[9px] font-bold", b.isWicket ? "text-red-500" : "text-slate-600")}>{b.isWicket ? 'W' : b.totalRunsOnDelivery}</span>))}</div><span className="text-xs font-black">{ov.runs} runs, {ov.wkts} wkts</span></Card>))}
                    </div>
                  </div>
                )}

                {/* 4. Current Partnership */}
                {liveCentreSummary.partnership && (
                  <Card className="p-5 border-none shadow-xl rounded-3xl bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users className="w-16 h-16"/></div>
                    <div className="relative z-10 space-y-4">
                      <div className="flex justify-between items-center"><p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Active Partnership</p><span className="text-2xl font-black text-primary">{liveCentreSummary.partnership.runs} <span className="text-[10px] text-slate-400 uppercase">({liveCentreSummary.partnership.balls}b)</span></span></div>
                      <div className="flex gap-6 pt-4 border-t border-white/10">{Object.entries(liveCentreSummary.partnership.contributions).map(([id, s]: [any, any]) => (<div key={id} className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase text-slate-400 truncate">{getPlayerName(id)}</p><p className="text-xl font-black">{s.runs} <span className="text-[10px] text-slate-500">({s.balls})</span></p></div>))}</div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scorecard" className="space-y-10">
            {[ {id: 1, stats: stats1, teamId: inn1?.battingTeamId || match?.team1Id, bowlTeamId: match?.team2Id, label: '1ST INNINGS'}, 
               {id: 2, stats: stats2, teamId: inn2?.battingTeamId || match?.team2Id, bowlTeamId: match?.team1Id, label: '2ND INNINGS'} 
            ].map(inn => (
              <div key={inn.id} className="space-y-6">
                <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
                  <div className="space-y-1"><p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{inn.label}</p><h2 className="text-lg font-black uppercase">{getTeamName(inn.teamId || '')}</h2></div>
                  <div className="text-right"><p className="text-3xl font-black">{inn.stats.total}/{inn.stats.wickets}</p><p className="text-[10px] font-bold text-slate-400 uppercase">OVERS: {inn.stats.overs} (RR: {inn.stats.rr})</p></div>
                </div>
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                  <Table>
                    <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">4s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">6s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {inn.stats.batting.map((b: any) => (<TableRow key={b.id}><TableCell className="py-4"><p className="font-black text-xs uppercase">{getPlayerName(b.id)}</p><p className="text-[8px] font-bold text-slate-400 uppercase italic mt-0.5">{(b.dismissal || 'not out').replace('Fielder', getPlayerName(b.fielderId))}</p></TableCell><TableCell className="text-right font-black">{b.runs}</TableCell><TableCell className="text-right text-xs font-bold text-slate-500">{b.balls}</TableCell><TableCell className="text-right text-xs font-bold text-primary">{b.fours}</TableCell><TableCell className="text-right text-xs font-bold text-indigo-600">{b.sixes}</TableCell><TableCell className="text-right text-[9px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell></TableRow>))}
                      <TableRow className="bg-slate-50/50"><TableCell className="font-bold text-[10px] uppercase text-slate-500">Extras</TableCell><TableCell colSpan={5} className="text-right font-black text-xs">{inn.stats.extras.total} (w {inn.stats.extras.w}, nb {inn.stats.extras.nb})</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inn.stats.fow.length > 0 && (<div className="space-y-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Fall of Wickets</p><Card className="p-4 border-none shadow-md rounded-2xl bg-white"><div className="space-y-1.5">{inn.stats.fow.map((f: any, idx: number) => (<div key={idx} className="flex justify-between items-center text-[10px] font-bold uppercase"><span className="text-slate-400">{idx+1}-{f.scoreAtWicket}</span><span className="text-slate-900">{getPlayerName(f.playerOutId)}</span><span className="text-slate-400">({f.over} ov)</span></div>))}</div></Card></div>)}
                  {inn.stats.didNotBat.length > 0 && (<div className="space-y-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Did Not Bat</p><div className="px-4 py-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><p className="text-[10px] font-bold uppercase text-slate-600">{inn.stats.didNotBat.map((id: string) => getPlayerName(id)).join(', ')}</p></div></div>)}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Bowling: {getTeamName(inn.bowlTeamId || '')}</p>
                  <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Bowler</TableHead><TableHead className="text-right text-[9px] font-black uppercase">O</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">W</TableHead><TableHead className="text-right text-[9px] font-black uppercase">ER</TableHead></TableRow></TableHeader>
                      <TableBody>{inn.stats.bowling.map((b: any) => (<TableRow key={b.id}><TableCell className="font-black text-xs uppercase py-4">{getPlayerName(b.id)}</TableCell><TableCell className="text-right font-bold text-xs">{b.oversDisplay}</TableCell><TableCell className="text-right font-black">{b.runs}</TableCell><TableCell className="text-right font-black text-primary">{b.wickets}</TableCell><TableCell className="text-right text-[10px] font-bold text-slate-400">{b.economy}</TableCell></TableRow>))}</TableBody>
                    </Table>
                  </Card>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-8">
            <Card className="p-6 border-none shadow-xl rounded-3xl bg-white space-y-6">
              <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Manhattan Graph</h3><div className="flex gap-4"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-primary rounded-sm" /><span className="text-[8px] font-black uppercase">INN 1</span></div><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-secondary rounded-sm" /><span className="text-[8px] font-black uppercase">INN 2</span></div></div></div>
              <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={analysisData.manhattan}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="over" label={{ value: 'Overs', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 900 }} /><YAxis label={{ value: 'Runs', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 900 }} /><Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} /><Bar dataKey="inn1" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} /><Bar dataKey="inn2" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} barSize={20} /></BarChart></ResponsiveContainer></div>
            </Card>
            <Card className="p-6 border-none shadow-xl rounded-3xl bg-white space-y-6">
              <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2"><LineChart className="w-4 h-4" /> Match Momentum (Worm)</h3>
              <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis type="number" dataKey="over" domain={[0, match?.totalOvers || 0]} fontSize={10} hide /><YAxis fontSize={10} label={{ value: 'Runs', angle: -90, position: 'insideLeft', fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} /><Line type="monotone" data={analysisData.worm1} dataKey="inn1" stroke="hsl(var(--primary))" strokeWidth={4} dot={false} connectNulls /><Line type="monotone" data={analysisData.worm2} dataKey="inn2" stroke="hsl(var(--secondary))" strokeWidth={4} dot={false} connectNulls /><Scatter data={analysisData.worm1.filter(p => p.isWicket)} x="over" y="runs" fill="#ef4444" line={false}><LabelList dataKey="runs" content={({ x, y }) => (<g transform={`translate(${x},${y})`}><circle r="8" fill="#ef4444" /><text x="0" y="3" textAnchor="middle" fill="white" fontSize="8" fontWeight="900">W</text></g>)} /></Scatter><Scatter data={analysisData.worm2.filter(p => p.isWicket)} x="over" y="runs" fill="#ef4444" line={false}><LabelList dataKey="runs" content={({ x, y }) => (<g transform={`translate(${x},${y})`}><circle r="8" fill="#ef4444" /><text x="0" y="3" textAnchor="middle" fill="white" fontSize="8" fontWeight="900">W</text></g>)} /></Scatter></ComposedChart></ResponsiveContainer></div>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Tabs defaultValue="inn1" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-10 bg-slate-50 p-1 rounded-lg border border-dashed mb-6"><TabsTrigger value="inn1" className="text-[10px] font-black uppercase">1st Innings Audit</TabsTrigger><TabsTrigger value="inn2" className="text-[10px] font-black uppercase">2nd Innings Audit</TabsTrigger></TabsList>
              {[ {val: 'inn1', data: inn1Deliveries}, {val: 'inn2', data: inn2Deliveries} ].map((innTab) => (
                <TabsContent key={innTab.val} value={innTab.val} className="space-y-4">
                  {(innTab.data || []).length > 0 ? (() => {
                    let legalCount = 0;
                    return [...innTab.data].sort((a,b) => a.timestamp - b.timestamp).map((b, idx) => {
                      const isRetirement = b.dismissalType === 'retired';
                      if (b.extraType === 'none' && !isRetirement) legalCount++;
                      const overNotation = `${Math.floor((legalCount-1)/6)}.${((legalCount-1)%6) + 1}`;
                      const isLegal = b.extraType === 'none' && !isRetirement;
                      return (<Card key={b.id} className="p-4 border-none shadow-lg rounded-2xl bg-white flex items-center justify-between group transition-all"><div className="flex items-center gap-4"><div className="flex flex-col items-center shrink-0"><span className="text-[8px] font-black text-slate-400 mb-1">{isLegal ? `BALL ${overNotation}` : 'EVENT'}</span><div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border-2", b.isWicket ? (isRetirement ? "bg-amber-50 border-amber-600 text-white" : "bg-red-500 border-red-600 text-white") : "bg-slate-50 border-slate-100 text-slate-900")}>{b.isWicket ? (isRetirement ? 'R' : 'W') : b.extraType !== 'none' ? b.extraType[0].toUpperCase() : b.runsScored}</div></div><div className="min-w-0"><p className="text-[11px] font-black uppercase text-slate-900 truncate">{getPlayerName(b.strikerPlayerId)} <span className="text-slate-300 mx-1">vs</span> {getPlayerName(b.bowlerId)}</p><p className={cn("text-[9px] font-bold uppercase mt-0.5 flex items-center gap-2", b.isWicket ? (isRetirement ? "text-amber-600" : "text-red-500") : "text-slate-400")}>{b.isWicket ? (b.dismissalType?.toUpperCase()) : (b.extraType === 'none' ? 'Legal Delivery' : b.extraType.toUpperCase())}<span className="text-slate-200">|</span><Clock className="w-3 h-3" /> {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div>{isUmpire && (<div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditingBall(b); setIsEditBallOpen(true); }} className="h-9 w-9 text-slate-300 hover:text-primary"><Edit2 className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteBall(b.id, b.__fullPath)} className="h-9 w-9 text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></div>)}</Card>);
                    }).reverse();
                  })() : <div className="py-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50 flex flex-col items-center"><History className="w-10 h-10 text-slate-200 mb-2" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No deliveries recorded</p></div>}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="info" className="space-y-8">
            <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
              <div className="bg-slate-900 text-white p-6 flex items-center justify-between"><div className="flex items-center gap-3"><Info className="w-6 h-6 text-primary" /><h2 className="text-xl font-black uppercase tracking-tight">Match Intelligence</h2></div>{isUmpire && <Button variant="secondary" size="sm" onClick={() => setIsEditMatchOpen(true)} className="h-7 text-[8px] font-black uppercase px-3 rounded-lg"><Edit2 className="w-3 h-3 mr-1" /> Edit</Button>}</div>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 rounded-2xl text-primary shadow-inner"><Calendar className="w-5 h-5"/></div><div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date & Time</p><p className="font-black uppercase">{match?.matchDate ? new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}</p></div></div>
                    <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 rounded-2xl text-primary shadow-inner"><MapPin className="w-5 h-5"/></div><div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Venue</p><p className="font-black uppercase truncate max-w-[180px]">{match?.venue || 'Gully Stadium'}</p></div></div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 rounded-2xl text-amber-500 shadow-inner"><Trophy className="w-5 h-5"/></div><div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">POTM</p><p className="font-black uppercase text-amber-600">{match?.potmPlayerId ? getPlayerName(match.potmPlayerId) : 'Pending'}</p></div></div>
                    <div className="flex items-center gap-4"><div className="p-3 bg-slate-50 rounded-2xl text-secondary shadow-inner"><ShieldCheck className="w-5 h-5"/></div><div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ref</p><p className="font-black uppercase">Official Umpire</p></div></div>
                  </div>
                </div>

                <div className="pt-8 border-t space-y-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <Button variant="outline" className="flex-1 h-14 font-black uppercase border-2 border-primary text-primary hover:bg-primary/5 shadow-lg rounded-2xl" onClick={downloadMatchCard}><ImageIcon className="w-5 h-5 mr-2" /> Download Pro Card</Button>
                    <Button variant="default" className="flex-1 h-14 font-black uppercase bg-slate-900 text-white shadow-xl rounded-2xl" onClick={downloadScorecard}><Download className="w-5 h-5 mr-2" /> Download Detailed Scorecard</Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black uppercase text-sm tracking-tight flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> AI Performance Summary</h3>
                      <Button 
                        onClick={handleGenerateAISummary} 
                        disabled={isAiLoading || !match || match.status !== 'completed'} 
                        variant="secondary" 
                        size="sm" 
                        className="h-8 text-[8px] font-black uppercase"
                      >
                        {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                        Generate Pro AI Intel
                      </Button>
                    </div>
                    {aiSummary ? (
                      <Card className="bg-slate-50 border-2 border-dashed p-6 rounded-2xl">
                        <p className="text-xs font-medium leading-relaxed text-slate-700 italic">"{aiSummary}"</p>
                        <div className="mt-4 pt-4 border-t border-slate-200 text-right">
                          <p className="text-[8px] font-black uppercase text-slate-400">Generated by Genkit AI Analysis</p>
                        </div>
                      </Card>
                    ) : (
                      <div className="py-12 border-2 border-dashed rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center text-center">
                        <FileText className="w-8 h-8 text-slate-200 mb-2" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Summary becomes available after match finalization</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* HIDDEN EXPORT TEMPLATE: DETAILED SCORECARD (Ultra Compact Single Page) */}
      <div className="fixed -left-[5000px] top-0">
        <div ref={printRef} className="w-[800px] bg-white p-4 flex flex-col font-body text-slate-900">
          <div className="text-center mb-1 border-b-2 border-slate-900 pb-1">
            <h1 className="text-lg font-black uppercase tracking-tighter text-blue-800 leading-none">Official Match Record</h1>
            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
              {match?.matchNumber} | {match?.matchDate ? new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} | {match?.venue?.toUpperCase() || 'STADIUM'} | {match?.totalOvers} OV
            </p>
          </div>
          <div className="bg-amber-500 text-white p-0.5 text-center text-[7px] font-black uppercase tracking-widest mb-2">Award : POTM - {match?.potmPlayerId ? getPlayerName(match.potmPlayerId) : 'Decision Pending'}</div>
          
          <div className="grid grid-cols-3 items-center gap-2 mb-2 px-10">
            <div className="text-center"><p className="text-[6px] font-black text-slate-400 uppercase">{getTeamName(match?.team1Id || '')}</p><p className="text-xl font-black">{stats1.total}/{stats1.wickets}</p><p className="text-[6px] font-bold text-slate-400">{stats1.overs} OV</p></div>
            <div className="text-center text-slate-300 font-black text-xs italic">VS</div>
            <div className="text-center"><p className="text-[6px] font-black text-slate-400 uppercase">{getTeamName(match?.team2Id || '')}</p><p className="text-xl font-black">{stats2.total}/{stats2.wickets}</p><p className="text-[6px] font-bold text-slate-400">{stats2.overs} OV</p></div>
          </div>
          
          <div className="text-center mb-2"><p className="text-[9px] font-black uppercase text-blue-800 border-y py-0.5">{match?.resultDescription || 'MATCH IN PROGRESS'}</p></div>
          
          <div className="space-y-3">
            {[ {label: '1ST INN', tid: match?.team1Id, stats: stats1}, {label: '2ND INN', tid: match?.team2Id, stats: stats2} ].map((inn, i) => (
              <div key={i} className="border border-slate-100 rounded-lg p-1.5 bg-slate-50/20">
                <div className="bg-blue-800 text-white px-2 py-0.5 flex justify-between items-center mb-1 rounded-sm"><span className="font-black text-[8px]">{inn.label}: {getTeamName(inn.tid || '')}</span><span className="font-black text-[8px]">{inn.stats.total}/{inn.stats.wickets} ({inn.stats.overs})</span></div>
                <Table className="mb-1"><TableHeader className="bg-slate-50"><TableRow className="h-4"><TableHead className="text-[7px] font-black uppercase py-0">Batter</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">R</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">B</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">4s</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">6s</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">SR</TableHead></TableRow></TableHeader>
                  <TableBody>{inn.stats.batting.map((b: any) => (<TableRow key={b.id} className="h-4 border-b last:border-0"><TableCell className="py-0.5"><p className="font-black text-[8px] uppercase leading-none">{getPlayerName(b.id)}</p><p className="text-[6px] font-bold text-slate-400 uppercase italic">{(b.dismissal || 'not out').replace('Fielder', getPlayerName(b.fielderId))}</p></TableCell><TableCell className="text-right font-black text-[8px] py-0.5">{b.runs}</TableCell><TableCell className="text-right font-bold text-slate-500 text-[8px] py-0.5">{b.balls}</TableCell><TableCell className="text-right text-[8px] py-0.5">{b.fours}</TableCell><TableCell className="text-right text-[8px] py-0.5">{b.sixes}</TableCell><TableCell className="text-right text-[8px] text-slate-400 py-0.5">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell></TableRow>))}</TableBody>
                </Table>
                <div className="flex justify-between items-center mb-1 px-1 border-b pb-0.5 text-[6px] font-black uppercase text-slate-500"><span>Extras : {inn.stats.extras.total} (w {inn.stats.extras.w}, nb {inn.stats.extras.nb})</span><span>DNB: {inn.stats.didNotBat.map((id: string) => getPlayerName(id).split(' ')[0]).join(', ')}</span></div>
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <div className="bg-white p-1 rounded border border-slate-50"><p className="text-[6px] font-black uppercase text-slate-400 mb-0.5 border-b pb-0.5">Fall of Wickets</p><div className="space-y-0.5">{inn.stats.fow.map((f: any, idx: number) => (<p key={idx} className="text-[6px] font-bold text-slate-600 uppercase">{idx+1}-{f.scoreAtWicket} ({getPlayerName(f.playerOutId).split(' ')[0]}, {f.over} ov)</p>))}</div></div>
                  <div className="bg-white p-1 rounded border border-slate-50"><p className="text-[6px] font-black uppercase text-slate-400 mb-0.5 border-b pb-0.5">Key Partnerships</p><div className="space-y-0.5">{inn.stats.partnerships.slice(0, 3).map((p: any, idx: number) => (<p key={idx} className="text-[6px] font-black text-slate-800 leading-none truncate">{p.batters.map((id: string) => getPlayerName(id).split(' ')[0]).join('-')}: {p.runs} ({p.balls})</p>))}</div></div>
                </div>
                <Table><TableHeader><TableRow className="h-3 border-b"><TableHead className="text-[7px] font-black uppercase py-0">Bowler</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">O</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">R</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">W</TableHead><TableHead className="text-right text-[7px] font-black uppercase py-0">ECO</TableHead></TableRow></TableHeader>
                  <TableBody>{inn.stats.bowling.map((b: any) => (<TableRow key={b.id} className="h-4 border-b last:border-0"><TableCell className="font-black text-[7px] uppercase py-0.5">{getPlayerName(b.id)}</TableCell><TableCell className="text-right font-bold text-[7px] py-0.5">{b.oversDisplay}</TableCell><TableCell className="text-right font-black text-[7px] py-0.5">{b.runs}</TableCell><TableCell className="text-right font-black text-[7px] py-0.5">{b.wickets}</TableCell><TableCell className="text-right text-[7px] text-slate-400 py-0.5">{b.economy}</TableCell></TableRow>))}</TableBody>
                </Table>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-1 border-t border-slate-200 text-center"><p className="text-[6px] font-black text-slate-300 uppercase tracking-[0.4em]">Powered by CricMates League Engine</p></div>
        </div>
      </div>

      {/* HIDDEN EXPORT TEMPLATE: PRO MATCH CARD (Vertical Premium) */}
      <div className="fixed -left-[5000px] top-0">
        <div ref={cardRef} className="w-[600px] bg-slate-50 p-12 flex flex-col items-center font-body text-slate-900 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Swords className="w-64 h-64" /></div>
          <div className="flex flex-col items-center gap-2 mb-10 relative z-10"><div className="bg-primary p-4 rounded-2xl shadow-xl text-white mb-4"><Trophy className="w-10 h-10" /></div><p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Official League Record</p><h1 className="text-4xl font-black uppercase tracking-tight">{match?.matchNumber || 'Match Record'}</h1><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{match?.venue?.toUpperCase() || 'STADIUM'} • {match?.matchDate ? new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p></div>
          <div className="grid grid-cols-3 items-center gap-4 w-full mb-12 relative z-10">
            <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center border-4 border-white"><p className="text-[9px] font-black text-slate-400 uppercase mb-4">{getTeamName(match?.team1Id || '')}</p><p className="text-5xl font-black text-slate-900 leading-none">{stats1.total}/{stats1.wickets}</p><p className="text-[11px] font-black text-primary mt-4 uppercase">({stats1.overs} Overs)</p></div>
            <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xl">VS</div></div>
            <div className="bg-white p-8 rounded-[32px] shadow-2xl text-center border-4 border-white"><p className="text-[9px] font-black text-slate-400 uppercase mb-4">{getTeamName(match?.team2Id || '')}</p><p className="text-5xl font-black text-slate-900 leading-none">{stats2.total}/{stats2.wickets}</p><p className="text-[11px] font-black text-primary mt-4 uppercase">({stats2.overs} Overs)</p></div>
          </div>
          <div className="w-full bg-primary text-white p-6 rounded-[24px] shadow-2xl text-center mb-12 relative z-10 overflow-hidden"><div className="absolute inset-0 bg-white/5 animate-pulse" /><p className="text-lg font-black uppercase tracking-widest relative z-10">{match?.resultDescription?.toUpperCase() || 'MATCH IN PROGRESS'}</p></div>
          <div className="grid grid-cols-2 gap-12 w-full mb-12 relative z-10 px-4">
            <div className="space-y-6"><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 flex items-center gap-2"><Zap className="w-4 h-4" /> Top Batters</h3><div className="space-y-4">{[...stats1.batting, ...stats2.batting].sort((a,b) => b.runs - a.runs).slice(0, 3).map((b, idx) => (<div key={idx} className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-[11px] font-black uppercase text-slate-900">{getPlayerName(b.id)}</span><span className="text-sm font-black text-slate-900">{b.runs} <span className="text-[10px] text-slate-400">({b.balls})</span></span></div>))}</div></div>
            <div className="space-y-6"><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 flex items-center gap-2"><CircleDot className="w-4 h-4" /> Top Bowlers</h3><div className="space-y-4">{[...stats1.bowling, ...stats2.bowling].sort((a,b) => b.wickets - a.wickets || a.economy - b.economy).slice(0, 3).map((b, idx) => (<div key={idx} className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-[11px] font-black uppercase text-slate-900">{getPlayerName(b.id)}</span><span className="text-sm font-black text-slate-900">{b.wickets}/{b.runs} <span className="text-[10px] text-slate-400">({b.oversDisplay})</span></span></div>))}</div></div>
          </div>
          {match?.potmPlayerId && (<div className="w-full bg-amber-50 border-4 border-amber-200 p-6 rounded-[24px] shadow-lg flex items-center justify-between mb-12 relative z-10"><div className="flex items-center gap-4"><div className="bg-amber-500 p-3 rounded-xl shadow-inner text-white"><Star className="w-6 h-6" /></div><div><p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1">Player of the Match</p><p className="text-xl font-black uppercase text-slate-900">{getPlayerName(match.potmPlayerId)}</p></div></div><div className="text-right"><p className="text-3xl font-black text-amber-600 leading-none">{matchPerformanceMap[match.potmPlayerId] ? calculatePlayerCVP(matchPerformanceMap[match.potmPlayerId]).toFixed(1) : '---'}</p><p className="text-[8px] font-black text-amber-400 uppercase mt-1">Impact Pts</p></div></div>)}
          <div className="mt-auto pt-8 border-t border-slate-200 w-full text-center"><p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Generated by CricMates Pro League Interface</p></div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isEditMatchOpen} onOpenChange={setIsEditMatchOpen}><DialogContent className="max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl z-[200]"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl">Edit Match Intelligence</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Match Label</Label><Input value={matchEditForm.matchNumber} onChange={(e) => setMatchEditForm({...matchEditForm, matchNumber: e.target.value})} className="h-12 font-bold" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Venue</Label><Input value={matchEditForm.venue} onChange={(e) => setMatchEditForm({...matchEditForm, venue: e.target.value})} className="h-12 font-bold" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Official Date</Label><Input type="datetime-local" value={matchEditForm.matchDate} onChange={(e) => setMatchEditForm({...matchEditForm, matchDate: e.target.value})} className="h-12 font-bold" /></div></div><DialogFooter><Button onClick={handleUpdateMatchInfo} className="w-full h-14 bg-primary font-black uppercase shadow-xl">Apply Intelligence Update</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isNoBallOpen} onOpenChange={setIsNoBallOpen}><DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl border-t-8 border-t-orange-600 shadow-2xl z-[200]"><DialogHeader><DialogTitle className="font-black uppercase text-orange-600 flex items-center gap-2"><Zap className="w-5 h-5" /> No Ball Results</DialogTitle></DialogHeader><div className="grid grid-cols-4 gap-2 py-6">{[0, 1, 2, 3, 4, 5, 6].map(r => (<Button key={`nb-${r}`} onClick={() => handleRecordBall(r, 'noball')} className="h-16 font-black text-xl bg-orange-50 text-orange-600 border-2 border-orange-100 hover:bg-orange-600 hover:text-white">{r === 0 ? '•' : r}</Button>))}</div><p className="text-[10px] text-center font-black uppercase text-slate-400">Select runs scored on the No Ball</p></DialogContent></Dialog>
      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}><DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-destructive shadow-2xl z-[200]"><DialogHeader><DialogTitle className="font-black uppercase text-xl text-destructive">Wicket / Event</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Type</Label><Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent className="z-[250]"><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumped">Stumped</SelectItem><SelectItem value="lbw">LBW</SelectItem><SelectItem value="retired">Retired (Hurt)</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label><Select value={wicketForm.batterOutId} onValueChange={(v) => setWicketForm({...wicketForm, batterOutId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent className="z-[250]">{activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>Striker: {getPlayerName(activeInningData.strikerPlayerId)}</SelectItem>}{activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>Non-Striker: {getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>}</SelectContent></Select></div></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Fielder</Label><Select value={wicketForm.fielderId} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Select Fielder" /></SelectTrigger><SelectContent className="z-[250]"><SelectItem value="none">N/A</SelectItem>{opponentPlayerIds?.map(pId => (<SelectItem key={pId} value={pId}>{getPlayerName(pId)}</SelectItem>))}</SelectContent></Select></div><div className="space-y-2 pt-4 border-t"><Label className="text-[10px] font-black uppercase text-slate-400">Next Batter</Label><Select value={wicketForm.successorId} onValueChange={(v) => setWicketForm({...wicketForm, successorId: v})}><SelectTrigger className="h-14 font-black text-lg border-primary/20"><SelectValue placeholder="Pick next batter" /></SelectTrigger><SelectContent className="z-[250]"><SelectItem value="none">Solo / End</SelectItem>{allPlayers?.filter(p => currentBattingSquadIds?.includes(p.id) && p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.nonStrikerPlayerId).map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div></div><DialogFooter><Button onClick={handleRecordWicket} disabled={!wicketForm.batterOutId} className="w-full h-14 bg-destructive font-black uppercase shadow-xl">Confirm Entry</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}><DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl z-[200]"><DialogHeader><DialogTitle className="font-black uppercase text-xl">Official Assignment</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Striker</Label><Select value={assignmentForm.strikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Striker" /></SelectTrigger><SelectContent className="z-[250]">{allPlayers?.filter(p => currentBattingSquadIds?.includes(p.id)).map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Non-Striker</Label><Select value={assignmentForm.nonStrikerId || 'none'} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v === 'none' ? '' : v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Non-Striker" /></SelectTrigger><SelectContent className="z-[250]"><SelectItem value="none">Solo Mode</SelectItem>{allPlayers?.filter(p => currentBattingSquadIds?.includes(p.id) && p.id !== assignmentForm.strikerId).map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div></div><div className="space-y-3 pt-4 border-t"><Label className="text-[10px] font-black uppercase text-slate-400">Current Bowler</Label><Select value={assignmentForm.bowlerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}><SelectTrigger className="h-14 font-black text-lg"><SelectValue placeholder="Assign Bowler" /></SelectTrigger><SelectContent className="z-[250]">{allPlayers?.filter(p => opponentPlayerIds?.includes(p.id)).map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div></div><DialogFooter><Button onClick={async () => { await updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { strikerPlayerId: assignmentForm.strikerId, nonStrikerPlayerId: assignmentForm.nonStrikerId || '', currentBowlerPlayerId: assignmentForm.bowlerId }); setIsPlayerAssignmentOpen(false); toast({ title: "Ends Assigned" }); }} className="w-full h-14 bg-primary font-black uppercase shadow-xl">Apply Setup</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isPotmDialogOpen} onOpenChange={setIsPotmDialogOpen}><DialogContent className="max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[200]"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-amber-600 flex items-center gap-2"><Star className="w-5 h-5" /> Declare Player of the Match</DialogTitle></DialogHeader><div className="space-y-4 py-6"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Select Recipient</Label><Select value={potmId} onValueChange={setPotmId}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Pick a player" /></SelectTrigger><SelectContent className="z-[250]">{Object.values(matchPerformanceMap).map((p: any) => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name} ({calculatePlayerCVP(p).toFixed(1)} Pts)</SelectItem>))}</SelectContent></Select></div></div><DialogFooter><Button onClick={async () => { if(potmId) { await updateDocumentNonBlocking(doc(db, 'matches', matchId), { potmPlayerId: potmId, potmCvpScore: calculatePlayerCVP(matchPerformanceMap[potmId]) }); setIsPotmDialogOpen(false); toast({ title: "POTM Awarded" }); } }} className="w-full h-14 bg-amber-500 font-black uppercase shadow-xl">Confirm Award</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
