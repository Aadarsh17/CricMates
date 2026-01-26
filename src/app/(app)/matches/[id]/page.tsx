'use client';

import { useParams, notFound } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Printer, Share2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

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
    const { getMatchById, getTeamById, getPlayersByTeamId, setPlayerInMatch, getPlayerById, loading } = useAppContext();
    const { toast } = useToast();
    const [isBowlerDialogOpen, setIsBowlerDialogOpen] = useState(false);
    const [isInningStartDialogOpen, setIsInningStartDialogOpen] = useState(false);
    const [inningStartDialogShownFor, setInningStartDialogShownFor] = useState(0);

    // Call all hooks at the top level
    const match = getMatchById(matchId);

    useEffect(() => {
        if (loading.matches || !match || match.status !== 'live') return;
        
        const inning = match.innings[match.currentInning - 1];
        
        // Show bowler selection dialog if an over is complete and no new bowler is set
        const isOverComplete = inning.overs > 0 && inning.overs % 1 === 0 && inning.deliveryHistory.length > 0;
        if (isOverComplete && !inning.bowlerId) {
            if (!isBowlerDialogOpen) {
                setIsBowlerDialogOpen(true);
            }
        }

        // Show inning start dialog
        const isFirstInningStart = match.currentInning === 1 && inning.deliveryHistory.length === 0 && inning.overs === 0;
        const isSecondInningStart = match.currentInning > 1 && inning.deliveryHistory.length === 0;

        if ((isFirstInningStart || isSecondInningStart) && inningStartDialogShownFor !== match.currentInning) {
            setIsInningStartDialogOpen(true);
            setInningStartDialogShownFor(match.currentInning);
        }

    }, [match, isBowlerDialogOpen, loading.matches, inningStartDialogShownFor]);


    if (loading.matches || loading.teams || loading.players) {
        return (
            <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
                <div className="flex flex-col items-center gap-1 text-center">
                <h3 className="text-2xl font-bold tracking-tight">Loading...</h3>
                <p className="text-sm text-muted-foreground">
                    Loading match data.
                </p>
                </div>
            </div>
        );
    }
    
    if (!match) {
        return (
             <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
                <div className="flex flex-col items-center gap-1 text-center">
                <h3 className="text-2xl font-bold tracking-tight">Loading Match...</h3>
                <p className="text-sm text-muted-foreground">
                    Just a moment.
                </p>
                </div>
            </div>
        )
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
    
    const allOutWickets = battingTeamPlayers.length > 1 ? battingTeamPlayers.length - 1 : 10;

    const striker = getPlayerById(currentInning.strikerId || '');
    const nonStriker = getPlayerById(currentInning.nonStrikerId || '');
    const bowler = getPlayerById(currentInning.bowlerId || '');

    const battedPlayerIds = new Set(match.innings.flatMap(inning => inning.deliveryHistory.map(d => d.strikerId)));
    const outPlayerIds = new Set(match.innings.flatMap(inning => inning.deliveryHistory.filter(d => d.isWicket).map(d => d.strikerId)));
    
    const unbattedPlayers = battingTeamPlayers.filter(p => !battedPlayerIds.has(p.id) || (battedPlayerIds.has(p.id) && !outPlayerIds.has(p.id)));
    
    const noPlayersLeftToBat = unbattedPlayers.filter(p => p.id !== currentInning.strikerId && p.id !== currentInning.nonStrikerId).length === 0;

    const handleShare = async () => {
        if (!team1 || !team2 || !match.result) return;
        const shareData = {
            title: `Cricket Match: ${team1.name} vs ${team2.name}`,
            text: `${match.result}. View the full scorecard.`,
            url: window.location.href,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                navigator.clipboard.writeText(window.location.href);
                toast({
                    title: "URL Copied!",
                    description: "Scorecard URL has been copied to your clipboard.",
                });
            }
        } catch (err) {
            console.error("Error sharing:", err);
            toast({
                variant: "destructive",
                title: "Uh oh! Something went wrong.",
                description: "Could not share scorecard.",
            });
        }
    };
    
    const handlePrint = () => {
        window.print();
    };


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
                           <div className="flex items-center gap-2 print:hidden">
                               <Button variant="outline" size="icon" onClick={handleShare}>
                                   <Share2 className="h-4 w-4" />
                                   <span className="sr-only">Share</span>
                               </Button>
                               <Button variant="outline" size="icon" onClick={handlePrint}>
                                   <Printer className="h-4 w-4" />
                                   <span className="sr-only">Print or Save as PDF</span>
                               </Button>
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
                            <PlayerSelector label="Striker" players={unbattedPlayers.filter(p => p.id !== currentInning.nonStrikerId)} selectedPlayerId={currentInning.strikerId} onSelect={(id) => setPlayerInMatch(match.id, 'striker', id)} disabled={!!currentInning.strikerId || currentInning.wickets >= allOutWickets || noPlayersLeftToBat} />
                            <PlayerSelector label="Non-Striker" players={unbattedPlayers.filter(p => p.id !== currentInning.strikerId)} selectedPlayerId={currentInning.nonStrikerId} onSelect={(id) => setPlayerInMatch(match.id, 'nonStriker', id)} disabled={!!currentInning.nonStrikerId || currentInning.wickets >= allOutWickets || noPlayersLeftToBat} />
                             { !isBowlerDialogOpen && <PlayerSelector label="Bowler" players={bowlingTeamPlayers} selectedPlayerId={currentInning.bowlerId} onSelect={(id) => setPlayerInMatch(match.id, 'bowler', id)} disabled={!!currentInning.bowlerId} /> }
                        </div>
                    </CardContent>
                 )}
                 {match.status === 'completed' && <CardFooter><p className="text-sm text-muted-foreground">Match completed on {new Date(match.date).toLocaleDateString()}</p></CardFooter>}
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
