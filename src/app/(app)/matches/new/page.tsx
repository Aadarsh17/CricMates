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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight } from 'lucide-react';
import type { Team } from '@/lib/types';

export default function NewMatchPage() {
  const { teams, addMatch, loading } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [team1, setTeam1] = useState<Team | null>(null);
  const [team2, setTeam2] = useState<Team | null>(null);
  const [overs, setOvers] = useState<number>(20);
  const [tossWinner, setTossWinner] = useState<string | null>(null);
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goToTeamSelection = () => {
    setStep(2);
  };
  
  const handleTeamSelect = (teamId: string, teamNumber: 1 | 2) => {
    const selectedTeam = teams.find(t => t.id === teamId);
    if (teamNumber === 1) {
      setTeam1(selectedTeam || null);
    } else {
      setTeam2(selectedTeam || null);
    }
  };
  
  const goToMatchConfig = () => {
    if (!team1 || !team2) {
      toast({
        variant: "destructive",
        title: "Team Selection Required",
        description: "Please select both teams to proceed.",
      });
      return;
    }
    if (team1.id === team2.id) {
        toast({
            variant: "destructive",
            title: "Invalid Selection",
            description: "Please select two different teams.",
        });
        return;
    }
    setStep(3);
  };

  const handleStartMatch = async () => {
    if (!tossWinner || !tossDecision || overs <= 0 || !team1 || !team2) {
      toast({
        variant: 'destructive',
        title: 'Configuration Incomplete',
        description: 'Please configure all match settings.',
      });
      return;
    }

    setIsSubmitting(true);
    
    const newMatchId = await addMatch({
      team1Id: team1.id,
      team2Id: team2.id,
      overs: overs,
      tossWinnerId: tossWinner,
      tossDecision: tossDecision,
    });

    if (newMatchId) {
      router.push(`/matches/${newMatchId}`);
    } else {
      // If addMatch fails, it returns an empty string and shows a toast.
      // We just need to reset the button state here.
      setIsSubmitting(false);
    }
  };

  if (loading.teams) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Loading...</h3>
          <p className="text-sm text-muted-foreground">
            Loading team data.
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
                <CardContent className="space-y-6">
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
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="overs">Number of Overs</Label>
              <Input 
                id="overs" 
                type="number" 
                placeholder="e.g., 20" 
                value={overs}
                onChange={(e) => setOvers(Number(e.target.value))}
                disabled={isSubmitting}
              />
            </div>
            {team1 && team2 && (
              <div className="space-y-2">
                <Label>Who won the toss?</Label>
                <RadioGroup 
                  onValueChange={(value) => setTossWinner(value)}
                  value={tossWinner || undefined}
                  className="flex gap-4 pt-2"
                  disabled={isSubmitting}
                >
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
              <RadioGroup 
                onValueChange={(value: 'bat' | 'bowl') => setTossDecision(value)}
                value={tossDecision || undefined}
                className="flex gap-4 pt-2"
                disabled={isSubmitting}
              >
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
            <div className="flex justify-end">
              <Button onClick={handleStartMatch} disabled={isSubmitting}>
                {isSubmitting ? 'Starting Match...' : 'Start Match'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
