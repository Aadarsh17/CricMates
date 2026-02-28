
"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Trophy, Undo2, CheckCircle2, AlertCircle, RotateCcw, Shuffle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
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

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

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
    query(collection(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords'), orderBy('timestamp', 'desc')), 
    [db, matchId, activeInningView]
  );
  const { data: deliveries } = useCollection(deliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const [isWicketModalOpen, setIsWicketModalOpen] = useState(false);
  const [wicketDetails, setWicketDetails] = useState({
    type: 'bowled',
    newStrikerId: ''
  });

  const getPlayerName = (pid: string) => {
    return allPlayers?.find(p => p.id === pid)?.name || '---';
  };

  const getTeamName = (tid: string) => {
    return allTeams?.find(t => t.id === tid)?.name || '---';
  };

  const isCurrentInningsOver = activeInningData && match && (
    activeInningData.wickets >= 10 || 
    (activeInningData.oversCompleted >= match.totalOvers) ||
    (activeInningView === 2 && inn1 && activeInningData.score > inn1.score)
  );

  const handleBall = (runs: number, isWicket = false, extra: 'none' | 'wide' | 'noball' = 'none') => {
    if (!isUmpire || match?.status !== 'live' || !activeInningData || !activeInningRef || isCurrentInningsOver) {
      if (isCurrentInningsOver) {
        toast({ title: "Innings Over", description: "Overs limit reached or all wickets fallen.", variant: "destructive" });
      }
      return;
    }

    const currentInning = activeInningData;
    let runsForThisBall = runs;
    if (extra !== 'none') runsForThisBall += 1;

    let newStriker = currentInning.strikerPlayerId;
    let newNonStriker = currentInning.nonStrikerPlayerId;

    // Safety: ensure they aren't the same
    if (newStriker === newNonStriker) {
      toast({ title: "Striker Conflict", description: "Striker and Non-Striker cannot be the same. Please Swap first.", variant: "destructive" });
      return;
    }

    // Strike rotation for runs
    if (runs % 2 !== 0) {
      const temp = newStriker;
      newStriker = newNonStriker;
      newNonStriker = temp;
    }

    let isOverEnd = false;
    let newOvers = currentInning.oversCompleted;
    let newBalls = currentInning.ballsInCurrentOver;

    if (extra === 'none') {
      if (currentInning.ballsInCurrentOver === 5) {
        isOverEnd = true;
        newOvers += 1;
        newBalls = 0;
        // Strike rotation for over end
        const temp = newStriker;
        newStriker = newNonStriker;
        newNonStriker = temp;
      } else {
        newBalls += 1;
      }
    }

    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords')).id;
    const deliveryData = {
      id: deliveryId,
      inningId: `inning_${activeInningView}`,
      matchId,
      overNumber: currentInning.oversCompleted,
      ballNumberInOver: extra === 'none' ? (newBalls === 0 ? 6 : newBalls) : currentInning.ballsInCurrentOver,
      strikerPlayerId: currentInning.strikerPlayerId || 'unknown',
      bowlerPlayerId: currentInning.currentBowlerPlayerId || 'unknown',
      runsScored: runs,
      isWicket,
      extraType: extra,
      extraRuns: extra !== 'none' ? 1 : 0,
      totalRunsOnDelivery: runsForThisBall,
      outcomeDescription: isWicket ? 'WICKET!' : `${runsForThisBall}${extra !== 'none' ? ` (${extra})` : ''}`,
      dismissalType: isWicket ? wicketDetails.type : 'none',
      timestamp: new Date().toISOString(),
      umpireId: user?.uid || 'anonymous',
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    // If wicket falls and over ends, the NEW batter goes to the non-striker end for the next over
    // and the original non-striker faces the next over.
    let finalStriker = isWicket ? wicketDetails.newStrikerId : newStriker;
    let finalNonStriker = newNonStriker;

    // Correct rotation if wicket falls on last ball
    if (isWicket && isOverEnd) {
      // Wicket falls -> new batter in (finalStriker).
      // Then Over ends -> ends switch.
      // So finalNonStriker becomes the striker for next over.
      const temp = finalStriker;
      finalStriker = finalNonStriker;
      finalNonStriker = temp;
    }

    updateDocumentNonBlocking(activeInningRef, {
      score: currentInning.score + runsForThisBall,
      wickets: isWicket ? currentInning.wickets + 1 : currentInning.wickets,
      oversCompleted: newOvers,
      ballsInCurrentOver: newBalls,
      strikerPlayerId: finalStriker || '',
      nonStrikerPlayerId: finalNonStriker || ''
    });

    if (isWicket) {
      setIsWicketModalOpen(false);
      setWicketDetails({ type: 'bowled', newStrikerId: '' });
    }
  };

  const handleSwap = () => {
    if (!isUmpire || !activeInningRef || !activeInningData) return;
    updateDocumentNonBlocking(activeInningRef, {
      strikerPlayerId: activeInningData.nonStrikerPlayerId,
      nonStrikerPlayerId: activeInningData.strikerPlayerId
    });
    toast({ title: "Strike Swapped", description: "Batsmen have swapped ends." });
  };

  const handleMainUndo = () => {
    if (confirm("This will reset the match setup and take you back to the initialization page. Are you sure?")) {
      router.push('/match/new');
    }
  };

  const handleUndo = () => {
    if (!deliveries || deliveries.length === 0 || !activeInningRef || !activeInningData) return;
    const lastBall = deliveries[0];
    
    const wasOverEnd = lastBall.ballNumberInOver === 6 && lastBall.extraType === 'none';

    updateDocumentNonBlocking(activeInningRef, {
      score: Math.max(0, activeInningData.score - lastBall.totalRunsOnDelivery),
      wickets: lastBall.isWicket ? Math.max(0, activeInningData.wickets - 1) : activeInningData.wickets,
      ballsInCurrentOver: lastBall.extraType === 'none' ? (wasOverEnd ? 5 : lastBall.ballNumberInOver - 1) : activeInningData.ballsInCurrentOver,
      oversCompleted: wasOverEnd ? activeInningData.oversCompleted - 1 : activeInningData.oversCompleted,
      strikerPlayerId: lastBall.strikerPlayerId,
    });

    deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords', lastBall.id));
    toast({ title: "Undo Successful", description: "Last delivery removed." });
  };

  const startSecondInnings = () => {
    if (!isUmpire || !match || !inn1) return;
    
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
      umpireId: user?.uid || 'anonymous',
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), inningData, { merge: true });
    updateDocumentNonBlocking(matchRef!, { currentInningNumber: 2 });
    setActiveInningView(2);
    toast({ title: "Innings Break", description: "Target set. Second innings ready." });
  };

  const finalizeMatch = async () => {
    if (!isUmpire || !match || !inn1 || !inn2) return;

    const batch = writeBatch(db);
    
    let result = "Match Drawn";
    if (inn2.score > inn1.score) {
      result = `${getTeamName(inn2.battingTeamId)} won by ${10 - inn2.wickets} wickets`;
    } else if (inn1.score > inn2.score) {
      result = `${getTeamName(inn1.battingTeamId)} won by ${inn1.score - inn2.score} runs`;
    }

    batch.update(matchRef!, { status: 'completed', resultDescription: result });
    await batch.commit();

    toast({ title: "Match Finalized", description: result });
    router.push('/matches');
  };

  if (isMatchLoading) return <div className="p-20 text-center">Loading live scorecard...</div>;
  if (!match) return <div className="p-20 text-center">Match not found.</div>;

  const target = inn1 ? inn1.score + 1 : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-primary text-white p-6 rounded-2xl shadow-xl border-b-8 border-secondary relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Trophy className="w-32 h-32 rotate-12" />
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
          <div className="text-center md:text-left flex-1">
            <Badge className="bg-white/20 text-white mb-2">
              {activeInningView === 1 ? '1st INNINGS' : '2nd INNINGS'}
            </Badge>
            <h1 className="text-4xl font-black">{activeInningData ? getTeamName(activeInningData.battingTeamId) : '---'}</h1>
            <p className="text-xs opacity-70 mt-1">Bowling: {activeInningData ? getTeamName(activeInningData.bowlingTeamId) : '---'}</p>
          </div>
          
          <div className="text-center px-10 border-x border-white/10">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-6xl font-black">{activeInningData?.score || 0}</span>
              <span className="text-3xl opacity-50">/ {activeInningData?.wickets || 0}</span>
            </div>
            <p className="text-sm font-bold tracking-widest mt-2 bg-secondary px-3 py-1 rounded-full inline-block">
              Overs {activeInningData?.oversCompleted || 0}.{activeInningData?.ballsInCurrentOver || 0}
            </p>
          </div>

          <div className="text-center md:text-right flex-1">
            {match.status === 'live' ? (
              <Badge variant="destructive" className="animate-pulse mb-2">LIVE</Badge>
            ) : (
              <Badge className="bg-secondary mb-2">COMPLETED</Badge>
            )}
            
            {activeInningView === 2 && inn1 && (
              <div className="bg-black/20 p-2 rounded-lg mt-2">
                <p className="text-xs font-bold text-secondary">Target: {target}</p>
                {match.status === 'live' && inn2 && (
                  <p className="text-[10px] opacity-80">
                    Req: {Math.max(0, target - inn2.score)} from {Math.max(0, (match.totalOvers * 6) - (inn2.oversCompleted * 6 + inn2.ballsInCurrentOver))} balls
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeInningView.toString()} onValueChange={(v) => setActiveInningView(parseInt(v))} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[200px] mx-auto bg-muted">
          <TabsTrigger value="1">Innings 1</TabsTrigger>
          <TabsTrigger value="2" disabled={!inn2 && match.currentInningNumber === 1}>Innings 2</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {isUmpire && match.status === 'live' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Scoring Console</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleUndo} disabled={!deliveries || deliveries.length === 0}>
                        <Undo2 className="w-4 h-4 mr-1" /> Undo
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {[0, 1, 2, 3, 4, 6].map((num) => (
                      <Button 
                        key={num} 
                        size="lg" 
                        variant="secondary"
                        disabled={isCurrentInningsOver}
                        onClick={() => handleBall(num)}
                        className="h-16 font-black text-xl hover:bg-primary hover:text-white"
                      >
                        {num}
                      </Button>
                    ))}
                    <Button 
                      variant="outline" 
                      size="lg" 
                      disabled={isCurrentInningsOver}
                      className="h-16 font-black border-2 border-secondary text-secondary" 
                      onClick={() => handleBall(1)}
                    >
                      1D
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Button 
                      variant="destructive" 
                      size="lg" 
                      className="h-16 font-black" 
                      disabled={isCurrentInningsOver}
                      onClick={() => setIsWicketModalOpen(true)}
                    >
                      WICKET
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="h-16 font-black border-2 border-primary" 
                      disabled={isCurrentInningsOver}
                      onClick={() => handleBall(0, false, 'wide')}
                    >
                      WIDE
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="h-16 font-black border-2 border-primary" 
                      disabled={isCurrentInningsOver}
                      onClick={() => handleBall(0, false, 'noball')}
                    >
                      NO BALL
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Innings Logic</CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleMainUndo} title="Reset Match Setup">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase">On Strike</span>
                      <span className="text-sm font-bold text-primary truncate max-w-[120px]">{activeInningData ? getPlayerName(activeInningData.strikerPlayerId) : '---'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Non-Strike</span>
                      <span className="text-sm font-bold truncate max-w-[120px]">{activeInningData ? getPlayerName(activeInningData.nonStrikerPlayerId) : '---'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Bowling</span>
                      <span className="text-sm font-bold text-secondary truncate max-w-[120px]">{activeInningData ? getPlayerName(activeInningData.currentBowlerPlayerId) : '---'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleSwap}>
                      <Shuffle className="w-4 h-4 mr-1" /> Swap
                    </Button>
                  </div>

                  {match.currentInningNumber === 1 ? (
                    <Button 
                      className="w-full bg-secondary hover:bg-secondary/90 h-12 font-bold" 
                      onClick={startSecondInnings}
                      disabled={!isCurrentInningsOver && activeInningData && activeInningData.wickets < 10 && activeInningData.oversCompleted < match.totalOvers}
                    >
                      End 1st Innings <Activity className="ml-2 w-4 h-4" />
                    </Button>
                  ) : (
                    <Button 
                      variant="destructive" 
                      className="w-full h-12 font-bold" 
                      onClick={finalizeMatch}
                      disabled={!isCurrentInningsOver}
                    >
                      Finalize Match <CheckCircle2 className="ml-2 w-4 h-4" />
                    </Button>
                  )}
                  
                  <p className="text-[10px] text-center text-muted-foreground italic flex items-center justify-center">
                    <AlertCircle className="w-3 h-3 mr-1" /> Umpire can edit any inning before Finalizing.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed border-2">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-muted-foreground">
                {match.status === 'completed' ? 'This match has been finalized.' : 'Scorecard is read-only for Guest mode.'}
              </p>
            </Card>
          )}

          <Card className="mt-6">
            <CardHeader className="py-4">
              <CardTitle className="text-sm">Ball-by-Ball Timeline (Innings {activeInningView})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deliveries?.map((d) => (
                  <div key={d.id} className="flex items-center gap-4 p-3 bg-muted/20 rounded-lg border-l-4 border-primary/20">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs shrink-0">
                      {d.overNumber}.{d.ballNumberInOver}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{d.outcomeDescription}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {getPlayerName(d.strikerPlayerId)} vs {getPlayerName(d.bowlerPlayerId)}
                      </p>
                    </div>
                    {isUmpire && match.status === 'live' && d.id === deliveries[0].id && (
                      <Button variant="ghost" size="icon" onClick={handleUndo} className="h-8 w-8 text-destructive">
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {(!deliveries || deliveries.length === 0) && (
                  <div className="text-center py-10 opacity-40 italic">Waiting for first ball...</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </Tabs>

      <Dialog open={isWicketModalOpen} onOpenChange={setIsWicketModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wicket Confirmation</DialogTitle>
            <DialogDescription>Select dismissal details for {activeInningData ? getPlayerName(activeInningData.strikerPlayerId) : 'batsman'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dismissal Type</Label>
              <Select value={wicketDetails.type} onValueChange={(v) => setWicketDetails({...wicketDetails, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bowled">Bowled</SelectItem>
                  <SelectItem value="caught">Caught</SelectItem>
                  <SelectItem value="runout">Run Out</SelectItem>
                  <SelectItem value="stumping">Stumping</SelectItem>
                  <SelectItem value="lbw">LBW</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select New Batter</Label>
              <Select onValueChange={(v) => setWicketDetails({...wicketDetails, newStrikerId: v})}>
                <SelectTrigger><SelectValue placeholder="Select from Squad" /></SelectTrigger>
                <SelectContent>
                  {(activeInningData?.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds)
                    .filter(pid => pid !== activeInningData?.nonStrikerPlayerId && pid !== activeInningData?.strikerPlayerId)
                    .map(pid => (
                      <SelectItem key={pid} value={pid}>{getPlayerName(pid)}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWicketModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleBall(0, true)} disabled={!wicketDetails.newStrikerId}>Confirm Wicket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
