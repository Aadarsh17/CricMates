
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { X, Plus } from 'lucide-react';
import type { Player } from '@/lib/number-game-types';
import { useToast } from '@/hooks/use-toast';

interface PlayerSetupProps {
  initialPlayers: Player[];
  onStartGame: (players: Player[]) => void;
}

export function PlayerSetup({ initialPlayers, onStartGame }: PlayerSetupProps) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const { toast } = useToast();

  const handlePlayerNameChange = (id: string, name: string) => {
    setPlayers(players.map(p => (p.id === id ? { ...p, name } : p)));
  };

  const addPlayer = () => {
    if (players.length >= 10) {
        toast({ title: "Maximum players reached", description: "You can have a maximum of 10 players.", variant: "destructive" });
        return;
    }
    const newPlayer: Player = {
        id: `player-${Date.now()}`,
        name: '',
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, oversBowled: 0, ballsBowled: 0, runsConceded: 0, wicketsTaken: 0, consecutiveDots: 0, duck: false, goldenDuck: false,
    };
    setPlayers([...players, newPlayer]);
  }

  const removePlayer = (id: string) => {
    if (players.length <= 5) {
        toast({ title: "Minimum players required", description: "You need at least 5 players.", variant: "destructive" });
        return;
    }
    setPlayers(players.filter(p => p.id !== id));
  }

  const handleStartGame = () => {
    if (players.length < 5) {
        toast({ title: "Not enough players", description: "You need at least 5 players to start.", variant: "destructive" });
        return;
    }

    if (players.some(p => p.name.trim() === '')) {
        toast({ title: "Empty Player Names", description: "All players must have a name.", variant: "destructive" });
        return;
    }
    
    const playerNames = players.map(p => p.name.trim().toLowerCase());
    const uniquePlayerNames = new Set(playerNames);
    if (playerNames.length !== uniquePlayerNames.size) {
        toast({ title: "Duplicate player names", description: "Player names must be unique.", variant: "destructive" });
        return;
    }

    onStartGame(players);
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Number Game Setup</CardTitle>
        <CardDescription>Configure players for your game. You can have between 5 and 10 players.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
            <Label>Player Names</Label>
        </div>
        <div className="space-y-2">
          {players.map((player, index) => (
            <div key={player.id} className="flex items-center gap-2">
              <span className="font-bold text-muted-foreground w-6">{index + 1}.</span>
              <Input
                value={player.name}
                onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                placeholder={`Player ${index + 1} Name`}
              />
              <Button variant="ghost" size="icon" onClick={() => removePlayer(player.id)} disabled={players.length <= 5}>
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full" onClick={addPlayer} disabled={players.length >= 10}>
            <Plus className="mr-2 h-4 w-4" /> Add Player
        </Button>
      </CardContent>
      <CardFooter>
        <Button onClick={handleStartGame} className="w-full">
          Start Game
        </Button>
      </CardFooter>
    </Card>
  );
}
