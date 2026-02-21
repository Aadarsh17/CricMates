
'use client';

import { useState } from 'react';
import { PlayerSetup } from '@/components/number-game/player-setup';
import { LiveGame } from '@/components/number-game/live-game';
import { GameStatsTable } from '@/components/number-game/game-stats-table';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export type Player = {
    id: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    consecutiveDots: number;
    dismissal?: {
        type: string;
        bowlerName: string;
        fielderName?: string;
    };
    duck: boolean;
    goldenDuck: boolean;
    ballsBowled: number;
    runsConceded: number;
    wicketsTaken: number;
    oversBowled: number;
};

export type GameState = {
    status: 'setup' | 'live' | 'completed';
    players: Player[];
    currentBatsmanIndex: number;
    currentBowlerIndex: number;
    totalWickets: number;
    totalOvers: number;
    currentOver: {
        deliveries: string[];
        legalBalls: number;
    };
};

export default function NumberGamePage() {
    const [gameState, setGameState] = useState<GameState>({
        status: 'setup',
        players: [],
        currentBatsmanIndex: 0,
        currentBowlerIndex: 0,
        totalWickets: 0,
        totalOvers: 0,
        currentOver: { deliveries: [], legalBalls: 0 },
    });

    const handleStartGame = (initialPlayers: Player[]) => {
        setGameState({
            status: 'live',
            players: initialPlayers,
            currentBatsmanIndex: 0,
            currentBowlerIndex: initialPlayers.length - 1,
            totalWickets: 0,
            totalOvers: 0,
            currentOver: { deliveries: [], legalBalls: 0 },
        });
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset the game? All progress will be lost.')) {
            setGameState({
                status: 'setup',
                players: [],
                currentBatsmanIndex: 0,
                currentBowlerIndex: 0,
                totalWickets: 0,
                totalOvers: 0,
                currentOver: { deliveries: [], legalBalls: 0 },
            });
        }
    };

    return (
        <div className="container mx-auto max-w-4xl py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Number Game</h1>
                    <p className="text-muted-foreground">Digital scorer for your local cricket variations.</p>
                </div>
                {gameState.status !== 'setup' && (
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Reset Game
                    </Button>
                )}
            </div>

            {gameState.status === 'setup' && (
                <PlayerSetup initialPlayers={[]} onStartGame={handleStartGame} />
            )}

            {gameState.status === 'live' && (
                <LiveGame gameState={gameState} setGameState={setGameState} />
            )}

            {gameState.status === 'completed' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg text-center">
                        <h2 className="text-2xl font-bold text-primary">Game Over!</h2>
                        <p className="text-muted-foreground">Final scorecard is ready for review.</p>
                    </div>
                    <GameStatsTable players={gameState.players} />
                </div>
            )}
        </div>
    );
}
