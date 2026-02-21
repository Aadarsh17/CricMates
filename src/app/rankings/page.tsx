
'use client';

import { RankingsTable, type RankedPlayer, type RankedTeam } from "@/components/rankings/rankings-table";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Team, Match, Player } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo } from "react";
import { calculatePlayerStats } from "@/lib/stats";

export default function RankingsPage() {
  const { firestore: db } = useFirebase();

  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
  const { data: players, isLoading: playersLoading } = useCollection<Player>(playersCollection);

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);

  const matchesCollection = useMemoFirebase(() => (db ? collection(db, 'matches') : null), [db]);
  const { data: matches, isLoading: matchesLoading } = useCollection<Match>(matchesCollection);

  const playerRankings = useMemo(() => {
    if (!players || !teams || !matches) return [];
    const stats = calculatePlayerStats(players, teams, matches);
    return stats
      .sort((a, b) => (b.runsScored + b.wicketsTaken * 25) - (a.runsScored + a.wicketsTaken * 25))
      .slice(0, 10)
      .map((s, idx) => ({
        rank: idx + 1,
        player: s.player,
        points: Math.round(s.runsScored + s.wicketsTaken * 25)
      }));
  }, [players, teams, matches]);

  const teamRankings = useMemo(() => {
    if (!teams) return [];
    return teams
      .sort((a, b) => (b.matchesWon * 2 + b.matchesDrawn) - (a.matchesWon * 2 + a.matchesDrawn))
      .slice(0, 10)
      .map((t, idx) => ({
        rank: idx + 1,
        team: t,
        points: (t.matchesWon * 2 + t.matchesDrawn)
      }));
  }, [teams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Rankings</h1>
        <p className="text-muted-foreground">Top performers in the league.</p>
      </div>

      <Tabs defaultValue="players" className="space-y-4">
        <TabsList>
          <TabsTrigger value="players">Top Players</TabsTrigger>
          <TabsTrigger value="teams">Top Teams</TabsTrigger>
        </TabsList>
        <TabsContent value="players">
          {playersLoading || teamsLoading || matchesLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <RankingsTable data={playerRankings} type="player" />
          )}
        </TabsContent>
        <TabsContent value="teams">
          {teamsLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <RankingsTable data={teamRankings} type="team" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
