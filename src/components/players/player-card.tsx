import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Player } from "@/lib/types";
import { BarChart, Shield, Star, Trophy, Zap } from "lucide-react";

interface PlayerCardProps {
  player: Player;
}

export default function PlayerCard({ player }: PlayerCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-headline">{player.name}</CardTitle>
        <Badge variant={player.isRetired ? "outline" : "default"} className={player.isRetired ? "border-destructive text-destructive" : ""}>
          {player.isRetired ? "Retired" : player.role}
        </Badge>
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
