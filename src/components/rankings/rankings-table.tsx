'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Player, Team } from "@/lib/types";
import Image from "next/image";
import { Card } from "../ui/card";
import Link from "next/link";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";

export type RankedPlayer = {
    rank: number;
    player: Player;
    points: number;
}

export type RankedTeam = {
    rank: number;
    team: Team;
    points: number;
}

type RankingsTableProps = {
    data: (RankedPlayer[] | RankedTeam[]);
    type: 'player' | 'team';
}

export function RankingsTable({ data, type }: RankingsTableProps) {
    const { firestore: db } = useFirebase();
    const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
    const { data: teamsData } = useCollection<Team>(teamsCollection);
    const teams = teamsData || [];

    const getTeamById = (teamId: string) => teams.find(t => t.id === teamId);

    if (data.length === 0) {
        return (
            <Card className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
                <p className="text-muted-foreground">No data available for rankings.</p>
            </Card>
        )
    }

    return (
        <Card>
            <Table className="[&_td]:py-3 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px] font-semibold">Rank</TableHead>
                        <TableHead className="font-semibold">{type === 'player' ? 'Player' : 'Team'}</TableHead>
                        <TableHead className="text-right font-semibold">Points</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item) => {
                        if (type === 'player') {
                            const rankedPlayer = item as RankedPlayer;
                            return (
                                <TableRow key={rankedPlayer.player.id}>
                                    <TableCell className="font-bold text-muted-foreground text-lg">{rankedPlayer.rank}</TableCell>
                                    <TableCell>
                                        <Link href={`/players/${rankedPlayer.player.id}`} className="block hover:no-underline">
                                            <p className="font-semibold hover:underline">{rankedPlayer.player.name}</p>
                                            <p className="text-sm text-muted-foreground">{rankedPlayer.player.role}</p>
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-lg">{rankedPlayer.points}</TableCell>
                                </TableRow>
                            )
                        } else {
                            const rankedTeam = item as RankedTeam;
                            return (
                                <TableRow key={rankedTeam.team.id}>
                                    <TableCell className="font-bold text-muted-foreground text-lg">{rankedTeam.rank}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-4">
                                            <Image 
                                                src={rankedTeam.team.logoUrl} 
                                                alt={rankedTeam.team.name}
                                                width={40}
                                                height={40}
                                                className="rounded-full border"
                                                data-ai-hint={rankedTeam.team.imageHint}
                                            />
                                            <p className="font-semibold">{rankedTeam.team.name}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-lg">{rankedTeam.points}</TableCell>
                                </TableRow>
                            )
                        }
                    })}
                </TableBody>
            </Table>
        </Card>
    )
}
