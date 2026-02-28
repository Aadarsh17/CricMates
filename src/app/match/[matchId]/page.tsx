
"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, writeBatch, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Trophy, Undo2, CheckCircle2, AlertCircle, Shuffle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    query(collection(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords'), orderBy('timestamp', 'desc')), 
    [db, matchId, activeInningView]
  );
  const { data: deliveries } = useCollection(deliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const [isWicketModalOpen, setIsWicketModalOpen] = useState(false);
  const [wicketDetails, setWicketDetails] = useState({
    type: 'bowled',
    newStrikerId: ''
  });

  const getPlayerName = (pid: string) => {
    const p = allPlayers?.find(p => p.id === pid);
    return p ? p.name : 'Unknown Player';
  };

  const getTeamName = (tid: string) => {
    const t = allTeams?.find(t => t.id === tid);
    return t ? t.name : 'Unknown Team';
  };

  const isCurrentInningsOver = activeInningData && match && (
    activeInningData.wickets >= 10 || 
    (activeInningData.oversCompleted >= match.totalOvers) ||
    (activeInningView === 2 && inn1 && activeInningData.score > inn1.score)
  );

  const handleBall = (runs: number, isWicket = false, extra: 'none' | 'wide' | 'noball' = 'none') => {
    if (!isUmpire || match?.status !== 'live' || !activeInningData || !activeInningRef || isCurrentInningsOver) {
      return;
    }

    const currentInning = activeInningData;
    let runsForThisBall = runs;
    if (extra !== 'none') runsForThisBall += 1;

    let newStriker = currentInning.strikerPlayerId;
    let newNonStriker = currentInning.nonStrikerPlayerId;

    if (!newStriker || !newNonStriker) {
      toast({ title: "Batsmen Missing", description: "Select openers first.", variant: "destructive" });
      return;
    }

    // Strike rotation for odd runs
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
        // Strike rotation at over end
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
      strikerPlayerId: currentInning.strikerPlayerId,
      bowlerPlayerId: currentInning.currentBowlerPlayerId,
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
    
    let finalStriker = isWicket ? wicketDetails.newStrikerId : newStriker;
    let finalNonStriker = newNonStriker;

    // Correct strike if over ended and wicket fell
    if (isWicket && isOverEnd) {
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

  const handleMainUndo = () => {
    if (confirm("Reset current match setup? All scoring progress will be lost.")) {
      window.location.href = '/match/new';
    }
  };

  const finalizeMatch = async () => {
    if (!isUmpire || !match || !inn1 || !inn2) return;

    const batch = writeBatch(db);
    
    // Calculate final stats
    const playerStats: Record<string, { runs: number, wickets: number, balls: number, dots: number }> = {};
    const teamStats: Record<string, { runs: number, wickets: number, won: boolean }> = {
      [match.team1Id]: { runs: inn1.score, wickets: inn1.wickets, won: false },
      [match.team2Id]: { runs: inn2.score, wickets: inn2.wickets, won: false }
    };

    const fetchDeliveries = async (innId: string) => {
      const q = query(collection(db, 'matches', matchId, 'innings', innId, 'deliveryRecords'));
      const snap = await getDocs(q);
      snap.forEach(d => {
        const data = d.data();
        if (!playerStats[data.strikerPlayerId]) playerStats[data.strikerPlayerId] = { runs: 0, wickets: 0, balls: 0, dots: 0 };
        if (!playerStats[data.bowlerPlayerId]) playerStats[data.bowlerPlayerId] = { runs: 0, wickets: 0, balls: 0, dots: 0 };
        
        playerStats[data.strikerPlayerId].runs += data.runsScored;
        playerStats[data.strikerPlayerId].balls += (data.extraType === 'none' ? 1 : 0);
        if (data.runsScored === 0 && data.extraType === 'none') playerStats[data.strikerPlayerId].dots += 1;
        
        if (data.isWicket && data.dismissalType !== 'runout') {
          playerStats[data.bowlerPlayerId].wickets += 1;
        }
      });
    };

    await fetchDeliveries('inning_1');
    await fetchDeliveries('inning_2');

    // Update global player rankings
    Object.keys(playerStats).forEach(pid => {
      const p = allPlayers?.find(ap => ap.id === pid);
      if (p) {
        const stats = playerStats[pid];
        batch.update(doc(db, 'players', pid), {
          runsScored: (p.runsScored || 0) + stats.runs,
          wicketsTaken: (p.wicketsTaken || 0) + stats.wickets,
          matchesPlayed: (p.matchesPlayed || 0) + 1,
          careerCVP: (p.careerCVP || 0) + (stats.runs + (stats.wickets * 15))
        });
      }
    });

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

  if (isMatchLoading) return <div className="p-20 text-center">Loading scorecard...</div>;
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
            <Badge className="bg-white/20 text-white mb-2 uppercase tracking-widest text-[10px]">
              {activeInningView === 1 ? '1st Innings' : '2nd Innings'}
            </Badge>
            <h1 className="text-4xl font-black">{activeInningData ? getTeamName(activeInningData.battingTeamId) : '---'}</h1>
            <p className="text-xs opacity-70 mt-1">Vs {activeInningData ? getTeamName(activeInningData.bowlingTeamId) : '---'}</p>
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
                    Req: {Math.max(0, target - inn2.score)} in {Math.max(0, (match.totalOvers * 6) - (inn2.oversCompleted * 6 + inn2.ballsInCurrentOver))} balls
                  </p>
                )}
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

        <div className="mt-6">
          {isUmpire && match.status === 'live' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Scoring Panel</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleUndo} disabled={!deliveries || deliveries.length === 0}>
                        <Undo2 className="w-4 h-4 mr-1" /> Undo Ball
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
                <CardHeader>
                  <CardTitle className="text-lg">Controls</CardTitle>
                  <Button variant="destructive" size="sm" onClick={handleMainUndo} className="w-full mt-2">
                    Main Undo (Reset)
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">STRIKER</span>
                      <span className="text-sm font-bold text-primary">{activeInningData ? getPlayerName(activeInningData.strikerPlayerId) : '---'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">NON-STRIKE</span>
                      <span className="text-sm font-bold">{activeInningData ? getPlayerName(activeInningData.nonStrikerPlayerId) : '---'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground">BOWLER</span>
                      <span className="text-sm font-bold text-secondary">{activeInningData ? getPlayerName(activeInningData.currentBowlerPlayerId) : '---'}</span>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => {
                    if (!activeInningRef || !activeInningData) return;
                    updateDocumentNonBlocking(activeInningRef, {
                      strikerPlayerId: activeInningData.nonStrikerPlayerId,
                      nonStrikerPlayerId: activeInningData.strikerPlayerId
                    });
                  }}>
                    <Shuffle className="w-4 h-4 mr-1" /> Swap Ends
                  </Button>

                  {match.currentInningNumber === 1 ? (
                    <Button 
                      className="w-full bg-secondary hover:bg-secondary/90 h-12 font-bold" 
                      onClick={() => {
                        if (!inn1) return;
                        const battingTeamId = inn1.battingTeamId === match.team1Id ? match.team2Id : match.team1Id;
                        const bowlingTeamId = inn1.battingTeamId === match.team1Id ? match.team1Id : match.team2Id;
                        const inningData = {
                          id: 'inning_2',
                          matchId,
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
                      }}
                      disabled={!isCurrentInningsOver}
                    >
                      Start 2nd Innings
                    </Button>
                  ) : (
                    <Button 
                      variant="destructive" 
                      className="w-full h-12 font-bold" 
                      onClick={finalizeMatch}
                      disabled={!isCurrentInningsOver}
                    >
                      Finalize Match
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-muted-foreground">
                {match.status === 'completed' ? 'This match is completed.' : 'Scorecard is read-only for guests.'}
              </p>
            </Card>
          )}

          <Card className="mt-6">
            <CardHeader className="py-4">
              <CardTitle className="text-sm">Over Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deliveries?.map((d) => (
                  <div key={d.id} className="flex items-center gap-4 p-3 bg-muted/20 rounded-lg border-l-4 border-primary">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs shrink-0">
                      {d.overNumber}.{d.ballNumberInOver}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{d.outcomeDescription}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {getPlayerName(d.strikerPlayerId)} off {getPlayerName(d.bowlerPlayerId)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Tabs>

      <Dialog open={isWicketModalOpen} onOpenChange={setIsWicketModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wicket Details</DialogTitle>
            <DialogDescription>Confirm dismissal for {activeInningData ? getPlayerName(activeInningData.strikerPlayerId) : 'batsman'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
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
              <Label>Next Batter</Label>
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
            <Button variant="destructive" onClick={() => handleBall(0, true)} disabled={!wicketDetails.newStrikerId}>Confirm Wicket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
