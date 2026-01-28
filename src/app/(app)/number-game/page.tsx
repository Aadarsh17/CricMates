'use client';

import { useState } from 'react';
import { PlayerSetup } from '@/components/number-game/player-setup';
import { LiveGame } from '@/components/number-game/live-game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameStatsTable } from '@/components/number-game/game-stats-table';

export type Player = {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissal?: {
    type: string;
    bowlerName: string;
  };
  oversBowled: number;
  ballsBowled: number;
  runsConceded: number;
  wicketsTaken: number;
  consecutiveDots: number;
  duck: boolean;
  goldenDuck: boolean;
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
      duck: false,
      goldenDuck: false,
    })),
    currentBatsmanIndex: 0,
    currentBowlerIndex: 4,
    currentOver: { deliveries: [], legalBalls: 0 },
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
    const playerCount = gameState.players.length;
    setGameState({
      status: 'setup',
      players: Array.from({ length: playerCount }, (_, i) => ({
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
        duck: false,
        goldenDuck: false,
      })),
      currentBatsmanIndex: 0,
      currentBowlerIndex: playerCount - 1,
      currentOver: { deliveries: [], legalBalls: 0 },
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
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className='text-center'>Game Over!</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-2xl">Winner is player: <span className='font-bold'>{gameState.players.sort((a,b) => b.runs - a.runs)[0].name}</span></p>
                <Button onClick={resetGame}>Play Again</Button>
              </CardContent>
            </Card>
            <GameStatsTable players={gameState.players} />
        </div>
      )}
    </div>
  );
}
