import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Player } from "@/lib/types";
import { BarChart, Shield, Star, Trophy, Zap, MoreVertical } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EditPlayerDialog } from "./edit-player-dialog";
import { DeletePlayerDialog } from "./delete-player-dialog";

interface PlayerCardProps {
  player: Player;
  onEdit: (data: { name: string; role: 'Batsman' | 'Bowler' | 'All-rounder'; isCaptain?: boolean, isWicketKeeper?: boolean }) => void;
  onDelete: () => void;
}

export default function PlayerCard({ player, onEdit, onDelete }: PlayerCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <CardTitle className="text-lg font-headline">{player.name} {player.isCaptain && <span className="text-sm font-medium text-muted-foreground">(Capt.)</span>}</CardTitle>
        <div className="flex items-center gap-1">
          <Badge variant={player.isRetired ? "outline" : "default"} className={player.isRetired ? "border-destructive text-destructive" : ""}>
            {player.isRetired ? "Retired" : player.role}
            {player.isWicketKeeper && !player.isRetired && ' / WK'}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <EditPlayerDialog player={player} onPlayerEdit={onEdit} />
              <DeletePlayerDialog onDelete={onDelete} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <BarChart className="h-4 w-4 text-primary" />
          <span>Matches: {player.stats.matches}</span>
        </div>
        <div className="flex items-center gap-3">
          <Zap className="h-4 w-4 text-primary" />
          <span>Runs: {player.stats.runs}</span>
        </div>
        <div className="flex items-center gap-3">
          <Star className="h-4 w-4 text-primary" />
          <span>Highest Score: {player.stats.highestScore}</span>
        </div>
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary" />
          <span>Wickets: {player.stats.wickets}</span>
        </div>
        <div className="flex items-center gap-3">
          <Trophy className="h-4 w-4 text-primary" />
          <span>Best Bowling: {player.stats.bestBowling}</span>
        </div>
      </CardContent>
    </Card>
  );
}
