
'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Team } from "@/lib/types";
import TeamCard from "@/components/teams/team-card";
import { AddTeamDialog } from "@/components/teams/add-team-dialog";
import { useAppContext } from "@/context/AppContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";
import { useMemo } from "react";

export default function TeamsPage() {
  const { firestore: db, user } = useFirebase();
  const { addTeam, editTeam, deleteTeam } = useAppContext();

  const isAdmin = useMemo(() => user && !user.isAnonymous, [user]);

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teams, isLoading } = useCollection<Team>(teamsCollection);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-1">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight font-headline">Teams</h1>
          <p className="text-sm sm:text-base text-muted-foreground font-medium">Manage and monitor league participants.</p>
        </div>
        {isAdmin && <AddTeamDialog onTeamAdd={addTeam} />}
      </div>

      {isLoading ? (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-64 w-full rounded-3xl" />
              <div className="space-y-2 px-4">
                <Skeleton className="h-5 w-[70%]" />
                <Skeleton className="h-4 w-[40%]" />
              </div>
            </div>
          ))}
        </div>
      ) : teams && teams.length > 0 ? (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map(team => (
            <TeamCard 
              key={team.id} 
              team={team} 
              onEdit={isAdmin ? (name) => editTeam(team.id, name) : undefined} 
              onDelete={isAdmin ? () => deleteTeam(team.id) : undefined} 
            />
          ))}
        </div>
      ) : (
        <div className="flex h-96 flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-muted-foreground/20 bg-muted/5 text-center p-8 animate-in zoom-in duration-500">
          <div className="bg-background p-5 rounded-3xl shadow-sm mb-6">
            <Shield className="h-12 w-12 text-primary/60" />
          </div>
          <h3 className="text-2xl font-bold">No teams found</h3>
          <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
            {isAdmin ? 'Create your first team to start recording matches and player statistics.' : 'No teams have been registered in the league yet.'}
          </p>
          {isAdmin && <AddTeamDialog onTeamAdd={addTeam} />}
        </div>
      )}
    </div>
  );
}
