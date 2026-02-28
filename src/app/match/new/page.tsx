
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { PlayCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function NewMatchPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [setup, setSetup] = useState({
    team1Id: '',
    team2Id: '',
    team1Squad: [] as string[],
    team2Squad: [] as string[],
    totalOvers: '20',
    tossWinner: '',
    tossDecision: 'bat',
    strikerId: '',
    nonStrikerId: '',
    bowlerId: ''
  });

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('name', 'asc')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const team1Players = allPlayers?.filter(p => p.teamId === setup.team1Id || !p.teamId);
  const team2Players = allPlayers?.filter(p => p.teamId === setup.team2Id || !p.teamId);

  const handleStartMatch = () => {
    if (!setup.strikerId || !setup.nonStrikerId || !setup.bowlerId) {
      toast({ title: "Opening Pair Missing", description: "Select openers and a bowler to begin.", variant: "destructive" });
      return;
    }

    if (setup.strikerId === setup.nonStrikerId) {
      toast({ title: "Invalid Selection", description: "Striker and Non-Striker must be different players.", variant: "destructive" });
      return;
    }

    const matchId = doc(collection(db, 'matches')).id;
    const matchData = {
      id: matchId,
      team1Id: setup.team1Id,
      team2Id: setup.team2Id,
      team1SquadPlayerIds: setup.team1Squad,
      team2SquadPlayerIds: setup.team2Squad,
      totalOvers: parseInt(setup.totalOvers),
      status: 'live',
      tossWinnerTeamId: setup.tossWinner,
      tossDecision: setup.tossDecision,
      currentInningNumber: 1,
      matchDate: new Date().toISOString(),
      umpireId: user?.uid || 'anonymous',
      resultDescription: 'Match In Progress'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId), matchData, { merge: true });
    
    const inningId = 'inning_1';
    const battingTeamId = setup.tossWinner === setup.team1Id 
      ? (setup.tossDecision === 'bat' ? setup.team1Id : setup.team2Id)
      : (setup.tossDecision === 'bat' ? setup.team2Id : setup.team1Id);
    
    const bowlingTeamId = battingTeamId === setup.team1Id ? setup.team2Id : setup.team1Id;

    const inningData = {
      id: inningId,
      matchId: matchId,
      inningNumber: 1,
      battingTeamId,
      bowlingTeamId,
      score: 0,
      wickets: 0,
      oversCompleted: 0,
      ballsInCurrentOver: 0,
      strikerPlayerId: setup.strikerId,
      nonStrikerPlayerId: setup.nonStrikerId,
      currentBowlerPlayerId: setup.bowlerId,
      umpireId: user?.uid || 'anonymous',
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), inningData, { merge: true });
    
    toast({ title: "Play Ball!", description: "Match has been initialized." });
    router.push(`/match/${matchId}`);
  };

  const battingSquad = setup.tossWinner === setup.team1Id 
    ? (setup.tossDecision === 'bat' ? setup.team1Squad : setup.team2Squad)
    : (setup.tossDecision === 'bat' ? setup.team2Squad : setup.team1Squad);

  const bowlingSquad = setup.tossWinner === setup.team1Id 
    ? (setup.tossDecision === 'bat' ? setup.team2Squad : setup.team1Squad)
    : (setup.tossDecision === 'bat' ? setup.team1Squad : setup.team2Squad);

  if (!isUmpire) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <ShieldCheck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Umpire Access Only</h2>
        <p className="text-muted-foreground mb-6">Officiating tools are reserved for registered Umpires.</p>
        <Button variant="outline" onClick={() => router.push('/')}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <PlayCircle className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold font-headline">Initialize Match</h1>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`w-8 h-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card className="shadow-lg border-t-4 border-primary">
          <CardHeader>
            <CardTitle>1. Opponents & Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Team 1 (Home)</Label>
                <Select value={setup.team1Id} onValueChange={(v) => setSetup({...setup, team1Id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Home Team" /></SelectTrigger>
                  <SelectContent>
                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team 2 (Away)</Label>
                <Select value={setup.team2Id} onValueChange={(v) => setSetup({...setup, team2Id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Away Team" /></SelectTrigger>
                  <SelectContent>
                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Overs per Innings</Label>
              <Input type="number" value={setup.totalOvers} onChange={(e) => setSetup({...setup, totalOvers: e.target.value})} />
            </div>
            <Button className="w-full h-12" disabled={!setup.team1Id || !setup.team2Id} onClick={() => setStep(2)}>
              Select Squads
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="shadow-lg border-t-4 border-primary">
          <CardHeader>
            <CardTitle>2. Squad Selection</CardTitle>
            <CardDescription>Select at least 2 players for each team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold border-b pb-2">Team 1 Players</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-muted/30 rounded-lg">
                  {team1Players?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`t1-${p.id}`} 
                        checked={setup.team1Squad.includes(p.id)} 
                        onCheckedChange={(checked) => {
                          const newSquad = checked 
                            ? [...setup.team1Squad, p.id] 
                            : setup.team1Squad.filter(id => id !== p.id);
                          setSetup({...setup, team1Squad: newSquad});
                        }} 
                      />
                      <Label htmlFor={`t1-${p.id}`} className="text-sm">{p.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-bold border-b pb-2">Team 2 Players</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-muted/30 rounded-lg">
                  {team2Players?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`t2-${p.id}`} 
                        checked={setup.team2Squad.includes(p.id)} 
                        onCheckedChange={(checked) => {
                          const newSquad = checked 
                            ? [...setup.team2Squad, p.id] 
                            : setup.team2Squad.filter(id => id !== p.id);
                          setSetup({...setup, team2Squad: newSquad});
                        }} 
                      />
                      <Label htmlFor={`t2-${p.id}`} className="text-sm">{p.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" disabled={setup.team1Squad.length < 2 || setup.team2Squad.length < 2} onClick={() => setStep(3)}>Next: Toss</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="shadow-lg border-t-4 border-primary">
          <CardHeader>
            <CardTitle>3. Toss & Decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Toss Winner</Label>
                <Select value={setup.tossWinner} onValueChange={(v) => setSetup({...setup, tossWinner: v})}>
                  <SelectTrigger><SelectValue placeholder="Winner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={setup.team1Id}>{teams?.find(t => t.id === setup.team1Id)?.name}</SelectItem>
                    <SelectItem value={setup.team2Id}>{teams?.find(t => t.id === setup.team2Id)?.name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={setup.tossDecision} onValueChange={(v) => setSetup({...setup, tossDecision: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bat">Bat First</SelectItem>
                    <SelectItem value="bowl">Bowl First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" disabled={!setup.tossWinner} onClick={() => setStep(4)}>Finalize Openers</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="shadow-lg border-t-4 border-primary">
          <CardHeader>
            <CardTitle>4. Opening Pair</CardTitle>
            <CardDescription>Select the starting batsmen and bowler.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Striker</Label>
                  <Select value={setup.strikerId} onValueChange={(v) => setSetup({...setup, strikerId: v})}>
                    <SelectTrigger><SelectValue placeholder="Opening Batter" /></SelectTrigger>
                    <SelectContent>
                      {allPlayers?.filter(p => battingSquad.includes(p.id) && p.id !== setup.nonStrikerId).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Non-Striker</Label>
                  <Select value={setup.nonStrikerId} onValueChange={(v) => setSetup({...setup, nonStrikerId: v})}>
                    <SelectTrigger><SelectValue placeholder="Partner" /></SelectTrigger>
                    <SelectContent>
                      {allPlayers?.filter(p => battingSquad.includes(p.id) && p.id !== setup.strikerId).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Opening Bowler</Label>
                <Select value={setup.bowlerId} onValueChange={(v) => setSetup({...setup, bowlerId: v})}>
                  <SelectTrigger><SelectValue placeholder="First Bowler" /></SelectTrigger>
                  <SelectContent>
                    {allPlayers?.filter(p => bowlingSquad.includes(p.id)).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Back</Button>
              <Button className="flex-1 bg-secondary hover:bg-secondary/90 h-12 font-bold" onClick={handleStartMatch}>
                START MATCH <CheckCircle2 className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
