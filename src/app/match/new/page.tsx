
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { PlayCircle, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

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
    commonPlayerId: 'none',
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

  const team1Pool = allPlayers?.filter(p => p.teamId === setup.team1Id || !p.teamId);
  const team2Pool = allPlayers?.filter(p => p.teamId === setup.team2Id || !p.teamId);

  const handleStartMatch = () => {
    if (!setup.strikerId || !setup.nonStrikerId || !setup.bowlerId) {
      toast({ title: "Validation Error", description: "All starting positions must be filled.", variant: "destructive" });
      return;
    }

    const matchId = doc(collection(db, 'matches')).id;
    const hasCommon = setup.commonPlayerId && setup.commonPlayerId !== 'none';
    const finalT1Squad = hasCommon ? [...setup.team1Squad, setup.commonPlayerId] : setup.team1Squad;
    const finalT2Squad = hasCommon ? [...setup.team2Squad, setup.commonPlayerId] : setup.team2Squad;

    const matchData = {
      id: matchId,
      team1Id: setup.team1Id,
      team2Id: setup.team2Id,
      team1SquadPlayerIds: finalT1Squad,
      team2SquadPlayerIds: finalT2Squad,
      totalOvers: parseInt(setup.totalOvers),
      status: 'live',
      tossWinnerTeamId: setup.tossWinner,
      tossDecision: setup.tossDecision,
      currentInningNumber: 1,
      matchDate: new Date().toISOString(),
      umpireId: user?.uid || 'anonymous',
      resultDescription: 'Match in Progress'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId), matchData, { merge: true });
    
    const battingTeamId = setup.tossWinner === setup.team1Id 
      ? (setup.tossDecision === 'bat' ? setup.team1Id : setup.team2Id)
      : (setup.tossDecision === 'bat' ? setup.team2Id : setup.team1Id);
    
    const bowlingTeamId = battingTeamId === setup.team1Id ? setup.team2Id : setup.team1Id;

    const inningData = {
      id: 'inning_1',
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

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_1'), inningData, { merge: true });
    
    toast({ title: "Play Ball!", description: "Match has been initialized successfully." });
    router.push(`/match/${matchId}`);
  };

  const currentBattingSquadIds = setup.tossWinner === setup.team1Id 
    ? (setup.tossDecision === 'bat' ? setup.team1Squad : setup.team2Squad)
    : (setup.tossDecision === 'bat' ? setup.team2Squad : setup.team1Squad);
  
  const currentBowlingSquadIds = setup.tossWinner === setup.team1Id 
    ? (setup.tossDecision === 'bat' ? setup.team2Squad : setup.team1Squad)
    : (setup.tossDecision === 'bat' ? setup.team1Squad : setup.team2Squad);

  const battingPlayers = allPlayers?.filter(p => currentBattingSquadIds.includes(p.id) || (setup.commonPlayerId !== 'none' && p.id === setup.commonPlayerId)) || [];
  const bowlingPlayers = allPlayers?.filter(p => currentBowlingSquadIds.includes(p.id) || (setup.commonPlayerId !== 'none' && p.id === setup.commonPlayerId)) || [];

  if (!isUmpire) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <ShieldCheck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Umpire Role Required</h2>
        <Button onClick={() => router.push('/')}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlayCircle className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold font-headline tracking-tight text-primary">Official Match Setup</h1>
        </div>
      </div>

      {step === 1 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl">Step 1: Teams & Format</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Team 1 (Home)</Label>
                <Select value={setup.team1Id} onValueChange={(v) => setSetup({...setup, team1Id: v})}>
                  <SelectTrigger><SelectValue placeholder="Pick a team" /></SelectTrigger>
                  <SelectContent>
                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team 2 (Away)</Label>
                <Select value={setup.team2Id} onValueChange={(v) => setSetup({...setup, team2Id: v})}>
                  <SelectTrigger><SelectValue placeholder="Pick a team" /></SelectTrigger>
                  <SelectContent>
                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Match Length (Overs)</Label>
              <Input type="number" value={setup.totalOvers} onChange={(e) => setSetup({...setup, totalOvers: e.target.value})} />
            </div>
            <Button className="w-full h-12 text-lg font-bold" disabled={!setup.team1Id || !setup.team2Id} onClick={() => setStep(2)}>
              Configure Squads <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl">Step 2: Squad Selection</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl">
                <h3 className="font-bold border-b border-primary/20 pb-2 text-primary">{teams?.find(t => t.id === setup.team1Id)?.name}</h3>
                {team1Pool?.map(p => (
                  <div key={p.id} className="flex items-center gap-2 hover:bg-white/50 p-1 rounded transition-colors">
                    <Checkbox checked={setup.team1Squad.includes(p.id)} onCheckedChange={(c) => {
                      const newSquad = c ? [...setup.team1Squad, p.id] : setup.team1Squad.filter(id => id !== p.id);
                      setSetup({...setup, team1Squad: newSquad});
                    }} id={`t1-${p.id}`} />
                    <Label htmlFor={`t1-${p.id}`} className="text-sm cursor-pointer font-medium">{p.name}</Label>
                  </div>
                ))}
              </div>
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl">
                <h3 className="font-bold border-b border-primary/20 pb-2 text-primary">{teams?.find(t => t.id === setup.team2Id)?.name}</h3>
                {team2Pool?.map(p => (
                  <div key={p.id} className="flex items-center gap-2 hover:bg-white/50 p-1 rounded transition-colors">
                    <Checkbox checked={setup.team2Squad.includes(p.id)} onCheckedChange={(c) => {
                      const newSquad = c ? [...setup.team2Squad, p.id] : setup.team2Squad.filter(id => id !== p.id);
                      setSetup({...setup, team2Squad: newSquad});
                    }} id={`t2-${p.id}`} />
                    <Label htmlFor={`t2-${p.id}`} className="text-sm cursor-pointer font-medium">{p.name}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-secondary/5 border-2 border-dashed border-secondary/20 rounded-xl">
              <Label className="text-secondary font-bold">Street Mode: Common Player (Optional)</Label>
              <Select value={setup.commonPlayerId} onValueChange={(v) => setSetup({...setup, commonPlayerId: v})}>
                <SelectTrigger><SelectValue placeholder="Select shared player" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(None)</SelectItem>
                  {allPlayers?.filter(p => !setup.team1Squad.includes(p.id) && !setup.team2Squad.includes(p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}><ArrowLeft className="mr-2 w-4 h-4" /> Back</Button>
              <Button className="flex-1 h-12 font-bold" onClick={() => setStep(3)}>Next: The Toss <ArrowRight className="ml-2 w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl">Step 3: Toss Results</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Who won the toss?</Label>
                <Select value={setup.tossWinner} onValueChange={(v) => setSetup({...setup, tossWinner: v})}>
                  <SelectTrigger><SelectValue placeholder="Choose winner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={setup.team1Id}>{teams?.find(t => t.id === setup.team1Id)?.name}</SelectItem>
                    <SelectItem value={setup.team2Id}>{teams?.find(t => t.id === setup.team2Id)?.name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>What was the decision?</Label>
                <Select value={setup.tossDecision} onValueChange={(v) => setSetup({...setup, tossDecision: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bat">Elect to Bat</SelectItem>
                    <SelectItem value="bowl">Elect to Bowl</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}><ArrowLeft className="mr-2 w-4 h-4" /> Back</Button>
              <Button className="flex-1 h-12 font-bold" disabled={!setup.tossWinner} onClick={() => setStep(4)}>Assign Openers <ArrowRight className="ml-2 w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl">Step 4: Starting Positions</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Striker</Label>
                <Select value={setup.strikerId || undefined} onValueChange={(v) => setSetup({...setup, strikerId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Striker" /></SelectTrigger>
                  <SelectContent>
                    {battingPlayers.filter(p => p.id !== setup.nonStrikerId).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Non-Striker</Label>
                <Select value={setup.nonStrikerId || undefined} onValueChange={(v) => setSetup({...setup, nonStrikerId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Non-Striker" /></SelectTrigger>
                  <SelectContent>
                    {battingPlayers.filter(p => p.id !== setup.strikerId).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Opening Bowler</Label>
              <Select value={setup.bowlerId || undefined} onValueChange={(v) => setSetup({...setup, bowlerId: v})}>
                <SelectTrigger><SelectValue placeholder="Select Bowler" /></SelectTrigger>
                <SelectContent>
                  {bowlingPlayers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}><ArrowLeft className="mr-2 w-4 h-4" /> Back</Button>
              <Button className="flex-1 bg-secondary hover:bg-secondary/90 h-14 text-lg font-black" onClick={handleStartMatch} disabled={!setup.strikerId || !setup.nonStrikerId || !setup.bowlerId}>
                START MATCH <CheckCircle2 className="ml-2 w-6 h-6" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
