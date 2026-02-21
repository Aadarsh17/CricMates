
'use client';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type Team, type Match } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../ui/button";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DeleteTeamDialog } from "./delete-team-dialog";
import { EditTeamDialog } from "./edit-team-dialog";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { useMemo } from "react";

interface TeamCardProps {
  team: Team;
  onEdit: (name: string) => void;
  onDelete: () => void;
}

export default function TeamCard({ team, onEdit, onDelete }: TeamCardProps) {
  const { firestore: db } = useFirebase();
  
  // Fetch recent matches for this team to show form
  const recentMatchesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'matches'),
      where('status', '==', 'completed'),
      orderBy('date', 'desc'),
      limit(5)
    );
  }, [db]);

  const { data: matches } = useCollection<Match>(recentMatchesQuery);

  const teamForm = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter(m => m.team1Id === team.id || m.team2Id === team.id)
      .map(m => {
        if (m.result?.startsWith(team.name)) return 'W';
        if (m.result === 'Match is a Tie.') return 'T';
        return 'L';
      });
  }, [matches, team.id, team.name]);

  return (
    <Card className="flex flex-col hover:shadow-lg transition-all duration-300 border-primary/10 overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between pb-2 bg-muted/20">
        <div className="space-y-1">
            <CardTitle className="text-lg font-headline">{team.name}</CardTitle>
            <div className="flex gap-1">
                {teamForm.map((res, i) => (
                    <span 
                        key={i} 
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${res === 'W' ? 'bg-green-500' : res === 'L' ? 'bg-red-500' : 'bg-gray-400'}`}
                    >
                        {res}
                    </span>
                ))}
                {teamForm.length === 0 && <span className="text-[10px] text-muted-foreground uppercase font-semibold">New Entry</span>}
            </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <EditTeamDialog team={team} onTeamEdit={onEdit} />
            <DeleteTeamDialog onDelete={onDelete} />
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center gap-4 text-center py-6">
        <div className="relative">
            <Image
              src={team.logoUrl}
              alt={`${team.name} logo`}
              width={100}
              height={100}
              className="rounded-full border-4 border-background shadow-md"
              data-ai-hint={team.imageHint}
            />
            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-background">
                {team.matchesWon}W - {team.matchesLost}L
            </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/10 pt-4">
        <Button asChild className="w-full shadow-sm">
          <Link href={`/teams/${team.id}`}>Squad Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
