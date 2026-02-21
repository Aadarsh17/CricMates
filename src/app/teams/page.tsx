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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline text-primary">Teams</h1>
          <p className="text-muted-foreground">Manage your cricket league teams here.</p>
        </div>
        <AddTeamDialog onTeamAdd={addTeam} />
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          ))}
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
        <div className="flex h-96 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/10 text-center p-8">
          <div className="bg-background p-4 rounded-full shadow-sm mb-4">
            <Shield className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">No teams found</h3>
          <p className="text-muted-foreground mb-6 max-w-xs">Add your first team to start tracking matches and player stats.</p>
          <AddTeamDialog onTeamAdd={addTeam} />
        </div>
      )}
    </div>
  );
}