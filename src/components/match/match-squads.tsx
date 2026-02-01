'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, Star, PlusCircle } from "lucide-react";
import type { Player, Match, Team } from "@/lib/types";
import { calculatePlayerCVP } from "@/lib/stats";
import { Badge } from "../ui/badge";
import { useMemo } from "react";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { useAppContext } from "@/context/AppContext";
import { AddPlayerDialog } from "../players/add-player-dialog";
import { Button } from "../ui/button";

const PlayerListItem = ({ player, cvp, isCaptain }: { player: Player, cvp: number, isCaptain: boolean }) => (
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
            {isCaptain && <Shield className="h-4 w-4 text-primary" title="Captain" />}
            {player.isWicketKeeper && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" title="Wicket-Keeper" />}
        </div>
    </div>
);

type PlayerFormData = {
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  isWicketKeeper?: boolean;
  battingStyle?: string;
  bowlingStyle?: string;
}

const TeamSquad = ({ teamId, playerIds, captainId, match, teams, players }: { teamId: string, playerIds: string[], captainId?: string, match: Match, teams: Team[], players: Player[] }) => {
    const { addPlayerToMatch } = useAppContext();
    const getTeamById = useMemo(() => (id: string) => teams.find(t => t.id === id), [teams]);
    const team = getTeamById(teamId);
    const teamPlayers = players.filter(p => playerIds.includes(p.id));

    if (!team) return null;

    const handleAddPlayer = (playerData: PlayerFormData) => {
        if (match.status === 'live') {
            addPlayerToMatch(match, team.id, playerData);
        }
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-foreground text-background p-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{team.name} Squad</CardTitle>
                 {match.status === 'live' && (
                    <AddPlayerDialog
                        onPlayerAdd={handleAddPlayer}
                        trigger={
                            <Button variant="ghost" size="icon" className="text-background hover:bg-white/20 hover:text-background">
                                <PlusCircle className="h-5 w-5" />
                                <span className="sr-only">Add Player</span>
                            </Button>
                        }
                    />
                )}
            </CardHeader>
            <CardContent className="p-4 space-y-1">
                {teamPlayers.length > 0 ? (
                    teamPlayers.map(player => {
                        const cvp = match.status === 'completed' ? calculatePlayerCVP(player, match, players, teams) : 0;
                        const isCaptain = player.id === captainId;
                        return <PlayerListItem key={player.id} player={player} cvp={cvp} isCaptain={isCaptain} />
                    })
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No players in this squad.</p>
                )}
            </CardContent>
        </Card>
    )
}

export function MatchSquads({ match, teams, players }: { match: Match; teams: Team[]; players: Player[] }) {
    if (!match.team1PlayerIds || !match.team2PlayerIds) {
        return <p>Squad information is not available for this match.</p>;
    }
    return (
        <div className="grid md:grid-cols-2 gap-6">
            <TeamSquad teamId={match.team1Id} playerIds={match.team1PlayerIds} captainId={match.team1CaptainId} match={match} teams={teams} players={players} />
            <TeamSquad teamId={match.team2Id} playerIds={match.team2PlayerIds} captainId={match.team2CaptainId} match={match} teams={teams} players={players} />
        </div>
    );
}
