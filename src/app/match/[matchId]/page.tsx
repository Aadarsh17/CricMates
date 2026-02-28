"use client"

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { doc, collection, query, orderBy, limit, setDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Trophy, History as HistoryIcon, Undo2, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { toast } from '@/hooks/use-toast';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);

  const team1Ref = useMemoFirebase(() => match ? doc(db, 'teams', match.team1Id) : null, [db, match]);
  const { data: team1 } = useDoc(team1Ref);

  const team2Ref = useMemoFirebase(() => match ? doc(db, 'teams', match.team2Id) : null, [db, match]);
  const { data: team2 } = useDoc(team2Ref);

  // Inning handling (Simple MVP: tracking local state for immediate feedback, then syncing)
  const [score, setScore] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [overs, setOvers] = useState(0);
  const [balls, setBalls] = useState(0);

  const handleBall = (runs: number, isWicket = false, extra: 'none' | 'wide' | 'noball' = 'none') => {
    if (!isUmpire || match?.status !== 'live') return;

    let runsForThisBall = runs;
    if (extra !== 'none') runsForThisBall += 1;

    setScore(prev => prev + runsForThisBall);
    if (isWicket) setWickets(prev => prev + 1);

    if (extra === 'none') {
      if (balls === 5) {
        setOvers(prev => prev + 1);
        setBalls(0);
      } else {
        setBalls(prev => prev + 1);
      }
    }

    // Logic to record deliveryRecord in Firestore
    const inningId = `inning_${match?.currentInningNumber}`;
    const deliveryId = doc(collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords')).id;
    
    const deliveryData = {
      id: deliveryId,
      inningId,
      matchId,
      overNumber: overs + 1,
      ballNumberInOver: balls + 1,
      strikerPlayerId: 'unknown',
      bowlerPlayerId: 'unknown',
      runsScored: runs,
      isWicket,
      extraType: extra,
      extraRuns: extra !== 'none' ? 1 : 0,
      totalRunsOnDelivery: runsForThisBall,
      outcomeDescription: isWicket ? 'Wicket!' : `${runsForThisBall} runs`,
      dismissalType: isWicket ? 'bowled' : 'none',
      timestamp: new Date().toISOString(),
      umpireId: user?.uid,
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords', deliveryId), deliveryData, { merge: true });
    
    // Update Inning summary doc (Simple denormalization for MVP)
    const inningRef = doc(db, 'matches', matchId, 'innings', inningId);
    updateDocumentNonBlocking(inningRef, {
      score: score + runsForThisBall,
      wickets: isWicket ? wickets + 1 : wickets,
      oversCompleted: balls === 5 ? overs + 1 : overs,
      ballsInCurrentOver: balls === 5 ? 0 : balls + 1
    });
  };

  const completeMatch = () => {
    if (!isUmpire) return;
    updateDocumentNonBlocking(matchRef, { status: 'completed', resultDescription: 'Match finished' });
    toast({ title: "Match Completed", description: "The stats have been archived." });
  };

  const formatDateTime = (dateString: string) => {
    if (!isMounted) return '';
    return new Date(dateString).toLocaleString();
  };

  if (isMatchLoading) return <div className="p-20 text-center">Loading live data...</div>;
  if (!match) return <div className="p-20 text-center">Match data unavailable.</div>;

  const isLive = match.status === 'live';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-primary text-white p-6 rounded-2xl shadow-xl">
        <div className="text-center md:text-left flex-1">
          <p className="text-4xl font-black mb-1">{team1?.name || 'Loading...'}</p>
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Batting Inning 1</p>
        </div>
        <div className="text-5xl font-black flex flex-col items-center">
          <div className="flex items-baseline gap-2">
            <span>{score}</span>
            <span className="text-2xl opacity-50">/ {wickets}</span>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] mt-2 opacity-80">
            Overs {overs}.{balls}
          </p>
        </div>
        <div className="text-center md:text-right flex-1">
          <p className="text-4xl font-black mb-1">{team2?.name || 'Loading...'}</p>
          <Badge className="bg-white/20 text-white border-none uppercase text-[10px]">{match.status}</Badge>
        </div>
      </div>

      <Tabs defaultValue="scoring" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="scoring">Scoring Console</TabsTrigger>
          <TabsTrigger value="scorecard">Full Scorecard</TabsTrigger>
        </TabsList>

        <TabsContent value="scoring" className="mt-6">
          {isLive && isUmpire ? (
            <Card className="border-t-4 border-t-secondary">
              <CardHeader className="text-center">
                <CardTitle>Official Umpire Interface</CardTitle>
                <CardDescription>Real-time ball-by-ball inputs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {[0, 1, 2, 3, 4, 6].map((num) => (
                    <Button 
                      key={num} 
                      size="lg" 
                      onClick={() => handleBall(num)}
                      className="h-16 text-xl font-bold bg-muted hover:bg-primary hover:text-white text-foreground"
                    >
                      {num}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-14 border-2 border-destructive text-destructive font-black" onClick={() => handleBall(0, true)}>
                    WICKET
                  </Button>
                  <Button variant="outline" className="h-14 border-2 border-secondary text-secondary font-black" onClick={() => handleBall(0, false, 'wide')}>
                    WIDE
                  </Button>
                  <Button variant="outline" className="h-14 border-2 border-secondary text-secondary font-black" onClick={() => handleBall(0, false, 'noball')}>
                    NO BALL
                  </Button>
                  <Button variant="outline" className="h-14 border-2">
                    <Undo2 className="mr-2 h-4 w-4" /> UNDO
                  </Button>
                </div>

                <div className="pt-6 border-t">
                  <Button variant="destructive" className="w-full h-12 font-bold" onClick={completeMatch}>
                    Declare & Complete Match
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">Scoring console is only available for active Umpires.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scorecard" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Match Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg flex justify-between items-center">
                  <p className="font-bold">Date & Time</p>
                  <p className="text-sm">{formatDateTime(match.matchDate)}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg flex justify-between items-center">
                  <p className="font-bold">Format</p>
                  <p className="text-sm">{match.totalOvers} Overs T20</p>
                </div>
                <div className="p-4 bg-muted rounded-lg flex justify-between items-center">
                  <p className="font-bold">Result</p>
                  <p className="text-sm text-secondary font-bold">{match.resultDescription || 'Ongoing'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}