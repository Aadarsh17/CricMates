
'use client';

import { PointsTable } from "@/components/points-table/points-table";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Team, Match, Player } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function PointsTablePage() {
  const { firestore: db } = useFirebase();

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);

  const matchesCollection = useMemoFirebase(() => (db ? collection(db, 'matches') : null), [db]);
  const { data: matches, isLoading: matchesLoading } = useCollection<Match>(matchesCollection);

  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
  const { data: players, isLoading: playersLoading } = useCollection<Player>(playersCollection);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Points Table</h1>
        <p className="text-muted-foreground">Current standings of all teams in the tournament.</p>
      </div>

      {teamsLoading || matchesLoading || playersLoading ? (
        <Skeleton className="h-[400px] w-full rounded-lg" />
      ) : (
        <PointsTable 
          teams={teams || []} 
          matches={matches || []} 
          players={players || []} 
        />
      )}
    </div>
  );
}
