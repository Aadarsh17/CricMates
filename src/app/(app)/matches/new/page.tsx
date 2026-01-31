'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight } from 'lucide-react';
import type { Team, Player } from '@/lib/types';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

export default function NewMatchPage() {
  const { addMatch } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [team1, setTeam1] = useState<Team | null>(null);
  const [team2, setTeam2] = useState<Team | null>(null);
  const [overs, setOvers] = useState<number>(20);
  const [tossWinner, setTossWinner] = useState<string | null>(null);
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [team1PlayerIds, setTeam1PlayerIds] = useState<string[]>([]);
  const [team2PlayerIds, setTeam2PlayerIds] = useState<string[]>([]);
  const [team1CaptainId, setTeam1CaptainId] = useState<string>('');
  const [team2CaptainId, setTeam2CaptainId] = useState<string>('');
  
  const { firestore: db } = useFirebase();

  const teamsCollection = useMemoFirebase(() => db ? collection(db, 'teams') : null, [db]);
  const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
  const teams = teamsData || [];

  const playersCollection = useMemoFirebase(() => db ? collection(db, 'players') : null, [db]);
  const { data: playersData, isLoading: playersLoading } = useCollection<Player>(playersCollection);
  const allPlayers = playersData || [];

  const goToTeamSelection = () => setStep(2);
  
  const handleTeamSelect = (teamId: string, teamNumber: 1 | 2) => {
    const selectedTeam = teams.find(t => t.id === teamId);
    if (teamNumber === 1) setTeam1(selectedTeam || null);
    else setTeam2(selectedTeam || null);
  };
  
  const goToMatchConfig = () => {
    if (!team1 || !team2) {
      toast({ variant: "destructive", title: "Team Selection Required", description: "Please select both teams to proceed." });
      return;
    }
    if (team1.id === team2.id) {
        toast({ variant: "destructive", title: "Invalid Selection", description: "Please select two different teams." });
        return;
    }
    setStep(3);
  };
  
  const goToSquadSelection = () => {
     if (!tossWinner || !tossDecision || overs <= 0) {
      toast({ variant: 'destructive', title: 'Configuration Incomplete', description: 'Please configure all match settings.' });
      return;
    }
    setStep(4);
  }

  const handleStartMatch = async () => {
    if (!team1 || !team2 || team1PlayerIds.length === 0 || team2PlayerIds.length === 0 || !team1CaptainId || !team2CaptainId) {
      toast({ variant: 'destructive', title: 'Squad Selection Incomplete', description: 'Please select players and a captain for both teams.' });
      return;
    }
     if (team1PlayerIds.length !== team2PlayerIds.length) {
      toast({ variant: 'destructive', title: 'Squad Size Mismatch', description: 'Both teams must have the same number of players.' });
      return;
    }

    setIsSubmitting(true);
    
    const newMatchId = await addMatch({
      team1Id: team1.id,
      team2Id: team2.id,
      overs: overs,
      tossWinnerId: tossWinner!,
      tossDecision: tossDecision!,
      team1PlayerIds,
      team2PlayerIds,
      team1CaptainId,
      team2CaptainId,
    });

    if (newMatchId) {
      router.push(`/matches/${newMatchId}`);
    } else {
      setIsSubmitting(false);
    }
  };

  const handlePlayerSelection = (team: 'team1' | 'team2', playerId: string) => {
    const setter = team === 'team1' ? setTeam1PlayerIds : setTeam2PlayerIds;
    const currentIds = team === 'team1' ? team1PlayerIds : team2PlayerIds;
    if(currentIds.includes(playerId)) {
      setter(currentIds.filter(id => id !== playerId));
    } else {
      setter([...currentIds, playerId]);
    }
  };


  const loading = teamsLoading || playersLoading;

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Loading...</h3>
          <p className="text-sm text-muted-foreground">
            Loading team & player data.
          </p>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <h3 className="text-2xl font-bold tracking-tight">New Match</h3>
          <p className="text-sm text-muted-foreground">
            Ready to start a new cricket match?
          </p>
          <Button onClick={goToTeamSelection}>
            Start New Match
          </Button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
        <div className="flex justify-center items-start pt-10">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>Configure New Match</CardTitle>
                    <CardDescription>Select the two teams that will be playing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <div className="space-y-2">
                            <Label htmlFor="team1">Team 1</Label>
                             <Select onValueChange={(value) => handleTeamSelect(value, 1)} defaultValue={team1?.id}>
                                <SelectTrigger id="team1">
                                    <SelectValue placeholder="Select Team 1" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teams.map((team) => (
                                        <SelectItem key={team.id} value={team.id}>
                                            {team.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                         <div className="flex justify-center items-center text-muted-foreground font-bold text-xl pt-6 hidden md:flex">VS</div>


                        <div className="space-y-2">
                             <Label htmlFor="team2">Team 2</Label>
                             <Select onValueChange={(value) => handleTeamSelect(value, 2)} defaultValue={team2?.id}>
                                <SelectTrigger id="team2">
                                    <SelectValue placeholder="Select Team 2" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teams.map((team) => (
                                        <SelectItem key={team.id} value={team.id}>
                                            {team.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={goToMatchConfig}>
                            Next <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
  }

  if (step === 3) {
    return (
      <div className="flex justify-center items-start pt-10">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Match Setup</CardTitle>
            <CardDescription>Configure the match settings before you start.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="overs">Number of Overs</Label>
              <Input id="overs" type="number" placeholder="e.g., 20" value={overs} onChange={(e) => setOvers(Number(e.target.value))} />
            </div>
            {team1 && team2 && (
              <div className="space-y-2">
                <Label>Who won the toss?</Label>
                <RadioGroup onValueChange={(value) => setTossWinner(value)} value={tossWinner || undefined} className="flex gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={team1.id} id={team1.id} />
                    <Label htmlFor={team1.id} className="font-normal">{team1.name}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={team2.id} id={team2.id} />
                    <Label htmlFor={team2.id} className="font-normal">{team2.name}</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            <div className="space-y-2">
              <Label>Toss Decision</Label>
              <RadioGroup onValueChange={(value: 'bat' | 'bowl') => setTossDecision(value)} value={tossDecision || undefined} className="flex gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bat" id="bat" />
                  <Label htmlFor="bat" className="font-normal">Bat</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bowl" id="bowl" />
                  <Label htmlFor="bowl" className="font-normal">Bowl</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
           <CardFooter className="flex justify-end">
             <Button onClick={goToSquadSelection}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
             </Button>
           </CardFooter>
        </Card>
      </div>
    );
  }

  if (step === 4) {
    const team1SelectedPlayers = allPlayers.filter(p => team1PlayerIds.includes(p.id));
    const team2SelectedPlayers = allPlayers.filter(p => team2PlayerIds.includes(p.id));

    return (
        <div className="flex justify-center items-start pt-10">
            <Card className="w-full max-w-4xl">
                 <CardHeader>
                    <CardTitle>Squad Selection</CardTitle>
                    <CardDescription>Select players for each team. Both teams must have the same number of players.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    {/* Team 1 Selection */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">{team1?.name}</h3>
                        <div className="space-y-2">
                            <Label>Captain</Label>
                            <Select value={team1CaptainId} onValueChange={setTeam1CaptainId} disabled={team1PlayerIds.length === 0}>
                                <SelectTrigger><SelectValue placeholder="Select Captain" /></SelectTrigger>
                                <SelectContent>
                                    {team1SelectedPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Label>Players ({team1PlayerIds.length})</Label>
                        <ScrollArea className="h-72 w-full rounded-md border p-2">
                            <div className="space-y-2">
                                {allPlayers.map(player => (
                                    <div key={player.id} className="flex items-center justify-between p-1">
                                        <Label htmlFor={`t1-${player.id}`} className={`font-normal flex-1 ${team2PlayerIds.includes(player.id) ? 'text-muted-foreground' : ''}`}>{player.name}</Label>
                                        <Checkbox 
                                            id={`t1-${player.id}`} 
                                            checked={team1PlayerIds.includes(player.id)} 
                                            onCheckedChange={() => handlePlayerSelection('team1', player.id)}
                                            disabled={team2PlayerIds.includes(player.id)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                     {/* Team 2 Selection */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">{team2?.name}</h3>
                         <div className="space-y-2">
                            <Label>Captain</Label>
                            <Select value={team2CaptainId} onValueChange={setTeam2CaptainId} disabled={team2PlayerIds.length === 0}>
                                <SelectTrigger><SelectValue placeholder="Select Captain" /></SelectTrigger>
                                <SelectContent>
                                    {team2SelectedPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Label>Players ({team2PlayerIds.length})</Label>
                        <ScrollArea className="h-72 w-full rounded-md border p-2">
                            <div className="space-y-2">
                                {allPlayers.map(player => (
                                    <div key={player.id} className="flex items-center justify-between p-1">
                                        <Label htmlFor={`t2-${player.id}`} className={`font-normal flex-1 ${team1PlayerIds.includes(player.id) ? 'text-muted-foreground' : ''}`}>{player.name}</Label>
                                        <Checkbox 
                                            id={`t2-${player.id}`} 
                                            checked={team2PlayerIds.includes(player.id)} 
                                            onCheckedChange={() => handlePlayerSelection('team2', player.id)}
                                            disabled={team1PlayerIds.includes(player.id)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                     <Button onClick={handleStartMatch} disabled={isSubmitting}>
                        {isSubmitting ? 'Starting Match...' : 'Start Match'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
  }

  return null;
}
