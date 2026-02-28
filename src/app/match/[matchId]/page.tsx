
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserCircle, Info, Users, Flag, ChevronDown, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);

  const [activeInningView, setActiveInningView] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>('scorecard');

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

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('netRunRate', 'desc')), [db]);
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
    if (!deliveries) return { batting: [], bowling: [], extras: { wide: 0, noball: 0, byes: 0, legbyes: 0, total: 0 } };

    const battingMap: Record<string, any> = {};
    const bowlingMap: Record<string, any> = {};
    const extras = { wide: 0, noball: 0, byes: 0, legbyes: 0, total: 0 };

    deliveries.forEach((d: any) => {
      if (d.extraType !== 'none') {
        const type = d.extraType as keyof typeof extras;
        if (extras[type] !== undefined) {
          extras[type] += d.extraRuns;
          extras.total += d.extraRuns;
        }
      }

      if (d.strikerPlayerId && d.strikerPlayerId !== 'none') {
        if (!battingMap[d.strikerPlayerId]) {
          battingMap[d.strikerPlayerId] = { id: d.strikerPlayerId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: 'not out' };
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
    });

    return {
      batting: Object.values(battingMap),
      bowling: Object.values(bowlingMap),
      extras
    };
  }, [deliveries]);

  const oversSummary = useMemo(() => {
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
  }, [deliveries]);

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
      color = 'bg-[#e91e63]'; // Pinkish-Red for W
      label = 'W';
    } else if (ball.extraType === 'wide') {
      color = 'bg-[#fbc02d]'; // Gold for Extras
      label = 'Wd';
    } else if (ball.extraType === 'noball') {
      color = 'bg-[#fbc02d]';
      label = 'NB';
    } else if (ball.runsScored === 4) {
      color = 'bg-[#0091ca]'; // Blue for 4
      label = '4';
    } else if (ball.runsScored === 6) {
      color = 'bg-[#9c27b0]'; // Purple for 6
      label = '6';
    } else if (ball.runsScored > 0) {
      color = 'bg-[#8bc34a]'; // Green for 1,2,3
      label = ball.runsScored.toString();
    }

    return (
      <div className={cn("w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-bold text-white", color)}>
        {label}
      </div>
    );
  };

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
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Match</span><span className="font-black text-slate-900">{getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)} • {match.status === 'live' ? 'LIVE' : 'Match History'}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Date</span><span className="font-medium text-slate-900">{formatDateIST(match.matchDate)}</span></div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Time</span><span className="font-medium text-slate-900">{formatTimeIST(match.matchDate)}</span></div>
                <div className="flex p-4">
                  <span className="w-32 font-bold text-slate-500">Toss</span>
                  <span className="font-medium text-slate-900">
                    {match.tossWinnerTeamId ? `${getTeamName(match.tossWinnerTeamId)} won the toss and opt to ${match.tossDecision === 'bat' ? 'Bat' : 'Bowl'}` : '---'}
                  </span>
                </div>
                <div className="flex p-4"><span className="w-32 font-bold text-slate-500">Venue</span><span className="font-medium text-slate-900">Dumping Ground nalasopara west</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-6 mt-4">
          <div className="bg-white p-6 rounded-sm border shadow-sm space-y-6">
            <div className="text-blue-600 font-bold text-sm">
              {match.resultDescription}
            </div>

            <div className="space-y-4">
              {inn1 && (
                <div className="flex justify-between items-center">
                  <span className="font-black text-2xl text-slate-800 tracking-tight">
                    {getAbbr(getTeamName(match.team1Id))} {inn1.score}/{inn1.wickets} <span className="text-slate-400 font-bold">({inn1.oversCompleted}.{inn1.ballsInCurrentOver})</span>
                  </span>
                </div>
              )}
              {inn2 && (
                <div className="flex justify-between items-center">
                  <span className="font-black text-2xl text-slate-800 tracking-tight">
                    {getAbbr(getTeamName(match.team2Id))} {inn2.score}/{inn2.wickets} <span className="text-slate-400 font-bold">({inn2.oversCompleted}.{inn2.ballsInCurrentOver})</span>
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

        <TabsContent value="scorecard" className="mt-4 space-y-6">
          <div className="flex gap-2 mb-4">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-bold h-7">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-bold h-7" disabled={!inn2 && match.currentInningNumber === 1}>Innings 2</Button>
          </div>

          <div className="text-blue-600 font-bold text-xs mb-2">{match.resultDescription}</div>

          {activeInningData && (
            <div className="space-y-4">
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
                        {scorecard.extras.total} (b {scorecard.extras.byes || 0}, lb {scorecard.extras.legbyes || 0}, w {scorecard.extras.wide || 0}, nb {scorecard.extras.noball || 0}, p 0)
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-100/50">
                      <TableCell className="text-xs font-black">Total</TableCell>
                      <TableCell colSpan={5} className="text-xs font-black text-right">
                        {activeInningData.score}-{activeInningData.wickets} ({activeInningData.oversCompleted}.{activeInningData.ballsInCurrentOver} Ov, RR: {(activeInningData.score / (activeInningData.oversCompleted + (activeInningData.ballsInCurrentOver / 6)) || 0).toFixed(1)})
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {didNotBatPlayers.length > 0 && (
                <div className="p-4 bg-slate-50 border rounded-sm flex gap-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Did not Bat</span>
                  <div className="flex flex-wrap gap-2">
                    {didNotBatPlayers.map(pid => (
                      <span key={pid} className="text-[10px] font-bold text-blue-600">{getPlayerName(pid)}</span>
                    ))}
                  </div>
                </div>
              )}

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
               <div className="bg-[#7c3aed] text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase">
                  CHAMPIONSHIP GROUP 1
               </div>
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
                {allTeams?.map((team, idx) => {
                  const played = team.matchesWon + team.matchesLost + team.matchesDrawn;
                  const points = (team.matchesWon * 2) + team.matchesDrawn;
                  return (
                    <TableRow key={team.id} className="hover:bg-slate-50 group border-b last:border-0">
                      <TableCell className="text-center font-bold text-xs text-slate-500 py-3">{idx + 1}</TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-6 w-6 rounded-sm">
                            <AvatarImage src={team.logoUrl} />
                            <AvatarFallback className="bg-slate-100 rounded-sm"><Flag className="w-3 h-3 text-slate-300" /></AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-blue-600 text-xs">
                            {team.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-900">{played}</TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-900">{team.matchesWon}</TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-900">{team.matchesLost}</TableCell>
                      <TableCell className="text-center text-xs font-medium text-slate-900">{team.matchesDrawn}</TableCell>
                      <TableCell className="text-center text-xs font-black text-slate-900">{points}</TableCell>
                      <TableCell className="text-right text-xs font-bold pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-slate-900">
                            {team.netRunRate > 0 ? '+' : ''}{team.netRunRate.toFixed(3)}
                          </span>
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

        <TabsContent value="overs" className="mt-4 space-y-2">
          {oversSummary.length > 0 ? (
            oversSummary.map((over) => (
              <div key={over.overNumber} className="bg-white p-4 border rounded-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="w-full md:w-32">
                  <p className="text-sm font-black text-slate-900">Over {over.overNumber} <span className="text-slate-400 font-bold ml-1">- {over.runs} runs</span></p>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-tight">
                    {getAbbr(getTeamName(activeInningData?.battingTeamId || ''))} {over.scoreAtEnd}
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
            ))
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-sm bg-slate-50">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No overs completed yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
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
