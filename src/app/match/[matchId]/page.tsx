
"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, limit, deleteDoc, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Trophy, History as HistoryIcon, Undo2, Users, ArrowRightLeft, UserMinus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
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

  const team1Ref = useMemoFirebase(() => match ? doc(db, 'teams', match.team1Id) : null, [db, match]);
  const { data: team1 } = useDoc(team1Ref);

  const team2Ref = useMemoFirebase(() => match ? doc(db, 'teams', match.team2Id) : null, [db, match]);
  const { data: team2 } = useDoc(team2Ref);

  const inningId = `inning_${match?.currentInningNumber || 1}`;
  const inningRef = useMemoFirebase(() => match ? doc(db, 'matches', matchId, 'innings', inningId) : null, [db, matchId, inningId]);
  const { data: inning } = useDoc(inningRef);

  const deliveriesQuery = useMemoFirebase(() => query(collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords'), orderBy('timestamp', 'desc')), [db, matchId, inningId]);
  const { data: deliveries } = useCollection(deliveriesQuery);

  // Wicket Modal State
  const [isWicketModalOpen, setIsWicketModalOpen] = useState(false);
  const [wicketDetails, setWicketDetails] = useState({
    type: 'bowled',
    fielderId: '',
    playerOutId: ''
  });

  const handleBall = (runs: number, isWicket = false, extra: 'none' | 'wide' | 'noball' = 'none') => {
    if (!isUmpire || match?.status !== 'live' || !inning) return;

    let runsForThisBall = runs;
    if (extra !== 'none') runsForThisBall += 1;

    // Strike Rotation Logic
    // In cricket, strike changes on odd runs or at end of over
    let newStriker = inning.strikerPlayerId;
    let newNonStriker = inning.nonStrikerPlayerId;

    if (runs % 2 !== 0) {
      const temp = newStriker;
      newStriker = newNonStriker;
      newNonStriker = temp;
    }

    let isOverEnd = false;
    let newOvers = inning.oversCompleted;
    let newBalls = inning.ballsInCurrentOver;

    if (extra === 'none') {
      if (inning.ballsInCurrentOver === 5) {
        isOverEnd = true;
        newOvers += 1;
        newBalls = 0;
        // Swap strike at end of over
        const temp = newStriker;
        newStriker = newNonStriker;
        newNonStriker = temp;
      } else {
        newBalls += 1;
      }
    }

    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords')).id;
    const deliveryData = {
      id: deliveryId,
      inningId,
      matchId,
      overNumber: newOvers + (isOverEnd ? 0 : 1),
      ballNumberInOver: extra === 'none' ? (isOverEnd ? 6 : newBalls) : inning.ballsInCurrentOver,
      strikerPlayerId: inning.strikerPlayerId || 'unknown',
      bowlerPlayerId: inning.currentBowlerPlayerId || 'unknown',
      runsScored: runs,
      isWicket,
      extraType: extra,
      extraRuns: extra !== 'none' ? 1 : 0,
      totalRunsOnDelivery: runsForThisBall,
      outcomeDescription: isWicket ? 'Wicket!' : `${runsForThisBall} runs`,
      dismissalType: isWicket ? wicketDetails.type : 'none',
      timestamp: new Date().toISOString(),
      umpireId: user?.uid,
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    updateDocumentNonBlocking(inningRef!, {
      score: inning.score + runsForThisBall,
      wickets: isWicket ? inning.wickets + 1 : inning.wickets,
      oversCompleted: newOvers,
      ballsInCurrentOver: newBalls,
      strikerPlayerId: newStriker || '',
      nonStrikerPlayerId: newNonStriker || ''
    });

    if (isWicket) setIsWicketModalOpen(false);
  };

  const handleUndo = async () => {
    if (!deliveries || deliveries.length === 0 || !inningRef) return;
    const lastBall = deliveries[0];
    
    // Reverse the logic (Simplified for prototype)
    updateDocumentNonBlocking(inningRef, {
      score: inning?.score! - lastBall.totalRunsOnDelivery,
      wickets: lastBall.isWicket ? inning?.wickets! - 1 : inning?.wickets!,
      // Overs reverse logic would be more complex, but for MVP we decrement ball count
      ballsInCurrentOver: inning?.ballsInCurrentOver === 0 ? 5 : inning?.ballsInCurrentOver! - 1,
      oversCompleted: inning?.ballsInCurrentOver === 0 ? inning?.oversCompleted! - 1 : inning?.oversCompleted!
    });

    const ballDoc = doc(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords', lastBall.id);
    deleteDoc(ballDoc);
    toast({ title: "Ball Revoked", description: "The last delivery has been removed." });
  };

  const completeMatch = () => {
    if (!isUmpire || !matchRef) return;
    updateDocumentNonBlocking(matchRef, { status: 'completed', resultDescription: 'Match finished' });
    toast({ title: "Match Finalized", description: "Stats archived." });
    router.push('/matches');
  };

  if (isMatchLoading) return <div className="p-20 text-center">Loading live dashboard...</div>;
  if (!match) return <div className="p-20 text-center">Match data unavailable.</div>;

  const battingTeam = inning?.battingTeamId === match.team1Id ? team1 : team2;
  const bowlingTeam = inning?.battingTeamId === match.team1Id ? team2 : team1;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Score Header */}
      <div className="bg-primary text-white p-6 rounded-2xl shadow-xl border-b-8 border-secondary">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left flex-1">
            <Badge className="bg-white/20 text-white mb-2 uppercase tracking-tighter">Batting</Badge>
            <h1 className="text-4xl font-black">{battingTeam?.name}</h1>
            <p className="text-xs opacity-70 mt-1">vs {bowlingTeam?.name}</p>
          </div>
          
          <div className="text-center px-8 border-x border-white/10">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-6xl font-black">{inning?.score || 0}</span>
              <span className="text-3xl opacity-50">/ {inning?.wickets || 0}</span>
            </div>
            <p className="text-sm font-bold tracking-widest mt-2 bg-secondary px-3 py-1 rounded-full inline-block">
              Overs {inning?.oversCompleted || 0}.{inning?.ballsInCurrentOver || 0}
            </p>
          </div>

          <div className="text-center md:text-right flex-1">
            <Badge variant="destructive" className="animate-pulse mb-2">LIVE</Badge>
            <p className="text-sm font-bold opacity-70">Target: {match.currentInningNumber === 2 ? '---' : 'TBD'}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="console" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto bg-muted">
          <TabsTrigger value="console">Scoring</TabsTrigger>
          <TabsTrigger value="squad">Players</TabsTrigger>
          <TabsTrigger value="history">Ball Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="console" className="mt-6 space-y-6">
          {isUmpire && match.status === 'live' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Ball Controls</CardTitle>
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
                        onClick={() => handleBall(num)}
                        className="h-14 font-black text-xl hover:bg-primary hover:text-white"
                      >
                        {num}
                      </Button>
                    ))}
                    <Button variant="outline" size="lg" className="h-14 font-black border-2 border-secondary text-secondary" onClick={() => handleBall(1)}>
                      1D
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="destructive" size="lg" className="h-14 font-black" onClick={() => setIsWicketModalOpen(true)}>
                      WICKET
                    </Button>
                    <Button variant="outline" size="lg" className="h-14 font-black border-2 border-primary" onClick={() => handleBall(0, false, 'wide')}>
                      WIDE
                    </Button>
                    <Button variant="outline" size="lg" className="h-14 font-black border-2 border-primary" onClick={() => handleBall(0, false, 'noball')}>
                      NO BALL
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">In-Game Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start h-12">
                    <ArrowRightLeft className="mr-2 w-4 h-4 text-secondary" /> Swap Batsmen
                  </Button>
                  <Button variant="outline" className="w-full justify-start h-12">
                    <UserMinus className="mr-2 w-4 h-4 text-destructive" /> Retire Player
                  </Button>
                  <Button variant="destructive" className="w-full h-12 mt-6 font-bold" onClick={completeMatch}>
                    End Match
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed border-2">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">The scoring console is available only for the match Umpire.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="squad" className="mt-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card>
               <CardHeader className="bg-primary/5">
                 <CardTitle className="text-sm font-bold">Batting XI</CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-2">
                 {match.team1SquadPlayerIds.map(pid => (
                   <div key={pid} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                     <span className="text-sm font-medium">{pid.slice(0, 8)}</span>
                     {inning?.strikerPlayerId === pid && <Badge className="bg-secondary">Striker</Badge>}
                   </div>
                 ))}
               </CardContent>
             </Card>
             <Card>
               <CardHeader className="bg-secondary/5">
                 <CardTitle className="text-sm font-bold">Bowling XI</CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-2">
                 {match.team2SquadPlayerIds.map(pid => (
                   <div key={pid} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                     <span className="text-sm font-medium">{pid.slice(0, 8)}</span>
                     {inning?.currentBowlerPlayerId === pid && <Badge className="bg-primary">Bowling</Badge>}
                   </div>
                 ))}
               </CardContent>
             </Card>
           </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
           <Card>
             <CardHeader>
               <CardTitle>Delivery Log</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-3">
                 {deliveries?.map((d, idx) => (
                   <div key={d.id} className="flex items-center gap-4 p-3 border-b last:border-0 hover:bg-muted/30 transition-colors">
                     <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                       {d.overNumber}.{d.ballNumberInOver}
                     </div>
                     <div className="flex-1">
                        <p className="font-bold">{d.outcomeDescription}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{d.extraType !== 'none' ? d.extraType : 'Legal Ball'}</p>
                     </div>
                     <div className="text-right text-[10px] text-muted-foreground">
                       {new Date(d.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </div>
                   </div>
                 ))}
                 {(!deliveries || deliveries.length === 0) && (
                   <div className="text-center py-10 opacity-50 italic">No balls bowled yet.</div>
                 )}
               </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Wicket Modal */}
      <Dialog open={isWicketModalOpen} onOpenChange={setIsWicketModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wicket Fall Details</DialogTitle>
            <DialogDescription>Specify the dismissal type and players involved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Wicket Type</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWicketModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleBall(0, true)}>Confirm Wicket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
