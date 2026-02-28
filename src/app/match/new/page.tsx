
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { PlayCircle, Trophy, ShieldCheck, Users, Info, Settings2, UserPlus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

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
    team1CaptainId: '',
    team2CaptainId: '',
    commonPlayerId: '',
    isStreetMode: false,
    totalOvers: '20',
    tossWinner: '',
    tossDecision: 'bat'
  });

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('name', 'asc')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const team1PlayersQuery = useMemoFirebase(() => 
    setup.isStreetMode ? allPlayersQuery : (setup.team1Id ? query(collection(db, 'players'), where('teamId', '==', setup.team1Id)) : null), 
  [db, setup.team1Id, setup.isStreetMode, allPlayersQuery]);
  const { data: team1Players } = useCollection(team1PlayersQuery);

  const team2PlayersQuery = useMemoFirebase(() => 
    setup.isStreetMode ? allPlayersQuery : (setup.team2Id ? query(collection(db, 'players'), where('teamId', '==', setup.team2Id)) : null), 
  [db, setup.team2Id, setup.isStreetMode, allPlayersQuery]);
  const { data: team2Players } = useCollection(team2PlayersQuery);

  const handleStartMatch = () => {
    const matchId = doc(collection(db, 'matches')).id;
    const matchData = {
      id: matchId,
      team1Id: setup.team1Id,
      team2Id: setup.team2Id,
      team1SquadPlayerIds: setup.team1Squad,
      team2SquadPlayerIds: setup.team2Squad,
      team1CaptainId: setup.team1CaptainId || (setup.team1Squad[0] || ''),
      team2CaptainId: setup.team2CaptainId || (setup.team2Squad[0] || ''),
      commonPlayerId: setup.commonPlayerId,
      totalOvers: parseInt(setup.totalOvers),
      status: 'live',
      tossWinnerTeamId: setup.tossWinner,
      tossDecision: setup.tossDecision,
      currentInningNumber: 1,
      matchDate: new Date().toISOString(),
      umpireId: user?.uid || 'anonymous',
      isStreetMode: setup.isStreetMode
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
      umpireId: user?.uid || 'anonymous',
      matchStatus: 'live'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), inningData, { merge: true });
    
    toast({ title: "Match Started!", description: "Flexible squads engaged. Play Ball!" });
    router.push(`/match/${matchId}`);
  };

  if (!isUmpire) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <ShieldCheck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Umpire Mode Required</h2>
        <p className="text-muted-foreground mb-6">Switch to Umpire mode in the navigation bar to officiate a new match.</p>
        <Button variant="outline" onClick={() => router.push('/')}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <PlayCircle className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold font-headline">Match Setup</h1>
        </div>
        <Badge variant="outline">Step {step} of 3</Badge>
      </div>

      {step === 1 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader>
            <CardTitle>1. Format & Teams</CardTitle>
            <CardDescription>Configure match rules and choose teams.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Street Mode (Flexible Pool)</Label>
                <p className="text-xs text-muted-foreground">Select any player regardless of their registered team.</p>
              </div>
              <Switch 
                checked={setup.isStreetMode} 
                onCheckedChange={(v) => setSetup({...setup, isStreetMode: v})} 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Team A (Home)</Label>
                <Select value={setup.team1Id} onValueChange={(v) => setSetup({...setup, team1Id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Team" /></SelectTrigger>
                  <SelectContent>
                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team B (Away)</Label>
                <Select value={setup.team2Id} onValueChange={(v) => setSetup({...setup, team2Id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Team" /></SelectTrigger>
                  <SelectContent>
                    {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Match Format (Overs)</Label>
                <Input type="number" value={setup.totalOvers} onChange={(e) => setSetup({...setup, totalOvers: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Common Player (Optional)</Label>
                <Select value={setup.commonPlayerId} onValueChange={(v) => setSetup({...setup, commonPlayerId: v})}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {allPlayers?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full" disabled={!setup.team1Id || !setup.team2Id || setup.team1Id === setup.team2Id} onClick={() => setStep(2)}>
              Next: Squad Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader>
            <CardTitle>2. Squad Selection</CardTitle>
            <CardDescription>Uneven squads allowed. Select any number of players for each side.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold">Team A Squad</h3>
                  <Badge variant="secondary">{setup.team1Squad.length} Players</Badge>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-lg">
                  {team1Players?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`p1-${p.id}`} 
                        checked={setup.team1Squad.includes(p.id)} 
                        onCheckedChange={(checked) => {
                          const newSquad = checked 
                            ? [...setup.team1Squad, p.id] 
                            : setup.team1Squad.filter(id => id !== p.id);
                          setSetup({...setup, team1Squad: newSquad});
                        }} 
                      />
                      <Label htmlFor={`p1-${p.id}`} className="text-sm font-medium">{p.name}</Label>
                    </div>
                  ))}
                </div>
                <Select value={setup.team1CaptainId} onValueChange={(v) => setSetup({...setup, team1CaptainId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Captain (Optional)" /></SelectTrigger>
                  <SelectContent>
                    {team1Players?.filter(p => setup.team1Squad.includes(p.id)).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold">Team B Squad</h3>
                  <Badge variant="secondary">{setup.team2Squad.length} Players</Badge>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-lg">
                  {team2Players?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`p2-${p.id}`} 
                        checked={setup.team2Squad.includes(p.id)} 
                        onCheckedChange={(checked) => {
                          const newSquad = checked 
                            ? [...setup.team2Squad, p.id] 
                            : setup.team2Squad.filter(id => id !== p.id);
                          setSetup({...setup, team2Squad: newSquad});
                        }} 
                      />
                      <Label htmlFor={`p2-${p.id}`} className="text-sm font-medium">{p.name}</Label>
                    </div>
                  ))}
                </div>
                <Select value={setup.team2CaptainId} onValueChange={(v) => setSetup({...setup, team2CaptainId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Captain (Optional)" /></SelectTrigger>
                  <SelectContent>
                    {team2Players?.filter(p => setup.team2Squad.includes(p.id)).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" disabled={setup.team1Squad.length === 0 || setup.team2Squad.length === 0} onClick={() => setStep(3)}>Next: Toss</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader>
            <CardTitle>3. Toss Outcome</CardTitle>
            <CardDescription>Finalize pre-match formalities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Toss Won By</Label>
                <Select value={setup.tossWinner} onValueChange={(v) => setSetup({...setup, tossWinner: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Winner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={setup.team1Id}>Team A</SelectItem>
                    <SelectItem value={setup.team2Id}>Team B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={setup.tossDecision} onValueChange={(v) => setSetup({...setup, tossDecision: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bat">Bat First</SelectItem>
                    <SelectItem value="bowl">Bowl First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-4 bg-primary/5 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-1" />
              <div className="text-sm">
                <p className="font-bold">Match Summary Preview</p>
                <p className="text-muted-foreground italic">
                  Team {setup.tossWinner === setup.team1Id ? 'A' : 'B'} won the toss and elected to {setup.tossDecision} first in a {setup.totalOvers} over match.
                  {setup.commonPlayerId && setup.commonPlayerId !== 'none' && " Common player enabled."}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1 bg-secondary hover:bg-secondary/90" onClick={handleStartMatch}>Start Match</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
