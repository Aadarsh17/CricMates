'use client';

import { useParams, notFound } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Printer, Share2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Player, Match } from '@/lib/types';
import { SelectBowlerDialog } from '@/components/match/select-bowler-dialog';
import { useEffect, useState } from 'react';
import { InningStartDialog } from '@/components/match/inning-start-dialog';
import { FullScorecard } from '@/components/match/full-scorecard';
import { Scoreboard } from '@/components/match/scoreboard';
import { LivePlayerStats } from '@/components/match/live-player-stats';
import { UmpireControls } from '@/components/match/umpire-controls';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatchSquads } from '@/components/match/match-squads';
import { OverByOver } from '@/components/match/over-by-over';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

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
    const { getTeamById, getPlayersByTeamId, setPlayerInMatch, getPlayerById, loading: contextLoading } = useAppContext();
    const { toast } = useToast();
    const { firestore: db } = useFirebase();

    const [isBowlerDialogOpen, setIsBowlerDialogOpen] = useState(false);
    const [isInningStartDialogOpen, setIsInningStartDialogOpen] = useState(false);
    const [inningStartDialogShownFor, setInningStartDialogShownFor] = useState(0);

    const matchRef = useMemoFirebase(() => db ? doc(db, 'matches', matchId) : null, [db, matchId]);
    const { data: match, isLoading: isMatchLoading } = useDoc<Match>(matchRef);

    useEffect(() => {
        if (isMatchLoading || !match || match.status !== 'live') return;
        
        const inning = match.innings[match.currentInning - 1];
        
        const isOverComplete = inning.overs > 0 && inning.overs % 1 === 0 && inning.deliveryHistory.length > 0;
        if (isOverComplete && !inning.bowlerId) {
            if (!isBowlerDialogOpen) {
                setIsBowlerDialogOpen(true);
            }
        }

        const isFirstInningStart = match.currentInning === 1 && inning.deliveryHistory.length === 0 && inning.overs === 0;
        const isSecondInningStart = match.currentInning > 1 && inning.deliveryHistory.length === 0;

        if ((isFirstInningStart || isSecondInningStart) && inningStartDialogShownFor !== match.currentInning) {
            setIsInningStartDialogOpen(true);
            setInningStartDialogShownFor(match.currentInning);
        }

    }, [match, isBowlerDialogOpen, isMatchLoading, inningStartDialogShownFor]);


    if (isMatchLoading || contextLoading.teams || contextLoading.players) {
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
                <h3 className="text-2xl font-bold tracking-tight">Match not found</h3>
                <p className="text-sm text-muted-foreground">
                    This match could not be found.
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
    
    const outPlayerIds = new Set(match.innings.flatMap(inning => inning.deliveryHistory.filter(d => d.isWicket && d.dismissal).map(d => d.dismissal!.batsmanOutId)));
    const retiredHurtPlayerIds = new Set(currentInning.retiredHurtPlayerIds || []);

    const activeBatsmen = battingTeamPlayers.filter(p => !outPlayerIds.has(p.id) && !retiredHurtPlayerIds.has(p.id));
    const retiredBatsmen = battingTeamPlayers.filter(p => retiredHurtPlayerIds.has(p.id) && !outPlayerIds.has(p.id));

    const activeBatsmenPool = activeBatsmen.filter(p => p.id !== currentInning.strikerId && p.id !== currentInning.nonStrikerId);
    
    const canRetiredReturn = activeBatsmenPool.length === 0;
    
    const selectableBatsmen = canRetiredReturn ? [...activeBatsmen, ...retiredBatsmen] : activeBatsmen;

    const noPlayersLeftToBat = selectableBatsmen.filter(p => p.id !== currentInning.strikerId && p.id !== currentInning.nonStrikerId).length === 0;

    const striker = getPlayerById(currentInning.strikerId || '');
    const nonStriker = getPlayerById(currentInning.nonStrikerId || '');
    const bowler = getPlayerById(currentInning.bowlerId || '');

    const handleShare = async () => {
        if (!team1 || !team2) {
            toast({
                variant: "destructive",
                title: "Data still loading",
                description: "Please wait for team data to load before sharing.",
            });
            return;
        }

        const shareText = match.result 
            ? `${match.result}. View the full scorecard for ${team1.name} vs ${team2.name}.`
            : `Check out the scorecard for ${team1.name} vs ${team2.name}.`;

        const shareData = {
            title: `Cricket Match: ${team1.name} vs ${team2.name}`,
            text: shareText,
            url: window.location.href,
        };

        try {
            if (!navigator.share) {
                throw new Error("Web Share API not supported.");
            }
            await navigator.share(shareData);
        } catch (err) {
            // This catch block handles both lack of support and runtime errors (like permission denied).
            try {
                await navigator.clipboard.writeText(window.location.href);
                toast({
                    title: "URL Copied!",
                    description: "The native share dialog could not be opened. The URL has been copied to your clipboard instead.",
                });
            } catch (copyError) {
                toast({
                    variant: "destructive",
                    title: "Action Failed",
                    description: "Could not share or copy the URL.",
                });
            }
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
                    setPlayerInMatch(match, 'bowler', bowlerId);
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
                            <PlayerSelector label="Striker" players={selectableBatsmen.filter(p => p.id !== currentInning.nonStrikerId)} selectedPlayerId={currentInning.strikerId} onSelect={(id) => setPlayerInMatch(match, 'striker', id)} disabled={!!currentInning.strikerId || currentInning.wickets >= allOutWickets || noPlayersLeftToBat} />
                            <PlayerSelector label="Non-Striker" players={selectableBatsmen.filter(p => p.id !== currentInning.strikerId)} selectedPlayerId={currentInning.nonStrikerId} onSelect={(id) => setPlayerInMatch(match, 'nonStriker', id)} disabled={!!currentInning.nonStrikerId || currentInning.wickets >= allOutWickets || noPlayersLeftToBat} />
                             { !isBowlerDialogOpen && <PlayerSelector label="Bowler" players={bowlingTeamPlayers} selectedPlayerId={currentInning.bowlerId} onSelect={(id) => setPlayerInMatch(match, 'bowler', id)} disabled={!!currentInning.bowlerId} /> }
                        </div>
                    </CardContent>
                 )}
                 {match.status === 'completed' && <CardFooter><p className="text-sm text-muted-foreground">Match completed on {new Date(match.date).toLocaleDateString()}</p></CardFooter>}
            </Card>

            {match.status === 'completed' && match.result && (
                <Card>
                    <CardHeader className="text-center">
                        <div className="flex justify-center items-center gap-2">
                             <Trophy className="w-8 h-8 text-primary" />
                             <CardTitle className="text-primary">{match.result}</CardTitle>
                        </div>
                    </CardHeader>
                </Card>
            )}

            <Tabs defaultValue="scorecard" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
                    <TabsTrigger value="squads">Squads</TabsTrigger>
                    <TabsTrigger value="overs">Overs</TabsTrigger>
                </TabsList>
                <TabsContent value="scorecard" className="mt-4">
                    {match.status === 'live' && (
                        <div className="space-y-4">
                            <Scoreboard match={match} />
                            <LivePlayerStats
                                striker={striker}
                                nonStriker={nonStriker}
                                bowler={bowler}
                                inning={currentInning}
                            />
                            <UmpireControls match={match} />
                        </div>
                    )}
                    {match.status === 'completed' && (
                        <FullScorecard match={match} />
                    )}
                </TabsContent>
                <TabsContent value="squads" className="mt-4">
                    <MatchSquads team1Id={match.team1Id} team2Id={match.team2Id} />
                </TabsContent>
                <TabsContent value="overs" className="mt-4">
                    <OverByOver match={match} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
