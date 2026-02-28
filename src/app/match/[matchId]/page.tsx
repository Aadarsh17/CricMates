
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, getDocs, increment } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Undo2, Shuffle, RefreshCw, Star, UserCircle, ChevronRight, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

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

  const dismissedPlayerIds = useMemo(() => {
    return Array.from(new Set(deliveries?.filter(d => d.isWicket && d.batsmanOutPlayerId && d.batsmanOutPlayerId !== 'none').map(d => d.batsmanOutPlayerId) || []));
  }, [deliveries]);

  // Enhanced Scorecard Aggregation
  const scorecard = useMemo(() => {
    if (!deliveries) return { batting: [], bowling: [], extras: { wide: 0, noball: 0, byes: 0, legbyes: 0, total: 0 } };

    const battingMap: Record<string, any> = {};
    const bowlingMap: Record<string, any> = {};
    const extras = { wide: 0, noball: 0, byes: 0, legbyes: 0, total: 0 };

    deliveries.forEach((d: any) => {
      // Extras
      if (d.extraType !== 'none') {
        const type = d.extraType as keyof typeof extras;
        if (extras[type] !== undefined) {
          extras[type] += d.extraRuns;
          extras.total += d.extraRuns;
        }
      }

      // Batting Stats
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

      // Non-striker could be out (e.g. Run out)
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

  const didNotBatPlayers = useMemo(() => {
    if (!match || !activeInningData || !scorecard.batting) return [];
    const squad = activeInningData.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds;
    const battingIds = scorecard.batting.map(b => b.id);
    const onField = [activeInningData.strikerPlayerId, activeInningData.nonStrikerPlayerId];
    return squad.filter(pid => !battingIds.includes(pid) && !onField.includes(pid));
  }, [match, activeInningData, scorecard.batting]);

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
  const [setupPair, setSetupPair] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });

  const isCurrentInningsOver = !!(activeInningData && match && (
    activeInningData.wickets >= 10 || 
    (activeInningData.oversCompleted >= match.totalOvers) ||
    (activeInningView === 2 && inn1 && activeInningData.score > inn1.score)
  ));

  const needsNewBowler = activeInningData?.ballsInCurrentOver === 0 && activeInningData?.oversCompleted > 0 && activeInningData?.oversCompleted < (match?.totalOvers || 0) && !activeInningData?.currentBowlerPlayerId;
  const isStartingInnings = activeInningData && activeInningData.oversCompleted === 0 && activeInningData.ballsInCurrentOver === 0 && activeInningData.wickets === 0;
  const needsOpeningPair = isStartingInnings && (!activeInningData?.strikerPlayerId || !activeInningData?.currentBowlerPlayerId);
  const needsNextBatter = activeInningData && !activeInningData.strikerPlayerId && !isCurrentInningsOver && !isStartingInnings;

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
      outcomeDescription: isWicket ? 'WICKET!' : `${runsForThisBall}${extra !== 'none' ? ` (${extra})` : ''}`,
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

  const target = inn1 ? inn1.score + 1 : 0;
  const currentBattingTeamId = activeInningData?.battingTeamId || '';
  const battingSquadIds = currentBattingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds;
  const bowlingSquadIds = currentBattingTeamId === match.team1Id ? match.team2SquadPlayerIds : match.team1SquadPlayerIds;
  const battingPool = allPlayers?.filter(p => battingSquadIds.includes(p.id)) || [];
  const bowlingPool = allPlayers?.filter(p => bowlingSquadIds.includes(p.id)) || [];

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20">
      {/* Match Header Info (Excluding highlighted metadata) */}
      <div className="border-b bg-white p-4">
        <h1 className="text-xl font-bold text-slate-900">
          {getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}
        </h1>
        <div className="text-xs text-blue-600 font-bold mt-1 uppercase tracking-tight">
          {match.resultDescription}
        </div>
      </div>

      {/* Tabs Menu (Info, Live, Scorecard, Squads, Points Table, Overs) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full justify-start overflow-x-auto border-b rounded-none bg-transparent h-auto p-0 scrollbar-hide">
          <TabsTrigger value="info" className="px-4 py-2 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent data-[state=active]:text-secondary">Info</TabsTrigger>
          <TabsTrigger value="live" className="px-4 py-2 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent data-[state=active]:text-secondary">Live</TabsTrigger>
          <TabsTrigger value="scorecard" className="px-4 py-2 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent data-[state=active]:text-secondary">Scorecard</TabsTrigger>
          <TabsTrigger value="squads" className="px-4 py-2 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent data-[state=active]:text-secondary">Squads</TabsTrigger>
          <TabsTrigger value="points-table" className="px-4 py-2 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent data-[state=active]:text-secondary">Points Table</TabsTrigger>
          <TabsTrigger value="overs" className="px-4 py-2 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent data-[state=active]:text-secondary">Overs</TabsTrigger>
        </TabsList>

        <TabsContent value="scorecard" className="mt-4 space-y-6">
          <div className="flex gap-2 mb-4">
            <Button variant={activeInningView === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(1)} className="rounded-full text-[10px] font-bold h-7">Innings 1</Button>
            <Button variant={activeInningView === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setActiveInningView(2)} className="rounded-full text-[10px] font-bold h-7" disabled={!inn2 && match.currentInningNumber === 1}>Innings 2</Button>
          </div>

          {activeInningData && (
            <div className="space-y-4">
              {/* Team Score Header */}
              <div className="bg-primary text-white p-3 flex justify-between items-center rounded-sm">
                <span className="font-bold text-sm uppercase">{getTeamName(activeInningData.battingTeamId)}</span>
                <span className="font-black text-sm">{activeInningData.score}-{activeInningData.wickets} ({activeInningData.oversCompleted}.{activeInningData.ballsInCurrentOver} Ov)</span>
              </div>

              {/* Batting Table */}
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
                          <div className="text-blue-600 font-bold text-xs">{getPlayerName(b.id)}</div>
                          <div className="text-[9px] text-slate-400 font-medium italic">{b.dismissal}</div>
                        </TableCell>
                        <TableCell className="text-right font-black text-xs">{b.runs}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.balls}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.fours}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.sixes}</TableCell>
                        <TableCell className="text-right text-slate-500 text-xs">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : '0.00'}</TableCell>
                      </TableRow>
                    ))}
                    {/* Extras Row */}
                    <TableRow className="bg-slate-50/30">
                      <TableCell className="text-xs font-bold">Extras</TableCell>
                      <TableCell colSpan={5} className="text-xs font-bold text-right">
                        {scorecard.extras.total} (b {scorecard.extras.byes || 0}, lb {scorecard.extras.legbyes || 0}, w {scorecard.extras.wide || 0}, nb {scorecard.extras.noball || 0}, p 0)
                      </TableCell>
                    </TableRow>
                    {/* Total Row */}
                    <TableRow className="bg-slate-50">
                      <TableCell className="text-xs font-bold">Total</TableCell>
                      <TableCell colSpan={5} className="text-xs font-black text-right">
                        {activeInningData.score}-{activeInningData.wickets} ({activeInningData.oversCompleted} Overs, RR: {activeInningData.oversCompleted > 0 ? (activeInningData.score / activeInningData.oversCompleted).toFixed(1) : '0.0'})
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Did not bat section */}
              {didNotBatPlayers.length > 0 && (
                <div className="p-3 border-t bg-white">
                  <span className="text-[10px] font-black uppercase text-slate-400 mr-4">Did not Bat</span>
                  <div className="inline-flex flex-wrap gap-2 mt-1">
                    {didNotBatPlayers.map((pid, idx) => (
                      <span key={pid} className="text-xs text-blue-600 font-medium">
                        {getPlayerName(pid)}{idx < didNotBatPlayers.length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Bowling Table */}
              <div className="bg-white border rounded-sm overflow-hidden mt-6">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase text-slate-500">Bowler</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">O</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">M</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">R</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">W</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">NB</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase text-slate-500">WD</TableHead>
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
                        <TableCell className="text-right text-xs text-slate-500">{bw.noballs}</TableCell>
                        <TableCell className="text-right text-xs text-slate-500">{bw.wides}</TableCell>
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

        {/* Umpire Scoring Controls (Only visible in Live tab or specific scoring state) */}
        <TabsContent value="live">
          {isUmpire && match.status === 'live' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 border-none shadow-none bg-slate-50/50">
                <CardHeader className="py-2 px-4 flex flex-row items-center justify-between bg-white border-b">
                  <CardTitle className="text-xs uppercase font-black text-slate-400">Scoring Engine</CardTitle>
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
                <CardHeader className="py-2 px-4 bg-white border-b"><CardTitle className="text-xs uppercase font-black text-slate-400">Match Status</CardTitle></CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="bg-white p-3 rounded border text-xs space-y-2">
                    <div className="flex justify-between"><span>Striker</span><span className="font-bold">{getPlayerName(activeInningData?.strikerPlayerId || '')}</span></div>
                    <div className="flex justify-between"><span>Non-Striker</span><span className="font-bold">{getPlayerName(activeInningData?.nonStrikerPlayerId || '')}</span></div>
                    <div className="flex justify-between"><span>Bowler</span><span className="font-bold text-secondary">{getPlayerName(activeInningData?.currentBowlerPlayerId || '')}</span></div>
                  </div>
                  {activeInningView === 2 && inn1 && (
                    <div className="bg-blue-50 p-3 rounded border border-blue-100 text-center">
                      <p className="text-[10px] uppercase font-bold text-blue-400">Target</p>
                      <p className="text-2xl font-black text-blue-600">{target}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals for Umpire Actions */}
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
          <DialogHeader><DialogTitle>Wicket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={wicketDetails.type} onValueChange={(v) => setWicketDetails({...wicketDetails, type: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumping">Stumping</SelectItem><SelectItem value="hit wicket">Hit Wicket</SelectItem></SelectContent></Select>
            <Select onValueChange={(v) => setWicketDetails({...wicketDetails, newStrikerId: v})}><SelectTrigger><SelectValue placeholder="Next Batter"/></SelectTrigger><SelectContent><SelectItem value="none">End Innings</SelectItem>{battingSquadIds.filter(id => !dismissedPlayerIds.includes(id) && id !== activeInningData?.strikerPlayerId).map(id => <SelectItem key={id} value={id}>{getPlayerName(id)}</SelectItem>)}</SelectContent></Select>
          </div>
          <DialogFooter><Button variant="destructive" onClick={() => handleBall(0, true)}>Confirm Wicket</Button></DialogFooter>
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
