'use client';

import { notFound, useParams } from "next/navigation";
import type { Team } from '@/lib/types';
import { useDoc, useFirebase, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { firestore: db } = useFirebase();

  const teamRef = useMemoFirebase(() => (db ? doc(db, 'teams', id) : null), [db, id]);
  const { data: team, isLoading: teamLoading } = useDoc<Team>(teamRef);

  if (teamLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Loading...</h3>
          <p className="text-sm text-muted-foreground">
            Loading team data.
          </p>
        </div>
      </div>
    );
  }

  if (!team) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">{team.name}</h1>
          <p className="text-muted-foreground">
            Team overview and match history.
          </p>
        </div>
      </div>
       <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm py-24">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">Feature Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              Detailed team stats and match history will be available here.
            </p>
          </div>
        </div>
    </div>
  );
}
