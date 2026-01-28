'use client';

import { useState } from 'react';
import { PlayerSetup } from '@/components/number-game/player-setup';
import { LiveGame } from '@/components/number-game/live-game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type Player = {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  oversBowled: number;
  ballsBowled: number;
  runsConceded: number;
  wicketsTaken: number;
  consecutiveDots: number;
};

export type GameState = {
  status: 'setup' | 'live' | 'completed';
  players: Player[];
  currentBatsmanIndex: number;
  currentBowlerIndex: number;
  currentOver: {
    deliveries: string[];
    legalBalls: number;
  };
  totalScore: number;
  totalWickets: number;
  totalOvers: number;
};

export default function NumberGamePage() {
  const [gameState, setGameState] = useState<GameState>({
    status: 'setup',
    players: Array.from({ length: 5 }, (_, i) => ({
      id: `player-${i + 1}`,
      name: `Player ${i + 1}`,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      oversBowled: 0,
      ballsBowled: 0,
      runsConceded: 0,
      wicketsTaken: 0,
      consecutiveDots: 0,
    })),
    currentBatsmanIndex: 0,
    currentBowlerIndex: 4,
    currentOver: { deliveries: [], legalBalls: 0 },
    totalScore: 0,
    totalWickets: 0,
    totalOvers: 0,
  });

  const handleStartGame = (players: Player[]) => {
    setGameState(prev => ({
      ...prev,
      players,
      status: 'live',
      currentBowlerIndex: players.length - 1,
    }));
  };

  const resetGame = () => {
    setGameState({
      status: 'setup',
      players: Array.from({ length: 5 }, (_, i) => ({
        id: `player-${i + 1}`,
        name: `Player ${i + 1}`,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        oversBowled: 0,
        ballsBowled: 0,
        runsConceded: 0,
        wicketsTaken: 0,
        consecutiveDots: 0,
      })),
      currentBatsmanIndex: 0,
      currentBowlerIndex: 4,
      currentOver: { deliveries: [], legalBalls: 0 },
      totalScore: 0,
      totalWickets: 0,
      totalOvers: 0,
    });
  }

  return (
    <div className="container mx-auto py-8">
      {gameState.status === 'setup' && (
        <PlayerSetup
          initialPlayers={gameState.players}
          onStartGame={handleStartGame}
        />
      )}
      {gameState.status === 'live' && (
        <LiveGame gameState={gameState} setGameState={setGameState} />
      )}
      {gameState.status === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle>Game Over!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-2xl font-bold">Final Score: {gameState.totalScore} / {gameState.totalWickets}</p>
            <p className="text-xl">Winner is player: <span className='font-bold'>{gameState.players.sort((a,b) => b.runs - a.runs)[0].name}</span></p>
            <Button onClick={resetGame}>Play Again</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
