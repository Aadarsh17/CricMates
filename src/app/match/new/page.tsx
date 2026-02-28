
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { PlayCircle, Trophy, ShieldCheck } from 'lucide-react';

export default function NewMatchPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('name', 'asc')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const [setup, setSetup] = useState({
    team1Id: '',
    team2Id: '',
    totalOvers: '20',
    tossWinner: '',
    tossDecision: 'bat'
  });

  const handleStartMatch = () => {
    if (!isUmpire) {
      toast({ title: "Access Denied", description: "Only Umpires can start matches.", variant: "destructive" });
      return;
    }
    if (!setup.team1Id || !setup.team2Id || setup.team1Id === setup.team2Id) {
      toast({ title: "Invalid Teams", description: "Please select two different teams.", variant: "destructive" });
      return;
    }

    const matchId = doc(collection(db, 'matches')).id;
    const matchData = {
      id: matchId,
      team1Id: setup.team1Id,
      team2Id: setup.team2Id,
      team1SquadPlayerIds: [],
      team2SquadPlayerIds: [],
      totalOvers: parseInt(setup.totalOvers),
      status: 'live',
      tossWinnerTeamId: setup.tossWinner || setup.team1Id,
      tossDecision: setup.tossDecision,
      currentInningNumber: 1,
      matchDate: new Date().toISOString(),
      umpireId: user?.uid || 'anonymous'
    };

    setDocumentNonBlocking(doc(db, 'matches', matchId), matchData, { merge: true });
    toast({ title: "Match Started!", description: "Initializing scoreboard..." });
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <PlayCircle className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold font-headline">Initialize Match</h1>
      </div>

      <Card className="border-t-4 border-t-primary shadow-lg">
        <CardHeader>
          <CardTitle>Match Configuration</CardTitle>
          <CardDescription>Select competing franchises and set the format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Team 1 (Home)</Label>
              <Select value={setup.team1Id} onValueChange={(v) => setSetup({...setup, team1Id: v})}>
                <SelectTrigger><SelectValue placeholder="Select Team" /></SelectTrigger>
                <SelectContent>
                  {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team 2 (Away)</Label>
              <Select value={setup.team2Id} onValueChange={(v) => setSetup({...setup, team2Id: v})}>
                <SelectTrigger><SelectValue placeholder="Select Team" /></SelectTrigger>
                <SelectContent>
                  {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Total Overs</Label>
            <Input type="number" value={setup.totalOvers} onChange={(e) => setSetup({...setup, totalOvers: e.target.value})} />
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 text-secondary" /> Toss Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Toss Won By</Label>
                <Select value={setup.tossWinner} onValueChange={(v) => setSetup({...setup, tossWinner: v})}>
                  <SelectTrigger><SelectValue placeholder="Toss Result" /></SelectTrigger>
                  <SelectContent>
                    {setup.team1Id && <SelectItem value={setup.team1Id}>Team 1</SelectItem>}
                    {setup.team2Id && <SelectItem value={setup.team2Id}>Team 2</SelectItem>}
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
          </div>

          <Button className="w-full h-12 text-lg font-bold" onClick={handleStartMatch}>
            Initialize Scoreboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
