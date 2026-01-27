'use client';

import { useAppContext } from "@/context/AppContext";
import { PlayerStatsTable } from "@/components/player-stats/player-stats-table";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from 'firebase/firestore';
import type { Match } from "@/lib/types";

export default function PlayerStatsPage() {
  const { teams, players, loading: contextLoading } = useAppContext();
  const { firestore: db } = useFirebase();

  const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'completed')) : null, [db]);
  const { data: matchesData, isLoading: matchesLoading } = useCollection<Match>(matchesQuery);
  const matches = matchesData || [];

   if (contextLoading.teams || matchesLoading || contextLoading.players) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Loading...</h3>
          <p className="text-sm text-muted-foreground">
            Calculating player stats.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Player Statistics
          </h1>
          <p className="text-muted-foreground">
            Overall career statistics for every player.
          </p>
        </div>
      </div>
      <PlayerStatsTable players={players} teams={teams} matches={matches} />
    </div>
  );
}
