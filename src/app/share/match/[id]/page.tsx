'use client';

import { useParams, notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import type { Player, Match, Team, Inning } from '@/lib/types';
import { useMemo } from 'react';
import { FullScorecard } from '@/components/match/full-scorecard';
import { Scoreboard } from '@/components/match/scoreboard';
import { LivePlayerStats } from '@/components/match/live-player-stats';
import { useCollection, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import Link from 'next/link';

export default function SharedMatchPage() {
    const params = useParams();
    const matchId = params.id as string;
    const { firestore: db } = useFirebase();

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

    if (isMatchLoading || teamsLoading || playersLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }
    
    if (!match) {
        return (
             <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm py-48">
                <div className="flex flex-col items-center gap-1 text-center">
                <h3 className="text-2xl font-bold tracking-tight">Match Not Found</h3>
                <p className="text-sm text-muted-foreground">
                    This match could not be found.
                </p>
                </div>
            </div>
        )
    }
    
    const team1 = getTeamById(match.team1Id);
    const team2 = getTeamById(match.team2Id);
    const currentInning = match.innings[match.currentInning - 1];

    if (!team1 || !team2 || !currentInning) {
        notFound();
    }
    
    const striker = getPlayerById(currentInning.strikerId || '');
    const nonStriker = getPlayerById(currentInning.nonStrikerId || '');
    const bowler = getPlayerById(currentInning.bowlerId || '');

    return (
        <div className="space-y-4">
            <div className="text-center mb-6">
                 <Link
                  href="/"
                  className="flex items-center justify-center gap-2 font-semibold mb-4"
                >
                  <Image src="/logo.svg" alt="CricMates Logo" width={32} height={32} />
                  <span className="font-headline text-2xl">CricMates</span>
                </Link>
                <p className="text-muted-foreground">Public Scorecard</p>
            </div>

             <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-bold tracking-tight font-headline flex justify-between items-center">
                        <span>{team1.name} vs {team2.name}</span>
                        <span className="text-sm font-normal text-muted-foreground">{match.overs} Over Match</span>
                    </CardTitle>
                    <CardDescription>
                        {`Toss won by ${getTeamById(match.tossWinnerId)?.name}, chose to ${match.tossDecision}.`}
                    </CardDescription>
                </CardHeader>
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

            {match.status === 'live' && (
                <div className="space-y-4">
                    <Scoreboard match={match} teams={teams} />
                    <LivePlayerStats
                        striker={striker}
                        nonStriker={nonStriker}
                        bowler={bowler}
                        inning={currentInning}
                    />
                </div>
            )}
            {match.status === 'completed' && (
                <FullScorecard match={match} teams={teams} players={players} />
            )}

        </div>
    );
}
