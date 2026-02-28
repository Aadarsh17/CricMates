
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserCircle, Info, Users, Flag, ChevronDown, Star, CheckCircle2, Trophy, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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

  const didNotBatPlayers = useMemo(() => {
    if (!match || !activeInningData || !scorecard.batting) return [];
    const squad = activeInningData.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds;
    const battingIds = scorecard.batting.map(b => b.id);
    const onField = [activeInningData.strikerPlayerId, activeInningData.nonStrikerPlayerId].filter(Boolean);
    return squad.filter(pid => !battingIds.includes(pid) && !onField.includes(pid));
  }, [match, activeInningData, scorecard.batting]);

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
    if (!match || !inn1 || !isUmpire || !allTeams) {
      toast({ title: "Cannot End Match", description: "Match data or Team list is missing.", variant: "destructive" });
      return;
    }

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

    // Official NRR calculation: (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
    const getDecimalOvers = (inn: any) => {
      if (!inn) return 0;
      // If a team is bowled out, use full quota of overs for NRR
      if (inn.wickets >= 10) return match.totalOvers;
      return (inn.oversCompleted || 0) + ((inn.ballsInCurrentOver || 0) / 6);
    };

    const updateTeamStats = (teamId: string, runsScored: number, runsConceded: number, oversFaced: number, oversBowled: number, isWinner: boolean, isDrawn: boolean) => {
      const team = allTeams.find(t => t.id === teamId);
      if (!team) return;

      const newRunsScored = (team.totalRunsScored || 0) + runsScored;
      const newRunsConceded = (team.totalRunsConceded || 0) + runsConceded;
      const newOversFaced = (team.totalOversFaced || 0) + oversFaced;
      const newOversBowled = (team.totalOversBowled || 0) + oversBowled;

      let nrrValue = 0;
      if (newOversFaced > 0 && newOversBowled > 0) {
        nrrValue = (newRunsScored / newOversFaced) - (newRunsConceded / newOversBowled);
      }

      updateDocumentNonBlocking(doc(db, 'teams', teamId), {
        matchesWon: (team.matchesWon || 0) + (isWinner ? 1 : 0),
        matchesLost: (team.matchesLost || 0) + (!isWinner && !isDrawn ? 1 : 0),
        matchesDrawn: (team.matchesDrawn || 0) + (isDrawn ? 1 : 0),
        totalRunsScored: newRunsScored,
        totalRunsConceded: newRunsConceded,
        totalOversFaced: newRunsFaced,
        totalOversBowled: newOversBowled,
        netRunRate: Number(nrrValue.toFixed(4))
      });
    };

    const o1 = getDecimalOvers(inn1);
    const o2 = getDecimalOvers(inn2);

    // Update Team 1 (Inn 1 Batting Team)
    updateTeamStats(
      inn1.battingTeamId, 
      s1, 
      s2, 
      o1, 
      o2, 
      winnerId === inn1.battingTeamId, 
      !winnerId
    );

    // Update Team 2 (Inn 2 Batting Team / Inn 1 Bowling Team)
    if (inn2) {
      updateTeamStats(
        inn2.battingTeamId, 
        s2, 
        s1, 
        o2, 
        o1, 
        winnerId === inn2.battingTeamId, 
        !winnerId
      );
    }

    updateDocumentNonBlocking(matchRef, {
      status: 'completed',
      resultDescription: resultDesc
    });

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

  const formatDateIST = (dateStr: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTimeIST = (dateStr: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) + ' IST';
  };

  const BallBubble = ({ ball }: { ball: any }) => {
    let color = 'bg-slate-400';
    let label = ball.runsScored.toString();

    if (ball.isWicket) {
      color = 'bg-[#e91e63]';
      label = 'W';
    } else if (ball.extraType === 'wide') {
      color = 'bg-[#fbc02d]';
      label = 'Wd';
    } else if (ball.extraType === 'noball') {
      color = 'bg-[#fbc02d]';
      label = 'NB';
    } else if (ball.runsScored === 4) {
      color = 'bg-[#0091ca]';
      label = '4';
    } else if (ball.runsScored === 6) {
      color = 'bg-[#9c27b0]';
      label = '6';
    } else if (ball.runsScored > 0) {
      color = 'bg-[#8bc34a]';
      label = ball.runsScored.toString();
    }

    return (
      <div className={cn("w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-bold text-white", color)}>
        {label}
      </div>
    );
  };

  const OverRow = ({ over }: { over: any }) => (
    <div className="bg-white p-4 border rounded-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
      <div className="w-full md:w-32">
        <p className="text-sm font-black text-slate-900">Over {over.overNumber} <span className="text-slate-400 font-bold ml-1">- {over.runs} runs</span></p>
        <p className="text-xs font-black text-slate-400 uppercase tracking-tight">
          {getAbbr(getTeamName(over.battingTeamId))} {over.scoreAtEnd}
        </p>
      </div>
      <div className="flex-1 space-y-2 w-full">
        <p className="text-xs font-bold text-slate-700">
          {getPlayerName(over.bowlerId)} to {Array.from(over.batterIds).map(id => getPlayerName(id as string)).join(' & ')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {over.balls.map((ball: any) => (
            <BallBubble key={ball.id} ball={ball} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      <div className="border-b bg-white p-6">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full justify-start overflow-x-auto border-b rounded-none bg-transparent h-auto p-0 scrollbar-hide">
          {['Info', 'Live', 'Scorecard', 'Squads', 'Points Table', 'Overs'].map((tab) => (
            <TabsTrigger 
              key={tab}
              value={tab.toLowerCase().replace(' ', '-')} 
              className="px-4 py-3 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:text-secondary"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="info" className="space-y-6 mt-4">
          <Card className="border shadow-none rounded-sm">
            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
              <CardTitle className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2">
                <Info className="w-3 h-3" /> INFO
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y text-xs">
                <div className="flex p-4">
                  <span className="w-32 font-bold text-slate-500">Match</span>
                  <span className="font-black text-slate-900">{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</span>
                </div>
                <div className="flex p-4">
                  <span className="w-32 font-bold text-slate-500">Date</span>
                  <span className="font-medium text-slate-900 flex items-center gap-2"><Calendar className="w-3 h-3"/> {formatDateIST(match.matchDate)}</span>
                </div>
                <div className="flex p-4">
                  <span className="w-32 font-bold text-slate-500">Time</span>
                  <span className="font-medium text-slate-900 flex items-center gap-2"><Clock className="w-3 h-3"/> {formatTimeIST(match.matchDate)}</span>
                </div>
                <div className="flex p-4">
                  <span className="w-32 font-bold text-slate-500">Toss</span>
                  <span className="font-medium text-slate-900">
                    {match.tossWinnerTeamId ? `${getTeamName(match.tossWinnerTeamId)} won the toss and opt to ${match.tossDecision === 'bat' ? 'Bat' : 'Bowl'}` : '---'}
                  </span>
                </div>
                <div className="flex p-4">
                  <span className="w-32 font-bold text-slate-500">Venue</span>
                  <span className="font-medium text-slate-900">Dumping Ground nalasopara west</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card className="border shadow-none rounded-sm">
                <CardHeader className="bg-slate-50 py-3 px-4 border-b"><CardTitle className="text-[10px] uppercase font-black text-slate-400">{getTeamName(match.team1Id)} Squad</CardTitle></CardHeader>
                <CardContent className="p-4 space-y-2">
                  {allPlayers?.filter(p => match.team1SquadPlayerIds.includes(p.id)).map(p => (
                    <div key={p.id} className="flex justify-between items-center text-[10px] font-bold py-1 border-b last:border-0 border-slate-50">
                      <span className="text-blue-600">{p.name}</span>
                      <span className="text-slate-400 uppercase tracking-tighter">{p.role}</span>
                    </div>
                  ))}
                </CardContent>
             </Card>
             <Card className="border shadow-none rounded-sm">
                <CardHeader className="bg-slate-50 py-3 px-4 border-b"><CardTitle className="text-[10px] uppercase font-black text-slate-400">{getTeamName(match.team2Id)} Squad</CardTitle></CardHeader>
                <CardContent className="p-4 space-y-2">
                  {allPlayers?.filter(p => match.team2SquadPlayerIds.includes(p.id)).map(p => (
                    <div key={p.id} className="flex justify-between items-center text-[10px] font-bold py-1 border-b last:border-0 border-slate-50">
                      <span className="text-blue-600">{p.name}</span>
                      <span className="text-slate-400 uppercase tracking-tighter">{p.role}</span>
                    </div>
                  ))}
                </CardContent>
             </Card>
          </div>
        </TabsContent>

        <TabsContent value="live" className="space-y-6 mt-4">
          <div className="bg-white p-6 rounded-sm border shadow-sm space-y-6">
            <div className="text-blue-600 font-bold text-sm uppercase tracking-widest">
              {match.resultDescription}
            </div>

            <div className="space-y-4">
              {inn1 && (
                <div className="flex justify-between items-center">
                  <span className="font-black text-2xl text-slate-800 tracking-tight">
                    {getAbbr(getTeamName(match.team1Id))} {inn1.score}/{inn1.wickets} <span className="text-slate-400 font-bold text-sm">({inn1.oversCompleted}.{inn1.ballsInCurrentOver})</span>
                  </span>
                </div>
              )}
              {inn2 && (
                <div className="flex justify-between items-center">
                  <span className="font-black text-2xl text-slate-800 tracking-tight">
                    {getAbbr(getTeamName(match.team2Id))} {inn2.score}/{inn2.wickets} <span className="text-slate-400 font-bold text-sm">({inn2.oversCompleted}.{inn2.ballsInCurrentOver})</span>
                  </span>
                </div>
              )}
            </div>

            {potm && (
              <div className="pt-6 border-t">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">PLAYER OF THE MATCH</p>
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-slate-100">
                    <AvatarImage src={potm.imageUrl || `https://picsum.photos/seed/${potm.id}/100`} />
                    <AvatarFallback><UserCircle className="w-8 h-8 text-slate-300" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-base font-black text-slate-800">{potm.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {getTeamName(potm.teamId)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isUmpire && match.status === 'live' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 border-none shadow-none bg-slate-50/50">
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between bg-white border-b">
                  <CardTitle className="text-xs uppercase font-black text-slate-400">Scoring Controls</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsBowlerModalOpen(true)} className="h-7 text-[10px] font-bold">New Bowler</Button>
                    <Button variant="outline" size="sm" onClick={handleUndo} className="h-7 text-[10px] font-bold">Undo</Button>
                    {isCurrentInningsOver && match.currentInningNumber === 1 && !inn2 && (
                      <Button variant="secondary" size="sm" onClick={handleStartInnings2} className="h-7 text-[10px] font-bold">Start 2nd Inning</Button>
                    )}
                    {isCurrentInningsOver && (match.currentInningNumber === 2 || (match.currentInningNumber === 1 && activeInningData?.wickets >= 10)) && (
                      <Button variant="destructive" size="sm" onClick={handleEndMatch} className="h-7 text-[10px] font-bold">End Match</Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {needsOpeningPair ? (
                    <div className="p-8 text-center bg-white border rounded-lg border-dashed">
                      <p className="text-sm font-bold mb-4">Innings Start: Set Opening Pair</p>
                      <Button onClick={() => setIsOpeningPairSetupOpen(true)}>Set Openers</Button>
                    </div>
                  ) : needsNextBatter ? (
                    <div className="p-8 text-center bg-white border rounded-lg border-dashed">
                      <p className="text-sm font-bold mb-4">Batter Dismissed: Select Next Batter</p>
                      <div className="max-w-xs mx-auto">
                        <Select onValueChange={handleAssignNextBatter}>
                          <SelectTrigger><SelectValue placeholder="Select Batter" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">All Out (End Innings)</SelectItem>
                            {battingSquadIds.filter(id => !dismissedPlayerIds.includes(id) && id !== activeInningData?.nonStrikerPlayerId).map(id => (
                              <SelectItem key={id} value={id}>{getPlayerName(id)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {[0, 1, 2, 3, 4, 6].map((num) => (
                          <Button key={num} size="lg" variant="outline" className="h-14 font-black text-xl hover:bg-secondary hover:text-white" onClick={() => handleBall(num)}>{num}</Button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="destructive" size="lg" className="h-14 font-black" onClick={() => setIsWicketModalOpen(true)}>WICKET</Button>
                        <Button variant="outline" size="lg" className="h-14 font-black border-secondary text-secondary" onClick={() => handleBall(0, false, 'wide')}>WIDE</Button>
                        <Button variant="outline" size="lg" className="h-14 font-black border-secondary text-secondary" onClick={() => setIsNoBallModalOpen(true)}>NO BALL</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-none bg-slate-50/50">
                <CardHeader className="py-2 px-4 bg-white border-b"><CardTitle className="text-xs uppercase font-black text-slate-400">Current Over</CardTitle></CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="bg-white p-3 rounded border text-xs space-y-2">
                    <div className="flex justify-between"><span>Striker</span><span className="font-bold">{getPlayerName(activeInningData?.strikerPlayerId || '')}</span></div>
                    <div className="flex justify-between"><span>Non-Striker</span><span className="font-bold">{getPlayerName(activeInningData?.nonStrikerPlayerId || '')}</span></div>
                    <div className="flex justify-between"><span>Bowler</span><span className="font-bold text-secondary">{getPlayerName(activeInningData?.currentBowlerPlayerId || '')}</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scorecard" className="mt-4 space-y-8">
          <div className="flex gap-2 mb-4">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-bold h-7">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-bold h-7" disabled={!inn2 && match.currentInningNumber === 1}>Innings 2</Button>
          </div>

          {activeInningData && (
            <div className="space-y-8">
              <div className="bg-primary text-white p-3 flex justify-between items-center rounded-sm">
                <span className="font-bold text-sm uppercase">{getTeamName(activeInningData.battingTeamId)}</span>
                <span className="font-black text-sm">{activeInningData.score}-{activeInningData.wickets} ({activeInningData.oversCompleted}.{activeInningData.ballsInCurrentOver} Ov)</span>
              </div>

              <div className="bg-white border rounded-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500">Batter</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">R</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">B</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">4s</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">6s</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">SR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scorecard.batting.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="py-2">
                          <div className="text-blue-600 font-bold text-xs flex items-center gap-1">
                            {getPlayerName(b.id)}
                            {b.id === activeInningData.strikerPlayerId && <span className="text-[8px] text-slate-400">*</span>}
                          </div>
                          <div className="text-[9px] text-slate-400 font-medium italic">
                            {b.out ? b.dismissal : 'not out'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-xs">{b.runs}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.balls}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.fours}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.sixes}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : '0.00'}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50/30">
                      <TableCell className="text-xs font-bold">Extras</TableCell>
                      <TableCell colSpan={5} className="text-xs font-bold text-right">
                        {scorecard.extras.total} (b {scorecard.extras.byes || 0}, lb {scorecard.extras.legbyes || 0}, w {scorecard.extras.wide || 0}, nb {scorecard.extras.noball || 0})
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="bg-white border rounded-sm overflow-hidden mt-6">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500">Bowler</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">O</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">M</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">R</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">W</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">ECO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scorecard.bowling.map((bw) => (
                      <TableRow key={bw.id}>
                        <TableCell className="text-blue-600 font-bold text-xs py-2">{getPlayerName(bw.id)}</TableCell>
                        <TableCell className="text-right text-xs font-bold">{Math.floor(bw.legalBalls / 6)}.{bw.legalBalls % 6}</TableCell>
                        <TableCell className="text-right text-xs">{bw.maidens}</TableCell>
                        <TableCell className="text-right text-xs font-black">{bw.runs}</TableCell>
                        <TableCell className="text-right text-xs font-black text-secondary">{bw.wickets}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">
                          {bw.legalBalls > 0 ? ((bw.runs / (bw.legalBalls / 6))).toFixed(2) : '0.00'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <div className="bg-slate-100 p-2 font-black text-[10px] uppercase text-slate-600 flex justify-between">
                  <span className="flex-1">Fall of Wickets</span>
                  <span className="w-24 text-center">Score</span>
                  <span className="w-24 text-right">Over</span>
                </div>
                <div className="border rounded-sm bg-white overflow-hidden">
                  <Table>
                    <TableBody>
                      {scorecard.fow.length > 0 ? scorecard.fow.map((f, i) => (
                        <TableRow key={i} className="border-b last:border-0 h-10">
                          <TableCell className="text-xs font-bold text-blue-600">{getPlayerName(f.batterId)}</TableCell>
                          <TableCell className="text-center text-xs font-black w-24">{f.score}-{f.wicket}</TableCell>
                          <TableCell className="text-right text-xs font-medium text-slate-500 w-24">{f.over}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-slate-400 py-4 italic">No wickets fallen</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-slate-100 p-2 font-black text-[10px] uppercase text-slate-600">Partnerships</div>
                <div className="border rounded-sm bg-white overflow-hidden">
                  <Table>
                    <TableBody>
                      {scorecard.partnerships.length > 0 ? scorecard.partnerships.map((p, i) => (
                        <TableRow key={i} className="border-b last:border-0">
                          <TableCell className="w-[35%] py-4">
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-xs font-bold text-blue-600">{getPlayerName(p.p1.id)}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{p.p1.runs}({p.p1.balls})</span>
                            </div>
                          </TableCell>
                          <TableCell className="w-[30%] text-center py-4">
                             <span className="text-xs font-black text-slate-900">{p.totalRuns}({p.totalBalls})</span>
                             <div className="text-[8px] uppercase font-black text-slate-300 mt-1">{p.wicket}st wicket</div>
                          </TableCell>
                          <TableCell className="w-[35%] py-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs font-bold text-blue-600">{getPlayerName(p.p2.id)}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{p.p2.runs}({p.p2.balls})</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-slate-400 py-4 italic">No completed partnerships recorded</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="squads" className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border shadow-none rounded-sm">
            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
              <CardTitle className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2">
                <Users className="w-3 h-3" /> {getTeamName(match.team1Id)} SQUAD
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {allPlayers?.filter(p => match.team1SquadPlayerIds.includes(p.id)).map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                    <span className="font-bold text-blue-600">{p.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">{p.role}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-none rounded-sm">
            <CardHeader className="bg-slate-50 py-3 px-4 border-b">
              <CardTitle className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-2">
                <Users className="w-3 h-3" /> {getTeamName(match.team2Id)} SQUAD
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {allPlayers?.filter(p => match.team2SquadPlayerIds.includes(p.id)).map(p => (
                  <div key={p.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                    <span className="font-bold text-blue-600">{p.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">{p.role}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="points-table" className="mt-4">
          <div className="bg-white border rounded-sm overflow-hidden shadow-sm">
            <div className="bg-[#e6edeb] p-2 flex items-center">
               <div className="bg-[#7c3aed] text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase">SUPER 8 - GROUP 1</div>
            </div>
            <Table>
              <TableHeader className="bg-[#f0f4f3]">
                <TableRow className="border-b-0">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Team</TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-slate-500 uppercase">P</TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-slate-500 uppercase">W</TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-slate-500 uppercase">L</TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-slate-500 uppercase">NR</TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-slate-500 uppercase">PTS</TableHead>
                  <TableHead className="text-right text-[10px] font-bold text-slate-500 uppercase pr-8">NRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTeams?.sort((a, b) => {
                  const ptsA = (a.matchesWon * 2) + a.matchesDrawn;
                  const ptsB = (b.matchesWon * 2) + b.matchesDrawn;
                  if (ptsB !== ptsA) return ptsB - ptsA;
                  return (b.netRunRate || 0) - (a.netRunRate || 0);
                }).map((team, idx) => {
                  const played = (team.matchesWon || 0) + (team.matchesLost || 0) + (team.matchesDrawn || 0);
                  const points = ((team.matchesWon || 0) * 2) + (team.matchesDrawn || 0);
                  return (
                    <TableRow key={team.id} className="hover:bg-slate-50 group border-b last:border-0">
                      <TableCell className="text-center font-bold text-xs text-slate-500 py-3">{idx + 1}</TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-6 w-6 rounded-sm">
                            <AvatarImage src={team.logoUrl} />
                            <AvatarFallback className="bg-slate-100 rounded-sm"><Flag className="w-3 h-3 text-slate-300" /></AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-blue-600 text-xs">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-900">{played}</TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-900">{team.matchesWon || 0}</TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-900">{team.matchesLost || 0}</TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-900">{team.matchesDrawn || 0}</TableCell>
                      <TableCell className="text-center text-xs font-black text-slate-900">{points}</TableCell>
                      <TableCell className="text-right text-xs font-bold pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-slate-900">{(team.netRunRate || 0) > 0 ? '+' : ''}{(team.netRunRate || 0).toFixed(3)}</span>
                          <ChevronDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="overs" className="mt-4 space-y-6">
          {inn2Overs.length > 0 && (
            <div className="space-y-4">
              <div className="bg-primary text-white p-3 rounded-sm">
                <span className="font-bold text-xs uppercase">Innings 2 - {getTeamName(inn2?.battingTeamId || '')}</span>
              </div>
              <div className="space-y-2">
                {inn2Overs.map((over) => (
                  <OverRow key={over.overNumber} over={over} />
                ))}
              </div>
            </div>
          )}

          {inn1Overs.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-slate-200 text-slate-800 p-3 rounded-sm">
                <span className="font-bold text-xs uppercase">Innings 1 - {getTeamName(inn1?.battingTeamId || '')}</span>
              </div>
              <div className="space-y-2">
                {inn1Overs.map((over) => (
                  <OverRow key={over.overNumber} over={over} />
                ))}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-sm bg-slate-50">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No overs completed yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isOpeningPairSetupOpen} onOpenChange={setIsOpeningPairSetupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Openers</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Striker</Label><Select onValueChange={(v) => setSetupPair({...setupPair, strikerId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{battingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Non-Striker</Label><Select onValueChange={(v) => setSetupPair({...setupPair, nonStrikerId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{battingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label>Bowler</Label><Select onValueChange={(v) => setSetupPair({...setupPair, bowlerId: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{bowlingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button onClick={() => {
            if (activeInningRef) updateDocumentNonBlocking(activeInningRef, { strikerPlayerId: setupPair.strikerId, nonStrikerPlayerId: setupPair.nonStrikerId, currentBowlerPlayerId: setupPair.bowlerId });
            setIsOpeningPairSetupOpen(false);
          }}>Start Scoring</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketModalOpen} onOpenChange={setIsWicketModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Wicket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Wicket Type</Label>
              <Select value={wicketDetails.type} onValueChange={(v) => setWicketDetails({...wicketDetails, type: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bowled">Bowled</SelectItem>
                  <SelectItem value="caught">Caught</SelectItem>
                  <SelectItem value="lbw">LBW</SelectItem>
                  <SelectItem value="runout">Run Out</SelectItem>
                  <SelectItem value="stumping">Stumping</SelectItem>
                  <SelectItem value="hit wicket">Hit Wicket</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(['caught', 'runout', 'stumping'].includes(wicketDetails.type)) && (
              <div className="space-y-1">
                <Label>Fielder Involved</Label>
                <Select value={wicketDetails.fielderId} onValueChange={(v) => setWicketDetails({...wicketDetails, fielderId: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {bowlingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Next Batter</Label>
              <Select onValueChange={(v) => setWicketDetails({...wicketDetails, newStrikerId: v})}>
                <SelectTrigger><SelectValue placeholder="Select Batter"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Out (End Innings)</SelectItem>
                  {battingSquadIds.filter(id => !dismissedPlayerIds.includes(id) && id !== activeInningData?.strikerPlayerId).map(id => (
                    <SelectItem key={id} value={id}>{getPlayerName(id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => handleBall(0, true)} className="w-full">
              Confirm Wicket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoBallModalOpen} onOpenChange={setIsNoBallModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>No Ball</DialogTitle><DialogDescription>Runs scored off bat?</DialogDescription></DialogHeader>
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2, 3, 4, 6].map(n => <Button key={n} variant="outline" onClick={() => handleBall(n, false, 'noball')}>{n}</Button>)}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBowlerModalOpen} onOpenChange={setIsBowlerModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Select Bowler</DialogTitle></DialogHeader>
          <Select onValueChange={setSelectedNextBowlerId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{bowlingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
          <DialogFooter><Button onClick={() => { if (activeInningRef) updateDocumentNonBlocking(activeInningRef, { currentBowlerPlayerId: selectedNextBowlerId }); setIsBowlerModalOpen(false); }}>Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
