'use client';

import { useParams, notFound } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';

export default function MatchPage() {
    const params = useParams();
    const matchId = params.id as string;
    const { getMatchById, getTeamById, simulateOver } = useAppContext();

    const match = getMatchById(matchId);

    if (!match) {
        notFound();
    }
    
    const team1 = getTeamById(match.team1Id);
    const team2 = getTeamById(match.team2Id);
    
    const firstInning = match.innings[0];
    const secondInning = match.innings.length > 1 ? match.innings[1] : null;
    
    if (!team1 || !team2) {
        notFound();
    }

    const handleSimulateOver = () => {
        simulateOver(match.id);
    };
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold tracking-tight font-headline flex justify-between items-center">
                        <span>{team1.name} vs {team2.name}</span>
                        <span className="text-sm font-normal text-muted-foreground">{match.overs} Over Match</span>
                    </CardTitle>
                    <CardDescription>
                        {`Toss won by ${getTeamById(match.tossWinnerId)?.name}, chose to ${match.tossDecision}.`}
                    </CardDescription>
                </CardHeader>
            </Card>

            {match.status === 'completed' && match.result && (
                <Card className="bg-primary/10 border-primary">
                    <CardHeader className="text-center">
                        <div className="flex justify-center items-center gap-2">
                             <Trophy className="w-8 h-8 text-primary" />
                             <CardTitle className="text-primary">{match.result}</CardTitle>
                        </div>
                    </CardHeader>
                </Card>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{getTeamById(firstInning.battingTeamId)?.name} Innings</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <div className="text-5xl font-bold">{firstInning.score}/{firstInning.wickets}</div>
                        <div className="text-md text-muted-foreground">Overs: {firstInning.overs.toFixed(1)}</div>
                    </CardContent>
                </Card>

                {secondInning ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>{getTeamById(secondInning.battingTeamId)?.name} Innings</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="text-5xl font-bold">{secondInning.score}/{secondInning.wickets}</div>
                            <div className="text-md text-muted-foreground">Overs: {secondInning.overs.toFixed(1)}</div>
                             {match.status === 'live' && match.currentInning === 2 && (
                                <div className="text-sm text-primary font-bold mt-2">
                                    Needs {firstInning.score - secondInning.score + 1} runs to win.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                     <Card className="flex items-center justify-center border-dashed min-h-[170px]">
                        <div className="text-center text-muted-foreground">
                            <p>Second inning hasn't started yet.</p>
                        </div>
                    </Card>
                )}
            </div>

            {match.status === 'live' && (
                <div className="flex justify-center">
                    <Button onClick={handleSimulateOver}>Simulate Over</Button>
                </div>
            )}
        </div>
    );
}
