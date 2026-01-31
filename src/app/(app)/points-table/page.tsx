'use client';

import { PointsTable } from "@/components/points-table/points-table";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from 'firebase/firestore';
import type { Match, Player, Team } from "@/lib/types";

export default function PointsTablePage() {
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


   if (teamsLoading || matchesLoading || playersLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Loading...</h3>
          <p className="text-sm text-muted-foreground">
            Calculating points table.
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
            Points Table
          </h1>
          <p className="text-muted-foreground">
            View the standings with Net Run Rate.
          </p>
        </div>
      </div>
      <PointsTable teams={teams} matches={matches} players={players} />
    </div>
  );
}
