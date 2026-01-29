'use client';

import { useState, useEffect } from 'react';
import { PlayerSetup } from '@/components/number-game/player-setup';
import { LiveGame } from '@/components/number-game/live-game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameStatsTable } from '@/components/number-game/game-stats-table';
import { AggregatedStatsTable } from '@/components/number-game/aggregated-stats-table';

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
    fielderName?: string;
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

const initialPlayerState = (count: number, names: string[] = []) =>
  Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: names[i] || `Player ${i + 1}`,
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
  }));

export default function NumberGamePage() {
  const [gameState, setGameState] = useState<GameState>({
    status: 'setup',
    players: initialPlayerState(5),
    currentBatsmanIndex: 0,
    currentBowlerIndex: 4,
    currentOver: { deliveries: [], legalBalls: 0 },
    totalWickets: 0,
    totalOvers: 0,
  });

  const [gameHistory, setGameHistory] = useState<GameState[]>([]);
  
  useEffect(() => {
    if (gameState.status === 'completed') {
      // Check if the game is already in history to prevent duplicates on re-renders
      const isAlreadyInHistory = gameHistory.some(
        (histGame) =>
          histGame.players.every((p, i) => 
            p.runs === gameState.players[i].runs && 
            p.balls === gameState.players[i].balls &&
            p.wicketsTaken === gameState.players[i].wicketsTaken
          ) && histGame.totalOvers === gameState.totalOvers
      );

      if (!isAlreadyInHistory) {
        setGameHistory((prev) => [...prev, gameState]);
      }
    }
  }, [gameState, gameHistory]);

  const handleStartGame = (players: Player[]) => {
    setGameState({
      status: 'live',
      players,
      currentBatsmanIndex: 0,
      currentBowlerIndex: players.length - 1,
      currentOver: { deliveries: [], legalBalls: 0 },
      totalWickets: 0,
      totalOvers: 0,
    });
  };

  const resetGame = () => {
    const playerCount = gameState.players.length;
    const playerNames = gameState.players.map(p => p.name);
    setGameState({
      status: 'setup',
      players: initialPlayerState(playerCount, playerNames),
      currentBatsmanIndex: 0,
      currentBowlerIndex: playerCount - 1,
      currentOver: { deliveries: [], legalBalls: 0 },
      totalWickets: 0,
      totalOvers: 0,
    });
  }

  return (
    <div className="container mx-auto py-4 space-y-6">
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

      {gameHistory.length > 0 && (
        <div className="space-y-8">
          <AggregatedStatsTable gameHistory={gameHistory} />

          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-center font-headline">Match History</h2>
            {gameHistory.slice().reverse().map((game, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>Match {gameHistory.length - index}</CardTitle>
                </CardHeader>
                <CardContent>
                  <GameStatsTable players={game.players} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
