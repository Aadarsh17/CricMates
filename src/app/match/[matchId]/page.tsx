
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserCircle, Info, Users, Flag, ChevronDown, Star, CheckCircle2, Trophy, Clock, Calendar, Undo2, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);

  const [activeInningView, setActiveInningView] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>('live');

  useEffect(() => {
    if (match?.currentInningNumber) {
      setActiveInningView(match.currentInningNumber);
    }
  }, [match?.currentInningNumber]);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_1'), [db, matchId]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_2'), [db, matchId]);
  const { data: inn2 } = useDoc(inn2Ref);

  const activeInningData = activeInningView === 1 ? inn1 : inn2;
  const activeInningRef = activeInningView === 1 ? inn1Ref : inn2Ref;

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

  const deliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none') return '---';
    const p = allPlayers?.find(p => p.id === pid);
    return p ? p.name : 'Unknown Player';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    const t = allTeams?.find(t => t.id === tid);
    return t ? t.name : 'Unknown Team';
  };

  const getAbbr = (name: string) => (name || 'UNK').substring(0, 3).toUpperCase();

  const dismissedPlayerIds = useMemo(() => {
    return Array.from(new Set(deliveries?.filter(d => d.isWicket && d.batsmanOutPlayerId && d.batsmanOutPlayerId !== 'none').map(d => d.batsmanOutPlayerId) || []));
  }, [deliveries]);

  const potm = useMemo(() => {
    if (!match || !allPlayers) return null;
    const participantIds = [...match.team1SquadPlayerIds, ...match.team2SquadPlayerIds];
    const participants = allPlayers.filter(p => participantIds.includes(p.id));
    if (participants.length === 0) return null;
    return participants.reduce((prev, current) => ((prev.careerCVP || 0) > (current.careerCVP || 0)) ? prev : current);
  }, [match, allPlayers]);

  const scorecard = useMemo(() => {
    if (!deliveries) return { batting: [], bowling: [], fow: [], partnerships: [], extras: { wide: 0, noball: 0, byes: 0, legbyes: 0, total: 0 } };

    const battingMap: Record<string, any> = {};
    const bowlingMap: Record<string, any> = {};
    const extras = { wide: 0, noball: 0, byes: 0, legbyes: 0, total: 0 };
    const fow: any[] = [];
    const partnerships: any[] = [];

    let runningScore = 0;
    let runningWickets = 0;
    
    let p1 = { id: '', runs: 0, balls: 0 };
    let p2 = { id: '', runs: 0, balls: 0 };
    let partTotalRuns = 0;
    let partTotalBalls = 0;

    deliveries.forEach((d: any) => {
      runningScore += d.totalRunsOnDelivery;

      if (d.extraType !== 'none') {
        const type = d.extraType as keyof typeof extras;
        if (extras[type] !== undefined) {
          extras[type] += d.extraRuns;
          extras.total += d.extraRuns;
        }
      }

      if (!p1.id && d.strikerPlayerId !== 'none') p1.id = d.strikerPlayerId;
      if (d.strikerPlayerId !== p1.id && !p2.id && d.strikerPlayerId !== 'none') p2.id = d.strikerPlayerId;

      partTotalRuns += d.totalRunsOnDelivery;
      if (d.extraType === 'none') partTotalBalls += 1;

      if (d.strikerPlayerId && d.strikerPlayerId !== 'none') {
        if (!battingMap[d.strikerPlayerId]) {
          battingMap[d.strikerPlayerId] = { id: d.strikerPlayerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: 'not out' };
        }
        battingMap[d.strikerPlayerId].runs += d.runsScored;
        
        if (d.strikerPlayerId === p1.id) {
          p1.runs += d.runsScored;
          if (d.extraType === 'none') p1.balls += 1;
        } else if (d.strikerPlayerId === p2.id) {
          p2.runs += d.runsScored;
          if (d.extraType === 'none') p2.balls += 1;
        }

        if (d.extraType !== 'wide') {
          battingMap[d.strikerPlayerId].balls += 1;
        }
        if (d.runsScored === 4) battingMap[d.strikerPlayerId].fours += 1;
        if (d.runsScored === 6) battingMap[d.strikerPlayerId].sixes += 1;
        
        if (d.isWicket && d.batsmanOutPlayerId === d.strikerPlayerId) {
          battingMap[d.strikerPlayerId].out = true;
          battingMap[d.strikerPlayerId].dismissal = d.outcomeDescription;
        }
      }

      if (d.isWicket && d.batsmanOutPlayerId && d.batsmanOutPlayerId !== d.strikerPlayerId && d.batsmanOutPlayerId !== 'none') {
         if (!battingMap[d.batsmanOutPlayerId]) {
           battingMap[d.batsmanOutPlayerId] = { id: d.batsmanOutPlayerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: true, dismissal: d.outcomeDescription };
         } else {
           battingMap[d.batsmanOutPlayerId].out = true;
           battingMap[d.batsmanOutPlayerId].dismissal = d.outcomeDescription;
         }
      }

      if (d.bowlerPlayerId && d.bowlerPlayerId !== 'none') {
        if (!bowlingMap[d.bowlerPlayerId]) {
          bowlingMap[d.bowlerPlayerId] = { id: d.bowlerPlayerId, legalBalls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noballs: 0 };
        }
        if (d.extraType === 'none') {
          bowlingMap[d.bowlerPlayerId].legalBalls += 1;
        }
        if (d.extraType === 'wide') {
          bowlingMap[d.bowlerPlayerId].wides += d.extraRuns;
          bowlingMap[d.bowlerPlayerId].runs += d.extraRuns;
        } else if (d.extraType === 'noball') {
          bowlingMap[d.bowlerPlayerId].noballs += 1;
          bowlingMap[d.bowlerPlayerId].runs += (d.runsScored + 1);
        } else {
          bowlingMap[d.bowlerPlayerId].runs += d.runsScored;
        }
        if (d.isWicket && !['runout', 'hit wicket'].includes(d.dismissalType)) {
          bowlingMap[d.bowlerPlayerId].wickets += 1;
        }
      }

      if (d.isWicket) {
        runningWickets++;
        fow.push({
          wicket: runningWickets,
          score: runningScore,
          batterId: d.batsmanOutPlayerId,
          over: `${d.overNumber}.${d.ballNumberInOver}`
        });

        partnerships.push({
          p1: { ...p1 },
          p2: { ...p2 },
          totalRuns: partTotalRuns,
          totalBalls: partTotalBalls,
          wicket: runningWickets
        });

        const survivorId = d.batsmanOutPlayerId === p1.id ? p2.id : p1.id;
        p1 = { id: survivorId, runs: 0, balls: 0 };
        p2 = { id: '', runs: 0, balls: 0 };
        partTotalRuns = 0;
        partTotalBalls = 0;
      }
    });

    return {
      batting: Object.values(battingMap),
      bowling: Object.values(bowlingMap),
      fow,
      partnerships,
      extras
    };
  }, [deliveries]);

  const generateOversSummary = (deliveries: any[], battingTeamId: string) => {
    if (!deliveries) return [];
    const groups: Record<number, any> = {};
    let runningScore = 0;
    let runningWickets = 0;

    deliveries.forEach((d) => {
      const ov = d.overNumber + 1;
      if (!groups[ov]) {
        groups[ov] = {
          overNumber: ov,
          runs: 0,
          balls: [],
          bowlerId: d.bowlerPlayerId,
          batterIds: new Set<string>(),
          scoreAtEnd: '',
          battingTeamId: battingTeamId
        };
      }
      groups[ov].runs += d.totalRunsOnDelivery;
      groups[ov].balls.push(d);
      groups[ov].batterIds.add(d.strikerPlayerId);
      
      runningScore += d.totalRunsOnDelivery;
      if (d.isWicket) runningWickets += 1;
      groups[ov].scoreAtEnd = `${runningScore}-${runningWickets}`;
    });

    return Object.values(groups).reverse();
  };

  const inn1Overs = useMemo(() => generateOversSummary(inn1Deliveries || [], inn1?.battingTeamId || ''), [inn1Deliveries, inn1]);
  const inn2Overs = useMemo(() => generateOversSummary(inn2Deliveries || [], inn2?.battingTeamId || ''), [inn2Deliveries, inn2]);

  const [isWicketModalOpen, setIsWicketModalOpen] = useState(false);
  const [isBowlerModalOpen, setIsBowlerModalOpen] = useState(false);
  const [isNoBallModalOpen, setIsNoBallModalOpen] = useState(false);
  const [isOpeningPairSetupOpen, setIsOpeningPairSetupOpen] = useState(false);
  
  const [wicketDetails, setWicketDetails] = useState({
    type: 'bowled',
    newStrikerId: '',
    fielderId: 'none'
  });
  const [selectedNextBowlerId, setSelectedNextBowlerId] = useState('');
  const [setupPair, setSetupPair] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });

  const isCurrentInningsOver = !!(activeInningData && match && (
    activeInningData.wickets >= 10 || 
    (activeInningData.oversCompleted >= match.totalOvers) ||
    (activeInningView === 2 && inn1 && activeInningData.score > inn1.score)
  ));

  const handleAssignNextBatter = (playerId: string) => {
    if (!activeInningRef || !playerId) return;
    if (playerId === 'none') {
      updateDocumentNonBlocking(activeInningRef, { wickets: 10 });
      return;
    }
    const updateData: any = { strikerPlayerId: playerId };
    if (playerId === activeInningData?.nonStrikerPlayerId) updateData.nonStrikerPlayerId = '';
    updateDocumentNonBlocking(activeInningRef, updateData);
  };

  const handleBall = (runs: number, isWicket = false, extra: 'none' | 'wide' | 'noball' = 'none') => {
    if (!isUmpire || match?.status !== 'live' || !activeInningData || !activeInningRef || isCurrentInningsOver) return;

    if (!activeInningData.currentBowlerPlayerId) {
      setIsBowlerModalOpen(true);
      return;
    }

    let runsForThisBall = runs;
    if (extra !== 'none') runsForThisBall += 1;

    let newStriker = activeInningData.strikerPlayerId;
    let newNonStriker = activeInningData.nonStrikerPlayerId;

    if (runs % 2 !== 0 && newStriker && newNonStriker) {
      [newStriker, newNonStriker] = [newNonStriker, newStriker];
    }

    let isOverEnd = false;
    let newOvers = activeInningData.oversCompleted;
    let newBalls = activeInningData.ballsInCurrentOver;

    if (extra === 'none') {
      newBalls += 1;
      if (newBalls >= 6) {
        isOverEnd = true;
        newOvers += 1;
        newBalls = 0;
        if (newStriker && newNonStriker) [newStriker, newNonStriker] = [newNonStriker, newStriker];
      }
    }

    let dismissalDesc = 'out';
    if (isWicket) {
      const bowler = getPlayerName(activeInningData.currentBowlerPlayerId);
      const fielder = getPlayerName(wicketDetails.fielderId);
      switch(wicketDetails.type) {
        case 'bowled': dismissalDesc = `b ${bowler}`; break;
        case 'caught': dismissalDesc = `c ${fielder} b ${bowler}`; break;
        case 'lbw': dismissalDesc = `lbw b ${bowler}`; break;
        case 'runout': dismissalDesc = `run out (${fielder})`; break;
        case 'stumping': dismissalDesc = `st ${fielder} b ${bowler}`; break;
        case 'hit wicket': dismissalDesc = `hit wicket b ${bowler}`; break;
        default: dismissalDesc = 'out';
      }
    }

    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords')).id;
    const deliveryData = {
      id: deliveryId,
      inningId: `inning_${activeInningView}`,
      matchId,
      overNumber: activeInningData.oversCompleted,
      ballNumberInOver: extra === 'none' ? (newBalls === 0 ? 6 : newBalls) : activeInningData.ballsInCurrentOver,
      strikerPlayerId: activeInningData.strikerPlayerId,
      bowlerPlayerId: activeInningData.currentBowlerPlayerId,
      runsScored: runs,
      isWicket,
      extraType: extra,
      extraRuns: extra !== 'none' ? 1 : 0,
      totalRunsOnDelivery: runsForThisBall,
      outcomeDescription: isWicket ? dismissalDesc : `${runsForThisBall}${extra !== 'none' ? ` (${extra})` : ''}`,
      dismissalType: isWicket ? wicketDetails.type : 'none',
      fielderPlayerId: isWicket ? wicketDetails.fielderId : 'none',
      batsmanOutPlayerId: isWicket ? activeInningData.strikerPlayerId : 'none',
      timestamp: new Date().toISOString(),
      umpireId: user?.uid || 'anonymous',
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    let finalStriker = isWicket ? (wicketDetails.newStrikerId === 'none' ? '' : wicketDetails.newStrikerId) : newStriker;
    let finalNonStriker = newNonStriker;
    
    if (isWicket) {
      if (wicketDetails.newStrikerId === activeInningData.nonStrikerPlayerId) finalNonStriker = '';
    }

    updateDocumentNonBlocking(activeInningRef, {
      score: activeInningData.score + runsForThisBall,
      wickets: isWicket ? activeInningData.wickets + 1 : activeInningData.wickets,
      oversCompleted: newOvers,
      ballsInCurrentOver: newBalls,
      strikerPlayerId: finalStriker || '',
      nonStrikerPlayerId: finalNonStriker || '',
      currentBowlerPlayerId: isOverEnd ? '' : activeInningData.currentBowlerPlayerId
    });

    if (isWicket) {
      setIsWicketModalOpen(false);
      setWicketDetails({ type: 'bowled', newStrikerId: '', fielderId: 'none' });
    }
    if (extra === 'noball') setIsNoBallModalOpen(false);
    if (isOverEnd && !isCurrentInningsOver) setIsBowlerModalOpen(true);
  };

  const handleStartInnings2 = () => {
    if (!match || !inn1 || !isUmpire) return;
    
    const battingTeamId = inn1.bowlingTeamId;
    const bowlingTeamId = inn1.battingTeamId;

    const inningData = {
      id: 'inning_2',
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

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), inningData, { merge: true });
    updateDocumentNonBlocking(matchRef, { currentInningNumber: 2 });
    setActiveInningView(2);
    setIsOpeningPairSetupOpen(true);
  };

  const handleEndMatch = () => {
    if (!match || !inn1 || !isUmpire || !allTeams) return;

    let resultDesc = "Match Drawn";
    let winnerId = "";
    
    const s1 = inn1.score || 0;
    const s2 = inn2?.score || 0;

    if (inn2) {
      if (s2 > s1) {
        winnerId = inn2.battingTeamId;
        resultDesc = `${getTeamName(inn2.battingTeamId)} won by ${10 - inn2.wickets} wickets`;
      } else if (s1 > s2) {
        winnerId = inn1.battingTeamId;
        resultDesc = `${getTeamName(inn1.battingTeamId)} won by ${s1 - s2} runs`;
      }
    }

    const getDecimalOvers = (inn: any) => {
      if (!inn) return 0;
      if (inn.wickets >= 10) return match.totalOvers;
      return (inn.oversCompleted || 0) + ((inn.ballsInCurrentOver || 0) / 6);
    };

    const updateTeamStats = (teamId: string, runsScored: number, runsConceded: number, oversFaced: number, oversBowled: number, isWinner: boolean, isDrawn: boolean) => {
      const team = allTeams.find(t => t.id === teamId);
      if (!team) return;

      const totalRunsScored = (team.totalRunsScored || 0) + runsScored;
      const totalRunsConceded = (team.totalRunsConceded || 0) + runsConceded;
      const totalOversFaced = (team.totalOversFaced || 0) + oversFaced;
      const totalOversBowled = (team.totalOversBowled || 0) + oversBowled;

      let nrrValue = 0;
      if (totalOversFaced > 0 && totalOversBowled > 0) {
        nrrValue = (totalRunsScored / totalOversFaced) - (totalRunsConceded / totalOversBowled);
      }

      updateDocumentNonBlocking(doc(db, 'teams', teamId), {
        matchesWon: (team.matchesWon || 0) + (isWinner ? 1 : 0),
        matchesLost: (team.matchesLost || 0) + (!isWinner && !isDrawn ? 1 : 0),
        matchesDrawn: (team.matchesDrawn || 0) + (isDrawn ? 1 : 0),
        totalRunsScored,
        totalRunsConceded,
        totalOversFaced,
        totalOversBowled,
        netRunRate: Number(nrrValue.toFixed(4))
      });
    };

    const o1 = getDecimalOvers(inn1);
    const o2 = getDecimalOvers(inn2);

    updateTeamStats(inn1.battingTeamId, s1, s2, o1, o2, winnerId === inn1.battingTeamId, !winnerId);
    if (inn2) updateTeamStats(inn2.battingTeamId, s2, s1, o2, o1, winnerId === inn2.battingTeamId, !winnerId);

    updateDocumentNonBlocking(matchRef, { status: 'completed', resultDescription: resultDesc });
    toast({ title: "Match Finalized", description: resultDesc });
    router.push('/matches');
  };

  const handleUndo = () => {
    if (!deliveries || deliveries.length === 0 || !activeInningRef || !activeInningData) return;
    const lastBall = deliveries[deliveries.length - 1];
    updateDocumentNonBlocking(activeInningRef, {
      score: Math.max(0, activeInningData.score - lastBall.totalRunsOnDelivery),
      wickets: lastBall.isWicket ? Math.max(0, activeInningData.wickets - 1) : activeInningData.wickets,
      ballsInCurrentOver: lastBall.extraType === 'none' ? (lastBall.ballNumberInOver === 6 ? 5 : lastBall.ballNumberInOver - 1) : activeInningData.ballsInCurrentOver,
      oversCompleted: lastBall.ballNumberInOver === 6 && lastBall.extraType === 'none' ? activeInningData.oversCompleted - 1 : activeInningData.oversCompleted,
      strikerPlayerId: lastBall.strikerPlayerId,
      currentBowlerPlayerId: lastBall.bowlerPlayerId
    });
    deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords', lastBall.id));
  };

  if (isMatchLoading) return <div className="p-20 text-center">Loading scoreboard...</div>;
  if (!match) return <div className="p-20 text-center">Match data missing.</div>;

  const currentBattingTeamId = activeInningData?.battingTeamId || '';
  const battingSquadIds = currentBattingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds;
  const bowlingSquadIds = currentBattingTeamId === match.team1Id ? match.team2SquadPlayerIds : match.team1SquadPlayerIds;
  const battingPool = allPlayers?.filter(p => battingSquadIds.includes(p.id)) || [];
  const bowlingPool = allPlayers?.filter(p => bowlingSquadIds.includes(p.id)) || [];

  const needsOpeningPair = activeInningData && activeInningData.oversCompleted === 0 && activeInningData.ballsInCurrentOver === 0 && activeInningData.wickets === 0 && (!activeInningData?.strikerPlayerId || !activeInningData?.currentBowlerPlayerId);
  const needsNextBatter = activeInningData && !activeInningData.strikerPlayerId && !isCurrentInningsOver && (activeInningData.oversCompleted > 0 || activeInningData.ballsInCurrentOver > 0 || activeInningData.wickets > 0);

  const BallBubble = ({ ball }: { ball: any }) => {
    let color = 'bg-slate-400';
    let label = ball.runsScored.toString();
    if (ball.isWicket) { color = 'bg-[#e91e63]'; label = 'W'; }
    else if (ball.extraType === 'wide') { color = 'bg-[#fbc02d]'; label = 'Wd'; }
    else if (ball.extraType === 'noball') { color = 'bg-[#fbc02d]'; label = 'NB'; }
    else if (ball.runsScored === 4) { color = 'bg-[#0091ca]'; label = '4'; }
    else if (ball.runsScored === 6) { color = 'bg-[#9c27b0]'; label = '6'; }
    else if (ball.runsScored > 0) { color = 'bg-[#8bc34a]'; label = ball.runsScored.toString(); }
    return <div className={cn("w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-bold text-white shrink-0", color)}>{label}</div>;
  };

  const OverRow = ({ over }: { over: any }) => (
    <div className="bg-white p-3 border rounded-sm flex flex-col md:flex-row gap-3 items-start md:items-center">
      <div className="w-full md:w-32">
        <p className="text-sm font-black text-slate-900">Over {over.overNumber} <span className="text-slate-400 font-bold ml-1">- {over.runs} runs</span></p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{getAbbr(getTeamName(over.battingTeamId))} {over.scoreAtEnd}</p>
      </div>
      <div className="flex-1 space-y-2 w-full">
        <p className="text-[11px] font-bold text-slate-700">{getPlayerName(over.bowlerId)} to {Array.from(over.batterIds).map(id => getPlayerName(id as string)).join(' & ')}</p>
        <div className="flex flex-wrap gap-1.5">{over.balls.map((ball: any) => <BallBubble key={ball.id} ball={ball} />)}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="border-b bg-white p-4 rounded-lg shadow-sm text-center">
        <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full justify-start overflow-x-auto border-b rounded-none bg-transparent h-auto p-0 scrollbar-hide sticky top-16 z-40 bg-background/95 backdrop-blur">
          {['Info', 'Live', 'Scorecard', 'Squads', 'Points Table', 'Overs'].map((tab) => (
            <TabsTrigger 
              key={tab}
              value={tab.toLowerCase().replace(' ', '-')} 
              className="px-4 py-3 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:text-secondary whitespace-nowrap"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card className="border shadow-none rounded-sm overflow-hidden">
            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
              <CardTitle className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2"><Info className="w-3 h-3" /> INFO</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-xs">
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Match</span><span className="font-black text-slate-900">{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Date</span><span className="font-medium text-slate-900">{new Date(match.matchDate).toLocaleDateString()}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Toss</span><span className="font-medium text-slate-900">{match.tossWinnerTeamId ? `${getTeamName(match.tossWinnerTeamId)} won & opt to ${match.tossDecision}` : '---'}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="mt-4 space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-lg border shadow-sm space-y-4 text-center">
            <div className="text-blue-600 font-bold text-sm uppercase tracking-widest">{match.resultDescription}</div>
            <div className="space-y-3">
              {inn1 && <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><span className="font-black text-lg md:text-2xl text-slate-800">{getAbbr(getTeamName(match.team1Id))} {inn1.score}/{inn1.wickets} <span className="text-slate-400 font-bold text-xs">({inn1.oversCompleted}.{inn1.ballsInCurrentOver})</span></span>{match.currentInningNumber === 1 && match.status === 'live' && <Badge variant="secondary" className="animate-pulse">Active</Badge>}</div>}
              {inn2 && <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"><span className="font-black text-lg md:text-2xl text-slate-800">{getAbbr(getTeamName(match.team2Id))} {inn2.score}/{inn2.wickets} <span className="text-slate-400 font-bold text-xs">({inn2.oversCompleted}.{inn2.ballsInCurrentOver})</span></span>{match.currentInningNumber === 2 && match.status === 'live' && <Badge variant="secondary" className="animate-pulse">Active</Badge>}</div>}
            </div>
          </div>

          {isUmpire && match.status === 'live' && (
            <div className="space-y-4">
              <Card className="border shadow-none bg-slate-50/50">
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between bg-white border-b">
                  <CardTitle className="text-xs uppercase font-black text-slate-400">Controls</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsBowlerModalOpen(true)} className="h-8 text-[10px] font-bold"><Users className="w-3 h-3 mr-1"/> New Bowler</Button>
                    <Button variant="outline" size="sm" onClick={handleUndo} className="h-8 text-[10px] font-bold"><Undo2 className="w-3 h-3 mr-1"/> Undo</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {needsOpeningPair ? (
                    <Button onClick={() => setIsOpeningPairSetupOpen(true)} className="w-full h-16 text-lg font-bold">Set Opening Pair</Button>
                  ) : needsNextBatter ? (
                    <div className="space-y-3 p-4 bg-white border rounded-lg text-center">
                      <p className="text-sm font-bold">Select Next Batter</p>
                      <Select onValueChange={handleAssignNextBatter}>
                        <SelectTrigger><SelectValue placeholder="Select Batter" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">All Out (End Inning)</SelectItem>
                          {battingSquadIds.filter(id => !dismissedPlayerIds.includes(id) && id !== activeInningData?.nonStrikerPlayerId).map(id => (
                            <SelectItem key={id} value={id}>{getPlayerName(id)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {[0, 1, 2, 3, 4, 6].map(num => <Button key={num} size="lg" variant="outline" className="h-16 font-black text-2xl" onClick={() => handleBall(num)}>{num}</Button>)}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="destructive" size="lg" className="h-16 font-black text-xs" onClick={() => setIsWicketModalOpen(true)}>WICKET</Button>
                        <Button variant="outline" size="lg" className="h-16 font-black border-secondary text-secondary" onClick={() => handleBall(0, false, 'wide')}>WIDE</Button>
                        <Button variant="outline" size="lg" className="h-16 font-black border-secondary text-secondary" onClick={() => setIsNoBallModalOpen(true)}>NO BALL</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                {isCurrentInningsOver && match.currentInningNumber === 1 && !inn2 && <Button variant="secondary" className="flex-1 h-12 font-bold" onClick={handleStartInnings2}>Start 2nd Inning</Button>}
                {isCurrentInningsOver && (match.currentInningNumber === 2 || (match.currentInningNumber === 1 && activeInningData?.wickets >= 10)) && <Button variant="destructive" className="flex-1 h-12 font-bold" onClick={handleEndMatch}>Finalize Match</Button>}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scorecard" className="mt-4 space-y-8">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-bold h-8">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-bold h-8" disabled={!inn2}>Innings 2</Button>
          </div>

          {activeInningData && (
            <div className="space-y-6">
              <div className="bg-primary text-white p-3 flex justify-between items-center rounded-sm">
                <span className="font-bold text-xs uppercase truncate">{getTeamName(activeInningData.battingTeamId)}</span>
                <span className="font-black text-xs whitespace-nowrap">{activeInningData.score}-{activeInningData.wickets} ({activeInningData.oversCompleted}.{activeInningData.ballsInCurrentOver})</span>
              </div>

              <div className="overflow-x-auto border rounded-sm">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-bold uppercase">Batter</TableHead><TableHead className="text-right text-[10px] font-bold">R</TableHead><TableHead className="text-right text-[10px] font-bold">B</TableHead><TableHead className="text-right text-[10px] font-bold">SR</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {scorecard.batting.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="py-2"><p className="text-xs font-bold text-blue-600">{getPlayerName(b.id)}{b.id === activeInningData.strikerPlayerId && '*'}</p><p className="text-[9px] text-slate-400 italic">{b.out ? b.dismissal : 'not out'}</p></TableCell>
                        <TableCell className="text-right font-black text-xs">{b.runs}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.balls}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50/50"><TableCell className="text-xs font-bold">Extras</TableCell><TableCell colSpan={3} className="text-right text-xs font-bold">{scorecard.extras.total} (w{scorecard.extras.wide}, nb{scorecard.extras.noball}, b{scorecard.extras.byes}, lb{scorecard.extras.legbyes})</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="overflow-x-auto border rounded-sm">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-bold uppercase">Bowler</TableHead><TableHead className="text-right text-[10px] font-bold">O</TableHead><TableHead className="text-right text-[10px] font-bold">R</TableHead><TableHead className="text-right text-[10px] font-bold">W</TableHead><TableHead className="text-right text-[10px] font-bold">ECO</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {scorecard.bowling.map(bw => (
                      <TableRow key={bw.id}>
                        <TableCell className="text-blue-600 font-bold text-xs py-2">{getPlayerName(bw.id)}</TableCell>
                        <TableCell className="text-right text-xs">{Math.floor(bw.legalBalls/6)}.{bw.legalBalls%6}</TableCell>
                        <TableCell className="text-right text-xs font-black">{bw.runs}</TableCell>
                        <TableCell className="text-right text-xs font-black text-secondary">{bw.wickets}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">{bw.legalBalls > 0 ? ((bw.runs/(bw.legalBalls/6))).toFixed(2) : '0.00'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="overs" className="mt-4 space-y-6">
          {[inn2Overs, inn1Overs].map((overs, idx) => overs.length > 0 && (
            <div key={idx} className="space-y-4">
              <div className={cn("p-2 rounded-sm font-bold text-[10px] uppercase", idx === 0 ? "bg-primary text-white" : "bg-slate-200 text-slate-800")}>
                Innings {2-idx} - {getAbbr(getTeamName(idx === 0 ? inn2?.battingTeamId : inn1?.battingTeamId))}
              </div>
              <div className="space-y-2">{overs.map(over => <OverRow key={over.overNumber} over={over} />)}</div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="points-table" className="mt-4">
          <div className="overflow-x-auto border rounded-sm bg-white">
            <div className="bg-[#e6edeb] p-2 flex items-center"><div className="bg-[#7c3aed] text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase">CHAMPIONSHIP GROUP</div></div>
            <Table>
              <TableHeader className="bg-[#f0f4f3]"><TableRow><TableHead className="w-10 text-[10px] font-bold uppercase">#</TableHead><TableHead className="text-[10px] font-bold uppercase">Team</TableHead><TableHead className="text-center text-[10px] font-bold uppercase">P</TableHead><TableHead className="text-center text-[10px] font-bold uppercase">W</TableHead><TableHead className="text-center text-[10px] font-bold uppercase">PTS</TableHead><TableHead className="text-right text-[10px] font-bold uppercase pr-4">NRR</TableHead></TableRow></TableHeader>
              <TableBody>
                {allTeams?.sort((a,b) => (b.matchesWon*2+b.matchesDrawn) - (a.matchesWon*2+a.matchesDrawn) || (b.netRunRate-a.netRunRate)).map((team, idx) => (
                  <TableRow key={team.id} className="h-12">
                    <TableCell className="text-center font-bold text-xs text-slate-500">{idx+1}</TableCell>
                    <TableCell className="py-2"><div className="flex items-center gap-2"><Avatar className="h-5 w-5 rounded-sm"><AvatarImage src={team.logoUrl}/><AvatarFallback>{team.name[0]}</AvatarFallback></Avatar><span className="font-bold text-blue-600 text-xs truncate max-w-[80px]">{team.name}</span></div></TableCell>
                    <TableCell className="text-center text-xs">{(team.matchesWon||0)+(team.matchesLost||0)+(team.matchesDrawn||0)}</TableCell>
                    <TableCell className="text-center text-xs font-medium">{team.matchesWon||0}</TableCell>
                    <TableCell className="text-center text-xs font-black">{team.matchesWon*2+team.matchesDrawn}</TableCell>
                    <TableCell className="text-right text-xs font-bold pr-4">{(team.netRunRate||0)>0?'+':''}{(team.netRunRate||0).toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Optimized Dialogs for Mobile Scroll and Middle Centering */}
      <Dialog open={isOpeningPairSetupOpen} onOpenChange={setIsOpeningPairSetupOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Set Openers</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Striker</Label><Select onValueChange={(v) => setSetupPair({...setupPair, strikerId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{battingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Non-Striker</Label><Select onValueChange={(v) => setSetupPair({...setupPair, nonStrikerId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{battingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label>Opening Bowler</Label><Select onValueChange={(v) => setSetupPair({...setupPair, bowlerId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{bowlingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button onClick={() => { if (activeInningRef) updateDocumentNonBlocking(activeInningRef, { strikerPlayerId: setupPair.strikerId, nonStrikerPlayerId: setupPair.nonStrikerId, currentBowlerPlayerId: setupPair.bowlerId }); setIsOpeningPairSetupOpen(false); }} className="w-full h-12">Start Match</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketModalOpen} onOpenChange={setIsWicketModalOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Wicket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1"><Label>Type</Label><Select value={wicketDetails.type} onValueChange={(v) => setWicketDetails({...wicketDetails, type: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="lbw">LBW</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumping">Stumping</SelectItem><SelectItem value="hit wicket">Hit Wicket</SelectItem></SelectContent></Select></div>
            {['caught', 'runout', 'stumping'].includes(wicketDetails.type) && <div className="space-y-1"><Label>Fielder</Label><Select value={wicketDetails.fielderId} onValueChange={(v) => setWicketDetails({...wicketDetails, fielderId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{bowlingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-1"><Label>Next Batter</Label><Select onValueChange={(v) => setWicketDetails({...wicketDetails, newStrikerId: v})}><SelectTrigger><SelectValue placeholder="Select Batter"/></SelectTrigger><SelectContent><SelectItem value="none">All Out</SelectItem>{battingSquadIds.filter(id => !dismissedPlayerIds.includes(id) && id !== activeInningData?.strikerPlayerId).map(id => (<SelectItem key={id} value={id}>{getPlayerName(id)}</SelectItem>))}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={() => handleBall(0, true)} className="w-full h-14 font-black">CONFIRM WICKET</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoBallModalOpen} onOpenChange={setIsNoBallModalOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>No Ball</DialogTitle><DialogDescription>Runs scored off bat?</DialogDescription></DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-4">{[0, 1, 2, 3, 4, 6].map(n => <Button key={n} variant="outline" className="h-16 font-black text-xl" onClick={() => handleBall(n, false, 'noball')}>{n}</Button>)}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBowlerModalOpen} onOpenChange={setIsBowlerModalOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign Bowler</DialogTitle></DialogHeader>
          <div className="py-4"><Select onValueChange={setSelectedNextBowlerId}><SelectTrigger><SelectValue placeholder="Select Bowler"/></SelectTrigger><SelectContent>{bowlingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <DialogFooter><Button onClick={() => { if (activeInningRef) updateDocumentNonBlocking(activeInningRef, { currentBowlerPlayerId: selectedNextBowlerId }); setIsBowlerModalOpen(false); }} className="w-full h-12">Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
