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
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useMemo } from "react";

interface TeamCardProps {
  team: Team;
  onEdit: (name: string) => void;
  onDelete: () => void;
}

export default function TeamCard({ team, onEdit, onDelete }: TeamCardProps) {
  const { firestore: db } = useFirebase();
  
  // Fetch some recent matches to calculate form
  const recentMatchesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'matches'),
      orderBy('date', 'desc'),
      limit(20)
    );
  }, [db]);

  const { data: matches } = useCollection<Match>(recentMatchesQuery);

  const teamForm = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter(m => m.status === 'completed' && (m.team1Id === team.id || m.team2Id === team.id))
      .slice(0, 5)
      .map(m => {
        if (m.result?.startsWith(team.name)) return 'W';
        if (m.result === 'Match is a Tie.') return 'T';
        return 'L';
      });
  }, [matches, team.id, team.name]);

  return (
    <Card className="flex flex-col hover:shadow-lg transition-all duration-300 border-primary/10 overflow-hidden h-full">
      <CardHeader className="flex flex-row items-start justify-between pb-2 bg-muted/20">
        <div className="space-y-1">
            <CardTitle className="text-lg font-headline truncate max-w-[180px]">{team.name}</CardTitle>
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
            <div className="h-24 w-24 relative rounded-full border-4 border-background bg-muted overflow-hidden shadow-md">
                <Image
                  src={team.logoUrl}
                  alt={`${team.name} logo`}
                  fill
                  className="object-cover"
                  data-ai-hint={team.imageHint}
                />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-background">
                {team.matchesWon}W - {team.matchesLost}L
            </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/10 p-4 mt-auto">
        <Button asChild className="w-full shadow-sm">
          <Link href={`/teams/${team.id}`}>Squad Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}