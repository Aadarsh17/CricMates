'use client';

import { useParams, notFound } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowLeftRight, Undo, UserOff } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Player } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { SelectBowlerDialog } from '@/components/match/select-bowler-dialog';
import { useEffect, useState } from 'react';

const PlayerSelector = ({ label, players, selectedPlayerId, onSelect, disabled = false }: { label: string, players: Player[], selectedPlayerId: string | null, onSelect: (playerId: string) => void, disabled?: boolean }) => (
    <div className="space-y-2 flex-1">
        <Label>{label}</Label>
        <Select onValueChange={onSelect} value={selectedPlayerId || ''} disabled={disabled}>
            <SelectTrigger>
                <SelectValue placeholder={`Select ${label}`} />
            </SelectTrigger>
            <SelectContent>
                {players.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
        </Select>
    </div>
)

const CurrentOver = ({ deliveries, overs }: { deliveries: any[], overs: number }) => {
    const overDeliveries = [];
    if (deliveries.length > 0) {
        let legalBallsInCurrentOver = 0;
        
        const overNumber = Math.floor(overs);
        const ballsInOver = Math.round((overs - overNumber) * 10);

        if (ballsInOver > 0) {
            legalBallsInCurrentOver = ballsInOver;
        } else if (overs > 0 && overs % 1 === 0) {
            legalBallsInCurrentOver = 6;
        }

        let ballsFound = 0;
        for (let i = deliveries.length - 1; i >= 0; i--) {
            const delivery = deliveries[i];
            overDeliveries.unshift(delivery);
            if (!delivery.extra) {
                ballsFound++;
            }
            if (ballsFound >= legalBallsInCurrentOver) {
                break;
            }
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Current Over</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                {overDeliveries.length > 0 ? overDeliveries.map((d, i) => (
                    <Badge key={i} variant={d.isWicket ? 'destructive' : 'secondary'} className="text-lg px-3 py-1">
                        {d.outcome}
                    </Badge>
                )) : <p className="text-sm text-muted-foreground">No deliveries bowled in this over yet.</p>}
            </CardContent>
        </Card>
    );
};


export default function MatchPage() {
    const params = useParams();
    const matchId = params.id as string;
    const { getMatchById, getTeamById, getPlayersByTeamId, recordDelivery, setPlayerInMatch, swapStrikers, undoDelivery, retireStriker } = useAppContext();
    const [isBowlerDialogOpen, setIsBowlerDialogOpen] = useState(false);

    const match = getMatchById(matchId);

    useEffect(() => {
        if (!match || match.status !== 'live') return;
        const inning = match.innings[match.currentInning - 1];
        
        const justFinishedAnOver = inning.overs > 0 && inning.overs % 1 === 0 && inning.deliveryHistory.length > 0;
        if (justFinishedAnOver && !inning.bowlerId) {
            if (!isBowlerDialogOpen) {
                const lastDelivery = inning.deliveryHistory[inning.deliveryHistory.length - 1];
                if (lastDelivery && !lastDelivery.extra) {
                    setIsBowlerDialogOpen(true);
                }
            }
        }
      }, [match, isBowlerDialogOpen]);

    if (!match) {
        notFound();
    }
    
    const team1 = getTeamById(match.team1Id);
    const team2 = getTeamById(match.team2Id);
    
    const currentInning = match.innings[match.currentInning-1];
    const firstInning = match.innings[0];
    const secondInning = match.innings.length > 1 ? match.innings[1] : null;
    
    if (!team1 || !team2 || !currentInning) {
        notFound();
    }

    const battingTeamPlayers = getPlayersByTeamId(currentInning.battingTeamId);
    const bowlingTeamPlayers = getPlayersByTeamId(currentInning.bowlingTeamId);
    
    const handleDelivery = (runs: number, isWicket: boolean, extra: 'wide' | 'noball' | null, outcome: string) => {
        recordDelivery(match.id, { runs, isWicket, extra, outcome });
    };
    
    const unbattedPlayers = battingTeamPlayers.filter(p => 
        !match.innings.some(inning => 
            inning.deliveryHistory.some(d => d.isWicket && inning.strikerId === p.id)
        )
    );

    const UmpireControls = () => (
        <Card>
            <CardHeader>
                <CardTitle>Umpire Controls</CardTitle>
                <CardDescription>Record the outcome of each delivery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Runs Scored</Label>
                    <div className="flex flex-wrap gap-2">
                        {[0, 1, 2, 3, 4, 6].map(runs => (
                            <Button key={runs} variant="outline" onClick={() => handleDelivery(runs, false, null, runs.toString())}>
                                {runs}
                            </Button>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Events & Extras</Label>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="destructive" onClick={() => handleDelivery(0, true, null, 'W')}>Wicket</Button>
                        <Button variant="secondary" onClick={() => handleDelivery(0, false, 'wide', 'Wd')}>Wide</Button>
                        <Button variant="secondary" onClick={() => handleDelivery(0, false, 'noball', 'Nb')}>No Ball</Button>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Actions</Label>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => swapStrikers(match.id)}><ArrowLeftRight className="mr-2 h-4 w-4" /> Swap Strikers</Button>
                        <Button variant="outline" onClick={() => undoDelivery(match.id)}><Undo className="mr-2 h-4 w-4" /> Undo</Button>
                        <Button variant="outline" onClick={() => retireStriker(match.id)}><UserOff className="mr-2 h-4 w-4" /> Retire</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
    
    return (
        <div className="space-y-6">
            <SelectBowlerDialog 
                open={isBowlerDialogOpen}
                bowlers={bowlingTeamPlayers}
                onBowlerSelect={(bowlerId) => {
                    setPlayerInMatch(match.id, 'bowler', bowlerId);
                    setIsBowlerDialogOpen(false);
                }}
            />
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
                 {match.status === 'live' && (
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <PlayerSelector label="Striker" players={unbattedPlayers} selectedPlayerId={currentInning.strikerId} onSelect={(id) => setPlayerInMatch(match.id, 'striker', id)} disabled={!!currentInning.strikerId || currentInning.wickets >= 10} />
                            <PlayerSelector label="Non-Striker" players={unbattedPlayers} selectedPlayerId={currentInning.nonStrikerId} onSelect={(id) => setPlayerInMatch(match.id, 'nonStriker', id)} disabled={!!currentInning.nonStrikerId || currentInning.wickets >= 10} />
                            <PlayerSelector label="Bowler" players={bowlingTeamPlayers} selectedPlayerId={currentInning.bowlerId} onSelect={(id) => setPlayerInMatch(match.id, 'bowler', id)} disabled={!!currentInning.bowlerId} />
                        </div>
                    </CardContent>
                 )}
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

            {match.status === 'live' && <CurrentOver deliveries={currentInning.deliveryHistory} overs={currentInning.overs} />}
            {match.status === 'live' && <UmpireControls />}
        </div>
    );
}
