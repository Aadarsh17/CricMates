'use client';

import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, Star } from "lucide-react";
import type { Player, Match } from "@/lib/types";
import { calculatePlayerCVP } from "@/lib/stats";
import { Badge } from "../ui/badge";

const PlayerListItem = ({ player, cvp }: { player: Player, cvp: number }) => (
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg -mx-2 transition-colors">
        <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
                <AvatarFallback>{player.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-semibold text-sm">{player.name}</p>
                <p className="text-xs text-muted-foreground">{player.role}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {cvp > 0 && <Badge variant="secondary">{cvp} CVP</Badge>}
            {player.isCaptain && <Shield className="h-4 w-4 text-primary" title="Captain" />}
            {player.isWicketKeeper && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" title="Wicket-Keeper" />}
        </div>
    </div>
);

const TeamSquad = ({ teamId, match }: { teamId: string, match: Match }) => {
    const { getTeamById, getPlayersByTeamId, players: allPlayers, teams: allTeams } = useAppContext();
    const team = getTeamById(teamId);
    const players = getPlayersByTeamId(teamId);

    if (!team) return null;

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-foreground text-background p-4">
                <CardTitle className="text-lg">{team.name} Squad</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-1">
                {players.length > 0 ? (
                    players.map(player => {
                        const cvp = match.status === 'completed' ? calculatePlayerCVP(player, match, allPlayers, allTeams) : 0;
                        return <PlayerListItem key={player.id} player={player} cvp={cvp} />
                    })
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No players in this squad.</p>
                )}
            </CardContent>
        </Card>
    )
}

export function MatchSquads({ match }: { match: Match }) {
    return (
        <div className="grid md:grid-cols-2 gap-6">
            <TeamSquad teamId={match.team1Id} match={match} />
            <TeamSquad teamId={match.team2Id} match={match} />
        </div>
    );
}
