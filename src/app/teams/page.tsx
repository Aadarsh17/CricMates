
'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Team } from "@/lib/types";
import TeamCard from "@/components/teams/team-card";
import { AddTeamDialog } from "@/components/teams/add-team-dialog";
import { useAppContext } from "@/context/AppContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";

export default function TeamsPage() {
  const { firestore: db } = useFirebase();
  const { addTeam, editTeam, deleteTeam } = useAppContext();

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teams, isLoading } = useCollection<Team>(teamsCollection);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Teams</h1>
          <p className="text-muted-foreground">Manage your cricket league teams here.</p>
        </div>
        <AddTeamDialog onTeamAdd={addTeam} />
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
        </div>
      ) : teams && teams.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map(team => (
            <TeamCard 
              key={team.id} 
              team={team} 
              onEdit={(name) => editTeam(team.id, name)} 
              onDelete={() => deleteTeam(team.id)} 
            />
          ))}
        </div>
      ) : (
        <div className="flex h-96 flex-col items-center justify-center rounded-lg border-2 border-dashed text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-bold">No teams found</h3>
          <p className="text-muted-foreground">Add your first team to get started.</p>
        </div>
      )}
    </div>
  );
}
