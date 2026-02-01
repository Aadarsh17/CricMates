'use client';

import { useParams, notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Printer, Share2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Player, Match, Team } from '@/lib/types';
import { SelectBowlerDialog } from '@/components/match/select-bowler-dialog';
import { useEffect, useState, useMemo } from 'react';
import { InningStartDialog } from '@/components/match/inning-start-dialog';
import { FullScorecard } from '@/components/match/full-scorecard';
import { Scoreboard } from '@/components/match/scoreboard';
import { LivePlayerStats } from '@/components/match/live-player-stats';
import { UmpireControls } from '@/components/match/umpire-controls';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatchSquads } from '@/components/match/match-squads';
import { OverByOver } from '@/components/match/over-by-over';
import { useCollection, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppContext } from '@/context/AppContext';
import { getPlayerOfTheMatch } from '@/lib/stats';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
    const { toast } = useToast();
    const { firestore: db } = useFirebase();
    const { setPlayerInMatch } = useAppContext();

    const [isBowlerDialogOpen, setIsBowlerDialogOpen] = useState(false);
    const [isInningStartDialogOpen, setIsInningStartDialogOpen] = useState(false);
    const [inningStartDialogShownFor, setInningStartDialogShownFor] = useState(0);
    const [bowlerDialogShownForOver, setBowlerDialogShownForOver] = useState(0);

    const matchRef = useMemoFirebase(() => db ? doc(db, 'matches', matchId) : null, [db, matchId]);
    const { data: match, isLoading: isMatchLoading } = useDoc<Match>(matchRef);
    
    const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
    const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
    const teams = teamsData || [];

    const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
    const { data: playersData, isLoading: playersLoading } = useCollection<Player>(playersCollection);
    const players = playersData || [];

    const getTeamById = useMemo(() => (teamId: string) => teams.find(t => t.id === teamId), [teams]);
    const getPlayerById = useMemo(() => (playerId: string) => players.find(p => p.id === playerId), [players]);
    
    const getPlayersFromIds = useMemo(() => (playerIds: string[]): Player[] => {
        return players.filter(p => playerIds.includes(p.id));
    }, [players]);

    const { player: playerOfTheMatch, cvp: potmCVP } = useMemo(() => {
        if (match?.status === 'completed') {
          return getPlayerOfTheMatch(match, players, teams);
        }
        return { player: null, cvp: 0 };
    }, [match, players, teams]);

    useEffect(() => {
        if (isMatchLoading || !match || match.status !== 'live') return;
        
        const inning = match.innings[match.currentInning - 1];
        
        const isOverComplete = inning.overs > 0 && inning.overs % 1 === 0 && inning.deliveryHistory.length > 0 && inning.deliveryHistory.at(-1)?.extra !== 'wide' && inning.deliveryHistory.at(-1)?.extra !== 'noball';
        if (isOverComplete && !inning.bowlerId && bowlerDialogShownForOver !== inning.overs) {
            setIsBowlerDialogOpen(true);
            setBowlerDialogShownForOver(inning.overs);
        }

        const isFirstInningStart = match.currentInning === 1 && inning.deliveryHistory.length === 0 && inning.overs === 0;
        const isSecondInningStart = match.currentInning > 1 && inning.deliveryHistory.length === 0;

        if ((isFirstInningStart || isSecondInningStart) && inningStartDialogShownFor !== match.currentInning) {
            setIsInningStartDialogOpen(true);
            setInningStartDialogShownFor(match.currentInning);
        }

    }, [match, isMatchLoading, inningStartDialogShownFor, bowlerDialogShownForOver]);


    if (isMatchLoading || teamsLoading || playersLoading) {
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
    
    if (!team1 || !team2 || !currentInning || !match.team1PlayerIds || !match.team2PlayerIds) {
        notFound();
    }

    const team1Players = getPlayersFromIds(match.team1PlayerIds);
    const team2Players = getPlayersFromIds(match.team2PlayerIds);

    const battingTeam = getTeamById(currentInning.battingTeamId);
    const battingTeamPlayers = currentInning.battingTeamId === team1.id ? team1Players : team2Players;
    const bowlingTeamPlayers = currentInning.bowlingTeamId === team1.id ? team1Players : team2Players;
    
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
        if (!match || !team1 || !team2) return;
        const shareUrl = `${window.location.origin}/share/match/${match.id}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${team1.name} vs ${team2.name}`,
                    text: 'View the live scorecard on CricMates!',
                    url: shareUrl,
                });
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                toast({
                    title: "Match Link Copied",
                    description: "Shareable match link has been copied to your clipboard.",
                });
            } catch (err: any) {
                console.error("Copy failed:", err);
                toast({
                    variant: "destructive",
                    title: "Action Failed",
                    description: "Could not copy the match link.",
                });
            }
        }
    };
    
    const handlePrint = () => {
        window.print();
    };


    return (
        <>
            <div className="space-y-4 print:hidden">
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
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={handleShare}>
                                    <Share2 className="h-4 w-4" />
                                    <span className="sr-only">Share</span>
                                </Button>
                                {match.status === 'completed' && (
                                <Button variant="outline" size="icon" onClick={handlePrint}>
                                    <Printer className="h-4 w-4" />
                                    <span className="sr-only">Print or Save as PDF</span>
                                </Button>
                                )}
                            </div>
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
                        {playerOfTheMatch && (
                             <CardContent className="text-center border-t pt-4">
                                <p className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Player of the match</p>
                                 <div className="flex items-center justify-center gap-3 pt-2">
                                    <Avatar>
                                        <AvatarImage src={`https://picsum.photos/seed/${playerOfTheMatch.id}/40/40`} />
                                        <AvatarFallback>{playerOfTheMatch.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-lg">{playerOfTheMatch.name}</p>
                                        <p className="text-sm text-muted-foreground">CVP: {potmCVP}</p>
                                    </div>
                                </div>
                             </CardContent>
                        )}
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
                                <Scoreboard match={match} teams={teams} />
                                <LivePlayerStats
                                    striker={striker}
                                    nonStriker={nonStriker}
                                    bowler={bowler}
                                    inning={currentInning}
                                />
                                <UmpireControls match={match} teams={teams} players={players} />
                            </div>
                        )}
                        {match.status === 'completed' && (
                            <FullScorecard match={match} teams={teams} players={players} />
                        )}
                    </TabsContent>
                    <TabsContent value="squads" className="mt-4">
                        <MatchSquads match={match} teams={teams} players={players} />
                    </TabsContent>
                    <TabsContent value="overs" className="mt-4">
                        <OverByOver match={match} players={players} teams={teams} />
                    </TabsContent>
                </Tabs>
            </div>

            <div className="hidden print:block print:text-black">
                {match.status === 'completed' && (
                     <>
                        <div className="text-center mb-2">
                            <h1 className="text-base font-bold">{team1.name} vs {team2.name}</h1>
                            <p className="text-[10px] leading-tight">{`Match completed on ${new Date(match.date).toLocaleDateString()}`}</p>
                            <p className="text-[10px] leading-tight">{`Toss won by ${getTeamById(match.tossWinnerId)?.name}, chose to ${match.tossDecision}.`}</p>
                            {match.result && <p className="font-semibold text-sm mt-1">{match.result}</p>}
                            {playerOfTheMatch && (
                                <div className="mt-2 p-1 border-2 border-dashed border-gray-400 rounded-md">
                                    <p className="font-bold text-xs leading-tight uppercase">Player of the Match</p>
                                    <p className="text-sm font-bold text-primary">{playerOfTheMatch.name} <span className="font-normal text-xs text-gray-600">(CVP: {potmCVP})</span></p>
                                </div>
                            )}
                        </div>
                        <FullScorecard match={match} teams={teams} players={players} />
                    </>
                )}
            </div>
        </>
    );
}
