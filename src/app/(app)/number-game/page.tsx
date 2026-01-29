'use client';

import { useState, useEffect } from 'react';
import { PlayerSetup } from '@/components/number-game/player-setup';
import { LiveGame } from '@/components/number-game/live-game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameStatsTable } from '@/components/number-game/game-stats-table';
import { AggregatedStatsTable } from '@/components/number-game/aggregated-stats-table';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';


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
  id: string;
};

const initialPlayerState = (count: number, names: string[] = []) =>
  Array.from({ length: count }, (_, i) => ({
    id: `player-${Date.now()}-${i}`,
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
    id: `game-${Date.now()}`,
  });

  const [gameHistory, setGameHistory] = useState<GameState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load history from localStorage on initial render
  useEffect(() => {
    try {
      const savedHistory = window.localStorage.getItem('numberGameHistory');
      if (savedHistory) {
        const parsedHistory: GameState[] = JSON.parse(savedHistory);
         if (parsedHistory.length > 0) {
            setGameHistory(parsedHistory);
            // Restore the view to the last completed game
            setGameState(parsedHistory[parsedHistory.length - 1]);
        }
      }
    } catch (error) {
      console.error("Failed to load game history from localStorage", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (isLoading) return;
    try {
      window.localStorage.setItem('numberGameHistory', JSON.stringify(gameHistory));
    } catch (error) {
      console.error("Failed to save game history to localStorage", error);
    }
  }, [gameHistory, isLoading]);
  
  useEffect(() => {
    if (gameState.status === 'completed') {
      // Check if the game is already in history to prevent duplicates
      const isAlreadyInHistory = gameHistory.some(
        (histGame) => histGame.id === gameState.id
      );

      if (!isAlreadyInHistory) {
        setGameHistory((prev) => [...prev, gameState]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.status, gameState.id]);

  const handleStartGame = (players: Player[]) => {
    setGameState({
      status: 'live',
      players,
      currentBatsmanIndex: 0,
      currentBowlerIndex: players.length - 1,
      currentOver: { deliveries: [], legalBalls: 0 },
      totalWickets: 0,
      totalOvers: 0,
      id: `game-${Date.now()}`
    });
  };

  const resetGame = () => {
    const lastGame = gameHistory.length > 0 ? gameHistory[gameHistory.length - 1] : gameState;
    const playerCount = lastGame.players.length;
    const playerNames = lastGame.players.map(p => p.name);
    setGameState({
      status: 'setup',
      players: initialPlayerState(playerCount, playerNames),
      currentBatsmanIndex: 0,
      currentBowlerIndex: playerCount - 1,
      currentOver: { deliveries: [], legalBalls: 0 },
      totalWickets: 0,
      totalOvers: 0,
      id: `game-${Date.now()}`
    });
  }

  const handleDeleteGame = (gameId: string) => {
    const updatedHistory = gameHistory.filter((game) => game.id !== gameId);
    setGameHistory(updatedHistory);

    if(gameState.id === gameId) {
        resetGame();
    }
  };

  if (isLoading) {
    return (
        <div className="container mx-auto py-2 sm:py-4 space-y-4">
            <Card>
                <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
                <CardContent><Skeleton className="h-64 w-full" /></CardContent>
            </Card>
        </div>
    )
  }


  return (
    <div className="container mx-auto py-2 sm:py-4 space-y-4">
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
        <div className="space-y-4">
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
        <div className="space-y-6">
          <AggregatedStatsTable gameHistory={gameHistory} />

          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-center font-headline">Match History</h2>
            {gameHistory.slice().reverse().map((game, index) => {
                 return (
                  <Card key={game.id}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Match {gameHistory.length - index}</CardTitle>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete this match history.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteGame(game.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </CardHeader>
                    <CardContent>
                      <GameStatsTable players={game.players} />
                    </CardContent>
                  </Card>
                );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
