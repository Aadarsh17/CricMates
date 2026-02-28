
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, getDocs, increment } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Undo2, Shuffle, ArrowLeft, UserPlus, RefreshCw, Star, Info, UserCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';

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

  const deliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId, activeInningView]
  );
  const { data: deliveries } = useCollection(deliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const dismissedPlayerIds = useMemo(() => {
    return Array.from(new Set(deliveries?.filter(d => d.isWicket && d.batsmanOutPlayerId && d.batsmanOutPlayerId !== 'none').map(d => d.batsmanOutPlayerId) || []));
  }, [deliveries]);

  // Scorecard Aggregation
  const scorecard = useMemo(() => {
    if (!deliveries) return { batting: [], bowling: [] };

    const battingMap: Record<string, any> = {};
    const bowlingMap: Record<string, any> = {};

    deliveries.forEach((d: any) => {
      // Batting Stats
      if (d.strikerPlayerId && d.strikerPlayerId !== 'none') {
        if (!battingMap[d.strikerPlayerId]) {
          battingMap[d.strikerPlayerId] = { id: d.strikerPlayerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '' };
        }
        battingMap[d.strikerPlayerId].runs += d.runsScored;
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

      // Non-striker could also be out in run out
      if (d.isWicket && d.batsmanOutPlayerId && d.batsmanOutPlayerId !== d.strikerPlayerId && d.batsmanOutPlayerId !== 'none') {
         if (!battingMap[d.batsmanOutPlayerId]) {
           battingMap[d.batsmanOutPlayerId] = { id: d.batsmanOutPlayerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: true, dismissal: d.outcomeDescription };
         } else {
           battingMap[d.batsmanOutPlayerId].out = true;
           battingMap[d.batsmanOutPlayerId].dismissal = d.outcomeDescription;
         }
      }

      // Bowling Stats
      if (d.bowlerPlayerId && d.bowlerPlayerId !== 'none') {
        if (!bowlingMap[d.bowlerPlayerId]) {
          bowlingMap[d.bowlerPlayerId] = { id: d.bowlerPlayerId, legalBalls: 0, runs: 0, wickets: 0, maidens: 0 };
        }
        if (d.extraType === 'none') {
          bowlingMap[d.bowlerPlayerId].legalBalls += 1;
        }
        if (['wide', 'noball'].includes(d.extraType)) {
          bowlingMap[d.bowlerPlayerId].runs += (d.runsScored + 1);
        } else {
          bowlingMap[d.bowlerPlayerId].runs += d.runsScored;
        }
        if (d.isWicket && !['runout', 'hit wicket'].includes(d.dismissalType)) {
          bowlingMap[d.bowlerPlayerId].wickets += 1;
        }
      }
    });

    return {
      batting: Object.values(battingMap),
      bowling: Object.values(bowlingMap)
    };
  }, [deliveries]);

  const [isWicketModalOpen, setIsWicketModalOpen] = useState(false);
  const [isBowlerModalOpen, setIsBowlerModalOpen] = useState(false);
  const [isNoBallModalOpen, setIsNoBallModalOpen] = useState(false);
  const [isSecondInningsSetupOpen, setIsSecondInningsSetupOpen] = useState(false);
  const [isOpeningPairSetupOpen, setIsOpeningPairSetupOpen] = useState(false);
  
  const [wicketDetails, setWicketDetails] = useState({
    type: 'bowled',
    newStrikerId: '',
    fielderId: 'none'
  });
  const [selectedNextBowlerId, setSelectedNextBowlerId] = useState('');
  
  const [setupPair, setSetupPair] = useState({
    strikerId: '',
    nonStrikerId: '',
    bowlerId: ''
  });

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

  const isLastManPossible = activeInningData?.wickets === 9;
  
  const isCurrentInningsOver = !!(activeInningData && match && (
    activeInningData.wickets >= 10 || 
    (activeInningData.oversCompleted >= match.totalOvers) ||
    (activeInningView === 2 && inn1 && activeInningData.score > inn1.score)
  ));

  const needsNewBowler = activeInningData?.ballsInCurrentOver === 0 && 
                         activeInningData?.oversCompleted > 0 && 
                         activeInningData?.oversCompleted < (match?.totalOvers || 0) &&
                         !activeInningData?.currentBowlerPlayerId;

  const isStartingInnings = activeInningData && activeInningData.oversCompleted === 0 && activeInningData.ballsInCurrentOver === 0 && activeInningData.wickets === 0;
  const needsOpeningPair = isStartingInnings && (!activeInningData?.strikerPlayerId || !activeInningData?.currentBowlerPlayerId);
  const needsNextBatter = activeInningData && !activeInningData.strikerPlayerId && !isCurrentInningsOver && !isStartingInnings;

  const handleAssignNextBatter = (playerId: string) => {
    if (!activeInningRef || !playerId) return;
    
    if (playerId === 'none') {
      updateDocumentNonBlocking(activeInningRef, { wickets: 10 });
      toast({ title: "Innings Ended", description: "All out or no more batsmen available." });
      return;
    }

    const updateData: any = { strikerPlayerId: playerId };
    if (playerId === activeInningData?.nonStrikerPlayerId) {
      updateData.nonStrikerPlayerId = '';
    }

    updateDocumentNonBlocking(activeInningRef, updateData);
    toast({ title: "Batter Ready", description: `${getPlayerName(playerId)} is now on strike.` });
  };

  const handleBall = (runs: number, isWicket = false, extra: 'none' | 'wide' | 'noball' = 'none') => {
    if (!isUmpire || match?.status !== 'live' || !activeInningData || !activeInningRef || isCurrentInningsOver) {
      return;
    }

    if (!activeInningData.currentBowlerPlayerId) {
      setIsBowlerModalOpen(true);
      return;
    }

    const currentInning = activeInningData;
    let runsForThisBall = runs;
    if (extra !== 'none') runsForThisBall += 1;

    let newStriker = currentInning.strikerPlayerId;
    let newNonStriker = currentInning.nonStrikerPlayerId;

    if (!newStriker && !isStartingInnings) {
      toast({ title: "Setup Required", description: "Select next batter first." });
      return;
    }

    if (runs % 2 !== 0 && newStriker && newNonStriker) {
      const temp = newStriker;
      newStriker = newNonStriker;
      newNonStriker = temp;
    }

    let isOverEnd = false;
    let newOvers = currentInning.oversCompleted;
    let newBalls = currentInning.ballsInCurrentOver;

    if (extra === 'none') {
      newBalls += 1;
      if (newBalls >= 6) {
        isOverEnd = true;
        newOvers += 1;
        newBalls = 0;
        if (newStriker && newNonStriker) {
          const temp = newStriker;
          newStriker = newNonStriker;
          newNonStriker = temp;
        }
      }
    }

    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords')).id;
    const deliveryData = {
      id: deliveryId,
      inningId: `inning_${activeInningView}`,
      matchId,
      overNumber: currentInning.oversCompleted,
      ballNumberInOver: extra === 'none' ? (newBalls === 0 ? 6 : newBalls) : currentInning.ballsInCurrentOver,
      strikerPlayerId: currentInning.strikerPlayerId,
      bowlerPlayerId: currentInning.currentBowlerPlayerId,
      runsScored: runs,
      isWicket,
      extraType: extra,
      extraRuns: extra !== 'none' ? 1 : 0,
      totalRunsOnDelivery: runsForThisBall,
      outcomeDescription: isWicket ? 'WICKET!' : `${runsForThisBall}${extra !== 'none' ? ` (${extra})` : ''}`,
      dismissalType: isWicket ? wicketDetails.type : 'none',
      fielderPlayerId: isWicket ? wicketDetails.fielderId : 'none',
      batsmanOutPlayerId: isWicket ? currentInning.strikerPlayerId : 'none',
      timestamp: new Date().toISOString(),
      umpireId: user?.uid || 'anonymous',
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    let finalStriker = isWicket ? (wicketDetails.newStrikerId === 'none' ? '' : wicketDetails.newStrikerId) : newStriker;
    let finalNonStriker = newNonStriker;
    
    if (isWicket) {
      if (wicketDetails.newStrikerId === 'none') {
        finalNonStriker = '';
      } else if (wicketDetails.newStrikerId === currentInning.nonStrikerPlayerId) {
        finalNonStriker = '';
      }
    }

    updateDocumentNonBlocking(activeInningRef, {
      score: currentInning.score + runsForThisBall,
      wickets: isWicket ? currentInning.wickets + 1 : currentInning.wickets,
      oversCompleted: newOvers,
      ballsInCurrentOver: newBalls,
      strikerPlayerId: finalStriker || '',
      nonStrikerPlayerId: finalNonStriker || '',
      currentBowlerPlayerId: isOverEnd ? '' : currentInning.currentBowlerPlayerId
    });

    if (isWicket) {
      setIsWicketModalOpen(false);
      setWicketDetails({ type: 'bowled', newStrikerId: '', fielderId: 'none' });
    }
    
    if (extra === 'noball') {
      setIsNoBallModalOpen(false);
    }

    if (isOverEnd && !isCurrentInningsOver && newOvers < (match?.totalOvers || 0)) {
      setIsBowlerModalOpen(true);
    }
  };

  const handleNextBowlerSelect = () => {
    if (!selectedNextBowlerId || !activeInningRef || selectedNextBowlerId === 'none') return;
    updateDocumentNonBlocking(activeInningRef, { currentBowlerPlayerId: selectedNextBowlerId });
    setIsBowlerModalOpen(false);
    setSelectedNextBowlerId('');
  };

  const handleOpeningPairConfirm = () => {
    if (!setupPair.strikerId || !setupPair.nonStrikerId || !setupPair.bowlerId || !activeInningRef) {
      toast({ title: "Validation Error", description: "All positions required.", variant: "destructive" });
      return;
    }
    updateDocumentNonBlocking(activeInningRef, {
      strikerPlayerId: setupPair.strikerId,
      nonStrikerPlayerId: setupPair.nonStrikerId,
      currentBowlerPlayerId: setupPair.bowlerId
    });
    setIsOpeningPairSetupOpen(false);
    setIsSecondInningsSetupOpen(false);
    setSetupPair({ strikerId: '', nonStrikerId: '', bowlerId: '' });
  };

  const handleUndo = () => {
    if (!deliveries || deliveries.length === 0 || !activeInningRef || !activeInningData) return;
    const lastBall = deliveries[deliveries.length - 1];
    const wasOverEnd = lastBall.ballNumberInOver === 6 && lastBall.extraType === 'none';

    updateDocumentNonBlocking(activeInningRef, {
      score: Math.max(0, activeInningData.score - lastBall.totalRunsOnDelivery),
      wickets: lastBall.isWicket ? Math.max(0, activeInningData.wickets - 1) : activeInningData.wickets,
      ballsInCurrentOver: lastBall.extraType === 'none' ? (wasOverEnd ? 5 : lastBall.ballNumberInOver - 1) : activeInningData.ballsInCurrentOver,
      oversCompleted: wasOverEnd ? activeInningData.oversCompleted - 1 : activeInningData.oversCompleted,
      strikerPlayerId: lastBall.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      currentBowlerPlayerId: lastBall.bowlerPlayerId
    });

    deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords', lastBall.id));
    toast({ title: "Ball Undone", description: "Score reverted." });
  };

  const finalizeMatch = async () => {
    if (!isUmpire || !match || !inn1 || !inn2) return;

    const batch = writeBatch(db);
    const d1 = await getDocs(collection(db, 'matches', matchId, 'innings', 'inning_1', 'deliveryRecords'));
    const d2 = await getDocs(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'));
    const allDels = [...d1.docs.map(d => d.data()), ...d2.docs.map(d => d.data())];

    const playerStats: Record<string, { runs: number, wickets: number, matches: number }> = {};
    allDels.forEach(d => {
      if (d.strikerPlayerId && d.strikerPlayerId !== 'none') {
        if (!playerStats[d.strikerPlayerId]) playerStats[d.strikerPlayerId] = { runs: 0, wickets: 0, matches: 1 };
        playerStats[d.strikerPlayerId].runs += d.runsScored;
      }
      if (d.bowlerPlayerId && d.bowlerPlayerId !== 'none') {
        if (!playerStats[d.bowlerPlayerId]) playerStats[d.bowlerPlayerId] = { runs: 0, wickets: 0, matches: 1 };
        if (d.isWicket && !['runout', 'hit wicket'].includes(d.dismissalType)) {
          playerStats[d.bowlerPlayerId].wickets += 1;
        }
      }
    });

    for (const pid in playerStats) {
      batch.update(doc(db, 'players', pid), {
        runsScored: increment(playerStats[pid].runs),
        wicketsTaken: increment(playerStats[pid].wickets),
        matchesPlayed: increment(1),
        careerCVP: increment(playerStats[pid].runs + (playerStats[pid].wickets * 15))
      });
    }

    let result = "Match Drawn";
    if (inn2.score > inn1.score) {
      result = `${getTeamName(inn2.battingTeamId)} won by ${10 - inn2.wickets} wickets`;
      batch.update(doc(db, 'teams', inn2.battingTeamId), { matchesWon: increment(1) });
      batch.update(doc(db, 'teams', inn1.battingTeamId), { matchesLost: increment(1) });
    } else if (inn1.score > inn2.score) {
      result = `${getTeamName(inn1.battingTeamId)} won by ${inn1.score - inn2.score} runs`;
      batch.update(doc(db, 'teams', inn1.battingTeamId), { matchesWon: increment(1) });
      batch.update(doc(db, 'teams', inn2.battingTeamId), { matchesLost: increment(1) });
    }

    batch.update(matchRef!, { status: 'completed', resultDescription: result });
    await batch.commit();

    toast({ title: "Match Finalized", description: result });
    router.push('/matches');
  };

  const initInningsTwo = () => {
    if (!inn1 || !match || !setupPair.strikerId || !setupPair.nonStrikerId || !setupPair.bowlerId) return;
    const battingTeamId = inn1.battingTeamId === match.team1Id ? match.team2Id : match.team1Id;
    const bowlingTeamId = inn1.battingTeamId === match.team1Id ? match.team1Id : match.team2Id;

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
      strikerPlayerId: setupPair.strikerId,
      nonStrikerPlayerId: setupPair.nonStrikerId,
      currentBowlerPlayerId: setupPair.bowlerId,
      umpireId: user?.uid || 'anonymous',
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), inningData, { merge: true });
    updateDocumentNonBlocking(matchRef!, { currentInningNumber: 2 });
    setIsSecondInningsSetupOpen(false);
    setActiveInningView(2);
    setSetupPair({ strikerId: '', nonStrikerId: '', bowlerId: '' });
  };

  if (isMatchLoading) return <div className="p-20 text-center">Loading scoreboard...</div>;
  if (!match) return <div className="p-20 text-center">Match data missing.</div>;

  const target = inn1 ? inn1.score + 1 : 0;
  const bowlingSquadIds = activeInningData?.bowlingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds;
  const battingSquadIds = activeInningData?.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds;
  
  const bowlingPool = allPlayers?.filter(p => bowlingSquadIds.includes(p.id)) || [];
  const battingPool = allPlayers?.filter(p => battingSquadIds.includes(p.id)) || [];

  const chasingBattingTeamId = inn1?.battingTeamId === match.team1Id ? match.team2Id : match.team1Id;
  const chasingBowlingTeamId = chasingBattingTeamId === match.team1Id ? match.team2Id : match.team1Id;
  const chasingBattingSquad = chasingBattingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds;
  const chasingBowlingSquad = chasingBowlingTeamId === match.team1Id ? match.team2SquadPlayerIds : match.team1SquadPlayerIds;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="bg-primary text-white p-6 rounded-2xl shadow-xl border-b-8 border-secondary relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy className="w-32 h-32 rotate-12" /></div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
          <div className="text-center md:text-left flex-1">
            <Badge className="bg-white/20 text-white mb-2 uppercase tracking-widest text-[10px]">{activeInningView === 1 ? '1st Innings' : '2nd Innings'}</Badge>
            <h1 className="text-4xl font-black">{activeInningData ? getTeamName(activeInningData.battingTeamId) : '---'}</h1>
          </div>
          <div className="text-center px-10 border-x border-white/10">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-6xl font-black">{activeInningData?.score || 0}</span>
              <span className="text-3xl opacity-50">/ {activeInningData?.wickets || 0}</span>
            </div>
            <p className="text-sm font-bold tracking-widest mt-2 bg-secondary px-3 py-1 rounded-full inline-block">
              {activeInningData?.oversCompleted || 0}.{activeInningData?.ballsInCurrentOver || 0} Overs
            </p>
          </div>
          <div className="text-center md:text-right flex-1">
            {match.status === 'live' ? <Badge variant="destructive" className="animate-pulse mb-2">LIVE SCOREBOARD</Badge> : <Badge className="bg-secondary mb-2">ARCHIVED</Badge>}
            {activeInningView === 2 && inn1 && match.status === 'live' && inn2 && (
              <div className="bg-black/20 p-2 rounded-lg mt-2">
                <p className="text-xs font-bold text-secondary">Target: {target}</p>
                <p className="text-[10px] opacity-80">Need {Math.max(0, target - inn2.score)} runs in {Math.max(0, (match.totalOvers * 6) - (inn2.oversCompleted * 6 + inn2.ballsInCurrentOver))} balls</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeInningView.toString()} onValueChange={(v) => setActiveInningView(parseInt(v))} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[240px] mx-auto bg-muted">
          <TabsTrigger value="1">Innings 1</TabsTrigger>
          <TabsTrigger value="2" disabled={!inn2 && match.currentInningNumber === 1}>Innings 2</TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-6">
          {isUmpire && match.status === 'live' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Scoring Panel</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsBowlerModalOpen(true)}><RefreshCw className="w-4 h-4 mr-1" /> Bowler</Button>
                      <Button variant="outline" size="sm" onClick={handleUndo} disabled={!deliveries || deliveries.length === 0}><Undo2 className="w-4 h-4 mr-1" /> Undo</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {needsOpeningPair ? (
                    <div className="p-12 text-center bg-muted/50 rounded-2xl border-2 border-dashed border-primary/20">
                      <UserCircle className="w-12 h-12 mx-auto mb-4 text-primary opacity-40" />
                      <h3 className="text-lg font-bold mb-2">Innings Ready</h3>
                      <p className="text-sm text-muted-foreground mb-6">Setup the opening pair to start scoring.</p>
                      <Button onClick={() => setIsOpeningPairSetupOpen(true)} className="h-12 px-10 font-bold bg-secondary hover:bg-secondary/90">Initialize Opening Pair</Button>
                    </div>
                  ) : needsNextBatter ? (
                    <div className="p-12 text-center bg-muted/50 rounded-2xl border-2 border-dashed border-destructive/20">
                      <h3 className="text-lg font-bold mb-2">Striker Required</h3>
                      <p className="text-sm text-muted-foreground mb-6">Select the next player to join {getPlayerName(activeInningData?.nonStrikerPlayerId || '')} on field.</p>
                      <div className="max-w-xs mx-auto">
                        <Select onValueChange={handleAssignNextBatter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Next Batter" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">End Innings</SelectItem>
                            {battingSquadIds
                              .filter(pid => pid !== activeInningData?.nonStrikerPlayerId && !dismissedPlayerIds.includes(pid))
                              .map(pid => (
                                <SelectItem key={pid} value={pid}>{getPlayerName(pid)}</SelectItem>
                              ))
                            }
                            {isLastManPossible && activeInningData?.nonStrikerPlayerId && (
                               <SelectItem value={activeInningData.nonStrikerPlayerId}>Last Man Standing: {getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : needsNewBowler ? (
                    <div className="p-8 text-center bg-muted/50 rounded-2xl border-2 border-dashed border-primary/20">
                      <h3 className="text-lg font-bold mb-2">Over Finished</h3>
                      <p className="text-sm text-muted-foreground mb-6">Select the next bowler to continue.</p>
                      <Button onClick={() => setIsBowlerModalOpen(true)} className="h-12 px-10 font-bold">Pick Next Bowler</Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {[0, 1, 2, 3, 4, 6].map((num) => (
                          <Button key={num} size="lg" variant="secondary" disabled={isCurrentInningsOver} onClick={() => handleBall(num)} className="h-16 font-black text-xl hover:bg-primary hover:text-white">{num}</Button>
                        ))}
                        <Button variant="outline" size="lg" disabled={isCurrentInningsOver} className="h-16 font-black border-2 border-secondary text-secondary" onClick={() => handleBall(1)}>1D</Button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Button variant="destructive" size="lg" className="h-16 font-black" disabled={isCurrentInningsOver} onClick={() => setIsWicketModalOpen(true)}>WICKET</Button>
                        <Button variant="outline" size="lg" className="h-16 font-black border-2 border-primary" disabled={isCurrentInningsOver} onClick={() => handleBall(0, false, 'wide')}>WIDE</Button>
                        <Button variant="outline" size="lg" className="h-16 font-black border-2 border-primary" disabled={isCurrentInningsOver} onClick={() => setIsNoBallModalOpen(true)}>NO BALL</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Controls</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-muted-foreground uppercase">Striker</span><span className="text-sm font-bold text-primary truncate max-w-[120px]">{getPlayerName(activeInningData?.strikerPlayerId || '')}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-muted-foreground uppercase">Non-Striker</span><span className="text-sm font-bold truncate max-w-[120px]">{getPlayerName(activeInningData?.nonStrikerPlayerId || '')}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold text-muted-foreground uppercase">Bowling</span><span className="text-sm font-bold text-secondary truncate max-w-[120px]">{getPlayerName(activeInningData?.currentBowlerPlayerId || '')}</span></div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Button variant="outline" className="w-full" disabled={!activeInningData?.strikerPlayerId || !activeInningData?.nonStrikerPlayerId} onClick={() => { if (!activeInningRef || !activeInningData) return; updateDocumentNonBlocking(activeInningRef, { strikerPlayerId: activeInningData.nonStrikerPlayerId, nonStrikerPlayerId: activeInningData.strikerPlayerId }); }}><Shuffle className="w-4 h-4 mr-1" /> Swap Strike</Button>
                  </div>
                  {match.currentInningNumber === 1 ? (
                    <Button className="w-full bg-secondary hover:bg-secondary/90 h-12 font-bold" onClick={() => setIsSecondInningsSetupOpen(true)} disabled={!isCurrentInningsOver}>Start 2nd Innings</Button>
                  ) : (
                    <Button variant="destructive" className="w-full h-12 font-bold" onClick={finalizeMatch} disabled={!isCurrentInningsOver}>Finalize Result</Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Detailed Scorecard Section */}
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="bg-primary/5 py-3 border-b">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-primary" /> Batting - {getTeamName(activeInningData?.battingTeamId || '')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Batter</TableHead>
                      <TableHead className="text-right">R</TableHead>
                      <TableHead className="text-right">B</TableHead>
                      <TableHead className="text-right">4s</TableHead>
                      <TableHead className="text-right">6s</TableHead>
                      <TableHead className="text-right">SR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scorecard.batting.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-bold">{getPlayerName(b.id)}</div>
                          <div className="text-[10px] text-muted-foreground uppercase italic">{b.out ? b.dismissal : 'not out'}</div>
                        </TableCell>
                        <TableCell className="text-right font-black">{b.runs}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{b.balls}</TableCell>
                        <TableCell className="text-right">{b.fours}</TableCell>
                        <TableCell className="text-right">{b.sixes}</TableCell>
                        <TableCell className="text-right font-mono text-[10px]">
                          {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {scorecard.batting.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">No batting stats recorded yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-secondary/5 py-3 border-b">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-secondary" /> Bowling - {getTeamName(activeInningData?.bowlingTeamId || '')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Bowler</TableHead>
                      <TableHead className="text-right">O</TableHead>
                      <TableHead className="text-right">M</TableHead>
                      <TableHead className="text-right">R</TableHead>
                      <TableHead className="text-right">W</TableHead>
                      <TableHead className="text-right">Econ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scorecard.bowling.map((bw: any) => (
                      <TableRow key={bw.id}>
                        <TableCell className="font-bold">{getPlayerName(bw.id)}</TableCell>
                        <TableCell className="text-right font-bold">{Math.floor(bw.legalBalls / 6)}.{bw.legalBalls % 6}</TableCell>
                        <TableCell className="text-right">{bw.maidens}</TableCell>
                        <TableCell className="text-right font-black">{bw.runs}</TableCell>
                        <TableCell className="text-right font-black text-secondary">{bw.wickets}</TableCell>
                        <TableCell className="text-right font-mono text-[10px]">
                          {bw.legalBalls > 0 ? ((bw.runs / (bw.legalBalls / 6))).toFixed(2) : '0.00'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {scorecard.bowling.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">No bowling stats recorded yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-widest">Recent Balls</CardTitle>
                <div className="flex gap-1">
                  {deliveries?.slice(-12).reverse().map((d: any) => (
                    <div key={d.id} className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${d.isWicket ? 'bg-destructive text-white border-destructive' : 'bg-muted border-border'}`}>
                      {d.isWicket ? 'W' : d.totalRunsOnDelivery}
                    </div>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[300px] overflow-y-auto">
                <Table>
                  <TableBody>
                    {deliveries?.slice().reverse().map((d: any) => (
                      <TableRow key={d.id} className="text-[10px]">
                        <TableCell className="font-bold w-12">{d.overNumber}.{d.ballNumberInOver}</TableCell>
                        <TableCell>{getPlayerName(d.strikerPlayerId)} vs {getPlayerName(d.bowlerPlayerId)}</TableCell>
                        <TableCell className="text-right font-black">{d.outcomeDescription}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>

      <Dialog open={isOpeningPairSetupOpen} onOpenChange={setIsOpeningPairSetupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Initialize Match Players</DialogTitle><DialogDescription>Select starting players to begin scoring this innings.</DialogDescription></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Striker</Label><Select onValueChange={(v) => setSetupPair({...setupPair, strikerId: v})}><SelectTrigger><SelectValue placeholder="Striker" /></SelectTrigger><SelectContent>{battingPool.filter(p => p.id !== setupPair.nonStrikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Non-Striker</Label><Select onValueChange={(v) => setSetupPair({...setupPair, nonStrikerId: v})}><SelectTrigger><SelectValue placeholder="Non-Striker" /></SelectTrigger><SelectContent>{battingPool.filter(p => p.id !== setupPair.strikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Opening Bowler</Label><Select onValueChange={(v) => setSetupPair({...setupPair, bowlerId: v})}><SelectTrigger><SelectValue placeholder="Select Bowler" /></SelectTrigger><SelectContent>{bowlingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button className="w-full h-12 font-bold bg-secondary" onClick={handleOpeningPairConfirm} disabled={!setupPair.strikerId || !setupPair.nonStrikerId || !setupPair.bowlerId}>Confirm & Start Scoring</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSecondInningsSetupOpen} onOpenChange={setIsSecondInningsSetupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Setup 2nd Innings</DialogTitle><DialogDescription>Select starting lineup for the chasing team.</DialogDescription></DialogHeader>
          <div className="space-y-6 py-4">
             <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Striker</Label><Select onValueChange={(v) => setSetupPair({...setupPair, strikerId: v})}><SelectTrigger><SelectValue placeholder="Select Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => chasingBattingSquad.includes(p.id) && p.id !== setupPair.nonStrikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Non-Striker</Label><Select onValueChange={(v) => setSetupPair({...setupPair, nonStrikerId: v})}><SelectTrigger><SelectValue placeholder="Select Non-Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => chasingBattingSquad.includes(p.id) && p.id !== setupPair.strikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Opening Bowler</Label><Select onValueChange={(v) => setSetupPair({...setupPair, bowlerId: v})}><SelectTrigger><SelectValue placeholder="Select Bowler" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => chasingBowlingSquad.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button className="w-full h-12 font-bold bg-secondary" onClick={initInningsTwo} disabled={!setupPair.strikerId || !setupPair.nonStrikerId || !setupPair.bowlerId}>Start 2nd Innings</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoBallModalOpen} onOpenChange={setIsNoBallModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>No Ball Extras</DialogTitle><DialogDescription>Were any runs scored off the bat?</DialogDescription></DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-4">{[0, 1, 2, 3, 4, 6].map((num) => <Button key={num} variant="outline" className="h-16 text-xl font-bold" onClick={() => handleBall(num, false, 'noball')}>{num} Runs</Button>)}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketModalOpen} onOpenChange={setIsWicketModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Wicket Confirmation</DialogTitle><DialogDescription>Details for dismissal of {getPlayerName(activeInningData?.strikerPlayerId || '')}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Dismissal Type</Label><Select value={wicketDetails.type} onValueChange={(v) => setWicketDetails({...wicketDetails, type: v, fielderId: 'none'})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumping">Stumping</SelectItem><SelectItem value="hit wicket">Hit Wicket</SelectItem></SelectContent></Select></div>
            {['caught', 'runout', 'stumping'].includes(wicketDetails.type) && (
              <div className="space-y-2"><Label>Fielder Involved</Label><Select value={wicketDetails.fielderId} onValueChange={(v) => setWicketDetails({...wicketDetails, fielderId: v})}><SelectTrigger><SelectValue placeholder="Pick fielder" /></SelectTrigger><SelectContent>{bowlingPool.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            )}
            <div className="space-y-2">
              <Label>Next Batter (or Last Man Standing)</Label>
              <Select value={wicketDetails.newStrikerId} onValueChange={(v) => setWicketDetails({...wicketDetails, newStrikerId: v})}>
                <SelectTrigger><SelectValue placeholder="Pick next batter or end" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No More Batsmen (End Innings)</SelectItem>
                  {isLastManPossible ? (
                    <SelectItem value={activeInningData?.nonStrikerPlayerId || 'none'}>Last Man Standing: {getPlayerName(activeInningData?.nonStrikerPlayerId || '')}</SelectItem>
                  ) : (
                    battingSquadIds.filter(pid => pid !== activeInningData?.nonStrikerPlayerId && pid !== activeInningData?.strikerPlayerId && !dismissedPlayerIds.includes(pid)).map(pid => (
                      <SelectItem key={pid} value={pid}>{getPlayerName(pid)}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="destructive" className="w-full h-12" onClick={() => handleBall(0, true)} disabled={!wicketDetails.newStrikerId || (['caught', 'runout', 'stumping'].includes(wicketDetails.type) && wicketDetails.fielderId === 'none')}>Confirm Wicket</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBowlerModalOpen} onOpenChange={setIsBowlerModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Bowler</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Select Bowler</Label><Select value={selectedNextBowlerId} onValueChange={setSelectedNextBowlerId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{bowlingPool.filter(p => p.id !== (deliveries?.[deliveries.length - 1]?.bowlerPlayerId || '')).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button className="w-full h-12 font-bold" onClick={handleNextBowlerSelect} disabled={!selectedNextBowlerId || selectedNextBowlerId === 'none'}>Confirm Bowler</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
