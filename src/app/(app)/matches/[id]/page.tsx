'use client';

import { useParams, notFound } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Share2, Printer } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Player } from '@/lib/types';
import { SelectBowlerDialog } from '@/components/match/select-bowler-dialog';
import { useEffect, useState } from 'react';
import { InningStartDialog } from '@/components/match/inning-start-dialog';
import { FullScorecard } from '@/components/match/full-scorecard';
import { Scoreboard } from '@/components/match/scoreboard';
import { LivePlayerStats } from '@/components/match/live-player-stats';
import { UmpireControls } from '@/components/match/umpire-controls';

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

export default function MatchPage() {
    const params = useParams();
    const matchId = params.id as string;
    const { getMatchById, getTeamById, getPlayersByTeamId, recordDelivery, setPlayerInMatch, swapStrikers, undoDelivery, retireStriker, getPlayerById } = useAppContext();
    const [isBowlerDialogOpen, setIsBowlerDialogOpen] = useState(false);
    const [isInningStartDialogOpen, setIsInningStartDialogOpen] = useState(false);

    const match = getMatchById(matchId);
    
    useEffect(() => {
        if (match && match.status === 'live') {
            const inning = match.innings[match.currentInning - 1];
            if (inning.deliveryHistory.length === 0 && match.currentInning === 1 && inning.overs === 0) {
                setIsInningStartDialogOpen(true);
            }
             if (match.currentInning > 1 && inning.deliveryHistory.length === 0) {
                setIsInningStartDialogOpen(true);
            }
        }
    }, [match]);

    useEffect(() => {
        if (!match || match.status !== 'live') return;
        const inning = match.innings[match.currentInning - 1];
        
        const isOverComplete = inning.overs > 0 && inning.overs % 1 === 0 && inning.deliveryHistory.length > 0;
        
        if (isOverComplete && !inning.bowlerId) {
            if (!isBowlerDialogOpen) {
                setIsBowlerDialogOpen(true);
            }
        }
      }, [match, isBowlerDialogOpen]);

    if (!match) {
        notFound();
    }
    
    const team1 = getTeamById(match.team1Id);
    const team2 = getTeamById(match.team2Id);
    
    const currentInning = match.innings[match.currentInning-1];
    
    if (!team1 || !team2 || !currentInning) {
        notFound();
    }

    const battingTeam = getTeamById(currentInning.battingTeamId);
    const battingTeamPlayers = getPlayersByTeamId(currentInning.battingTeamId);
    const bowlingTeamPlayers = getPlayersByTeamId(currentInning.bowlingTeamId);
    
    const striker = getPlayerById(currentInning.strikerId || '');
    const nonStriker = getPlayerById(currentInning.nonStrikerId || '');
    const bowler = getPlayerById(currentInning.bowlerId || '');

    const unbattedPlayers = battingTeamPlayers.filter(p => {
        const isOut = match.innings.some(inning => 
            inning.deliveryHistory.some(d => d.isWicket && d.strikerId === p.id)
        );
        return !isOut;
    });

    return (
        <div className="space-y-4">
            <InningStartDialog
                open={isInningStartDialogOpen}
                onClose={() => setIsInningStartDialogOpen(false)}
                inningNumber={match.currentInning}
                battingTeamName={battingTeam?.name}
            />
            <SelectBowlerDialog 
                open={isBowlerDialogOpen}
                bowlers={bowlingTeamPlayers.filter(p => p.id !== match.innings[match.currentInning - 1]?.deliveryHistory.at(-1)?.bowlerId)}
                onBowlerSelect={(bowlerId) => {
                    setPlayerInMatch(match.id, 'bowler', bowlerId);
                    setIsBowlerDialogOpen(false);
                }}
            />
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-bold tracking-tight font-headline flex justify-between items-center">
                        <span>{team1.name} vs {team2.name}</span>
                        {match.status === 'completed' ? (
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon"><Share2 className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon"><Printer className="h-5 w-5" /></Button>
                            </div>
                        ) : (
                            <span className="text-sm font-normal text-muted-foreground">{match.overs} Over Match</span>
                        )}
                    </CardTitle>
                    <CardDescription>
                        {`Toss won by ${getTeamById(match.tossWinnerId)?.name}, chose to ${match.tossDecision}.`}
                    </CardDescription>
                </CardHeader>
                 {match.status === 'live' && (
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <PlayerSelector label="Striker" players={unbattedPlayers.filter(p => p.id !== currentInning.nonStrikerId)} selectedPlayerId={currentInning.strikerId} onSelect={(id) => setPlayerInMatch(match.id, 'striker', id)} disabled={!!currentInning.strikerId || currentInning.wickets >= 10} />
                            <PlayerSelector label="Non-Striker" players={unbattedPlayers.filter(p => p.id !== currentInning.strikerId)} selectedPlayerId={currentInning.nonStrikerId} onSelect={(id) => setPlayerInMatch(match.id, 'nonStriker', id)} disabled={!!currentInning.nonStrikerId || currentInning.wickets >= 10} />
                             { !isBowlerDialogOpen && <PlayerSelector label="Bowler" players={bowlingTeamPlayers} selectedPlayerId={currentInning.bowlerId} onSelect={(id) => setPlayerInMatch(match.id, 'bowler', id)} disabled={!!currentInning.bowlerId} /> }
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

            {match.status === 'live' && (
                <>
                    <Scoreboard match={match} />
                    <LivePlayerStats
                        striker={striker}
                        nonStriker={nonStriker}
                        bowler={bowler}
                        inning={currentInning}
                    />
                    <UmpireControls match={match} />
                </>
            )}

            {match.status === 'completed' && (
                <FullScorecard match={match} />
            )}
        </div>
    );
}
