'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RankingsTable, RankedPlayer, RankedTeam } from '@/components/rankings/rankings-table';
import type { Player, Team, Match } from '@/lib/types';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AggregatedPlayerStats, calculatePlayerStats } from '@/lib/stats';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';


const calculateBattingRankings = (playerStats: AggregatedPlayerStats[]): RankedPlayer[] => {
    return playerStats
        .map(p => ({
            player: p.player,
            points: p.runsScored 
        }))
        .sort((a, b) => b.points - a.points)
        .map((p, index) => ({ ...p, rank: index + 1 }));
};

const calculateBowlingRankings = (playerStats: AggregatedPlayerStats[]): RankedPlayer[] => {
    return playerStats
        .map(p => ({
            player: p.player,
            points: p.wicketsTaken,
            avg: p.bowlingAverage
        }))
        .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return (a.avg ?? Infinity) - (b.avg ?? Infinity);
        })
        .map((p, index) => ({ player: p.player, points: p.points, rank: index + 1 }));
};

const calculateAllRounderRankings = (playerStats: AggregatedPlayerStats[]): RankedPlayer[] => {
    return playerStats
        .map(p => ({
            player: p.player,
            points: Math.round((p.runsScored) + (p.wicketsTaken * 20))
        }))
        .sort((a, b) => b.points - a.points)
        .map((p, index) => ({ ...p, rank: index + 1 }));
};

const getBallsFromOvers = (overs: number) => {
    return Math.floor(overs) * 6 + Math.round((overs % 1) * 10);
};

const calculateTeamRankings = (teams: Team[], matches: Match[]): RankedTeam[] => {
    const tableData = teams.map(team => {
        const completedMatches = matches.filter(m => (m.team1Id === team.id || m.team2Id === team.id) && m.status === 'completed');
        
        let won = 0;
        let tied = 0;
        let totalRunsScored = 0;
        let totalBallsFaced = 0;
        let totalRunsConceded = 0;
        let totalBallsBowled = 0;

        completedMatches.forEach(match => {
            if (match.result) {
                 if (match.result.startsWith(team.name)) {
                    won++;
                } else if (match.result === 'Match is a Tie.') {
                    tied++;
                }
            }
             match.innings.forEach(inning => {
                if (inning.battingTeamId === team.id) {
                    totalRunsScored += inning.score;
                    totalBallsFaced += getBallsFromOvers(inning.overs);
                } else if (inning.bowlingTeamId === team.id) {
                    totalRunsConceded += inning.score;
                    totalBallsBowled += getBallsFromOvers(inning.overs);
                }
            });
        });
        
        const points = (won * 2) + (tied * 1);
        const runRateFor = totalBallsFaced > 0 ? totalRunsScored / (totalBallsFaced / 6) : 0;
        const runRateAgainst = totalBallsBowled > 0 ? totalRunsConceded / (totalBallsBowled / 6) : 0;
        const nrr = runRateFor - runRateAgainst;

        return { team, points, nrr };
    })
    
    return tableData.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.nrr - a.nrr;
    }).map((t, index) => ({
        team: t.team,
        points: t.points,
        rank: index + 1
    }));
};


export default function RankingsPage() {
    const { firestore: db } = useFirebase();

    const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
    const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
    const teams = teamsData || [];

    const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
    const { data: playersData, isLoading: playersLoading } = useCollection<Player>(playersCollection);
    const players = playersData || [];

    const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'completed')) : null, [db]);
    const { data: matchesData, isLoading: matchesLoading } = useCollection<Match>(matchesQuery);
    const matches = matchesData || [];

    const playerStats = useMemo(() => calculatePlayerStats(players, teams, matches), [players, teams, matches]);
    const battingRankings = useMemo(() => calculateBattingRankings(playerStats), [playerStats]);
    const bowlingRankings = useMemo(() => calculateBowlingRankings(playerStats), [playerStats]);
    const allRounderRankings = useMemo(() => calculateAllRounderRankings(playerStats), [playerStats]);
    const teamRankings = useMemo(() => calculateTeamRankings(teams, matches), [teams, matches]);

    if (playersLoading || teamsLoading || matchesLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-10 w-96" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Cricket Rankings
                </h1>
                <p className="text-muted-foreground">
                    Official player and team rankings based on performance.
                </p>
            </div>

            <Tabs defaultValue="batting" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="batting">Batting</TabsTrigger>
                    <TabsTrigger value="bowling">Bowling</TabsTrigger>
                    <TabsTrigger value="all-rounder">All-rounder</TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                </TabsList>
                <TabsContent value="batting" className="mt-4">
                    <RankingsTable data={battingRankings} type="player" teams={teams} />
                </TabsContent>
                <TabsContent value="bowling" className="mt-4">
                    <RankingsTable data={bowlingRankings} type="player" teams={teams} />
                </TabsContent>
                <TabsContent value="all-rounder" className="mt-4">
                    <RankingsTable data={allRounderRankings} type="player" teams={teams} />
                </TabsContent>
                <TabsContent value="teams" className="mt-4">
                    <RankingsTable data={teamRankings} type="team" teams={teams} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
