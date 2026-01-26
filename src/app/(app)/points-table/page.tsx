'use client';

import { useAppContext } from "@/context/AppContext";
import { PointsTable } from "@/components/points-table/points-table";

export default function PointsTablePage() {
  const { teams, matches, players, loading } = useAppContext();

   if (loading.teams || loading.matches || loading.players) {
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
