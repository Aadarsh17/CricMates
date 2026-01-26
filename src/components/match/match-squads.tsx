'use client';

import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, Star } from "lucide-react";
import type { Player } from "@/lib/types";

const PlayerListItem = ({ player }: { player: Player }) => (
    <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-medium">{player.name}</p>
                <p className="text-xs text-muted-foreground">{player.role}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {player.isCaptain && <Shield className="h-4 w-4 text-primary" title="Captain" />}
            {player.isWicketKeeper && <Star className="h-4 w-4 text-primary" title="Wicket-Keeper" />}
        </div>
    </div>
);

const TeamSquad = ({ teamId }: { teamId: string }) => {
    const { getTeamById, getPlayersByTeamId } = useAppContext();
    const team = getTeamById(teamId);
    const players = getPlayersByTeamId(teamId);

    if (!team) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{team.name} Squad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
                {players.length > 0 ? (
                    players.map(player => <PlayerListItem key={player.id} player={player} />)
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No players in this squad.</p>
                )}
            </CardContent>
        </Card>
    )
}

export function MatchSquads({ team1Id, team2Id }: { team1Id: string; team2Id: string; }) {
    return (
        <div className="grid md:grid-cols-2 gap-6">
            <TeamSquad teamId={team1Id} />
            <TeamSquad teamId={team2Id} />
        </div>
    );
}
