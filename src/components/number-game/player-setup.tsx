'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { X, Plus, Users } from 'lucide-react';
import type { Player } from '@/app/(app)/number-game/page';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

interface PlayerSetupProps {
  initialPlayers: Player[];
  onStartGame: (players: Player[]) => void;
}

export function PlayerSetup({ initialPlayers, onStartGame }: PlayerSetupProps) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers.slice(0, 9)); // Default to 9 players
  const [playerCount, setPlayerCount] = useState<number>(9);

  const handlePlayerNameChange = (id: string, name: string) => {
    setPlayers(players.map(p => (p.id === id ? { ...p, name } : p)));
  };

  const handlePlayerCountChange = (count: string) => {
    const newCount = parseInt(count, 10);
    setPlayerCount(newCount);
    const currentCount = players.length;

    if (newCount > currentCount) {
      const newPlayers: Player[] = Array.from({ length: newCount - currentCount }, (_, i) => ({
        id: `player-${currentCount + i + 1}`,
        name: `Player ${currentCount + i + 1}`,
        runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, oversBowled: 0, ballsBowled: 0, runsConceded: 0, wicketsTaken: 0,
      }));
      setPlayers([...players, ...newPlayers]);
    } else if (newCount < currentCount) {
      setPlayers(players.slice(0, newCount));
    }
  };


  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Number Game Setup</CardTitle>
        <CardDescription>Configure players for your game. You can have 9 or 10 players.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
            <Label htmlFor='player-count'>Number of Players</Label>
            <Select onValueChange={handlePlayerCountChange} defaultValue={String(playerCount)}>
                <SelectTrigger id="player-count" className="w-[180px]">
                    <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="9">9 Players</SelectItem>
                    <SelectItem value="10">10 Players</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-4">
            <Label>Player Names</Label>
          {players.map((player, index) => (
            <div key={player.id} className="flex items-center gap-2">
              <span className="font-bold text-muted-foreground w-6">{index + 1}.</span>
              <Input
                value={player.name}
                onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                placeholder={`Player ${index + 1} Name`}
              />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => onStartGame(players)} className="w-full">
          Start Game
        </Button>
      </CardFooter>
    </Card>
  );
}
