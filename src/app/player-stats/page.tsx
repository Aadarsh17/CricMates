
'use client';

import { PlayerStatsTable } from "@/components/player-stats/player-stats-table";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Team, Match, Player } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppContext } from "@/context/AppContext";

export default function PlayerStatsPage() {
  const { firestore: db } = useFirebase();
  const { editPlayer, deletePlayer } = useAppContext();

  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
  const { data: players, isLoading: playersLoading } = useCollection<Player>(playersCollection);

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);

  const matchesCollection = useMemoFirebase(() => (db ? collection(db, 'matches') : null), [db]);
  const { data: matches, isLoading: matchesLoading } = useCollection<Match>(matchesCollection);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Player Stats</h1>
        <p className="text-muted-foreground">Detailed batting and bowling statistics for all players.</p>
      </div>

      {playersLoading || teamsLoading || matchesLoading ? (
        <Skeleton className="h-[500px] w-full rounded-lg" />
      ) : (
        <PlayerStatsTable 
          players={players || []} 
          teams={teams || []} 
          matches={matches || []}
          onEditPlayer={editPlayer}
          onDeletePlayer={deletePlayer}
        />
      )}
    </div>
  );
}
