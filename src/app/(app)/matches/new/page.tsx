'use client';

import { useState } from 'react';
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
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight } from 'lucide-react';
import type { Team } from '@/lib/types';

export default function NewMatchPage() {
  const { teams } = useAppContext();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [team1, setTeam1] = useState<Team | null>(null);
  const [team2, setTeam2] = useState<Team | null>(null);

  const handleStartMatch = () => {
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
  
  const handleNext = () => {
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
    
    toast({
        title: "Teams Selected",
        description: `${team1.name} vs ${team2.name}. Next step coming soon!`,
    });
  };

  if (step === 1) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <h3 className="text-2xl font-bold tracking-tight">New Match</h3>
          <p className="text-sm text-muted-foreground">
            Ready to start a new cricket match?
          </p>
          <Button onClick={handleStartMatch}>
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
                        <Button onClick={handleNext}>
                            Next <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
  }

  return null;
}
