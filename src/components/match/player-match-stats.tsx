'use client';

import { Card, CardContent } from "@/components/ui/card";
import { type Player, type Inning } from "@/lib/types";

interface PlayerMatchStatsProps {
  striker: Player | undefined;
  nonStriker: Player | undefined;
  bowler: Player | undefined;
  inning: Inning;
}

const BatsmanStats = ({ player, inning, isStriker }: { player: Player | undefined, inning: Inning, isStriker: boolean }) => {
  if (!player) return <div className="flex-1 p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground h-[68px] flex items-center justify-center">Waiting for batsman...</div>;

  const stats = inning.deliveryHistory.reduce((acc, d) => {
    if (d.strikerId === player.id) {
      acc.runs += d.runs;
      if (!d.extra || d.extra === 'noball') {
        acc.balls += 1;
      }
    }
    return acc;
  }, { runs: 0, balls: 0 });

  return (
    <div className="flex-1 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between">
         <p className="font-semibold">{player.name}{isStriker ? '*' : ''}</p>
         <p className="font-bold text-lg">{stats.runs} <span className="text-sm font-normal text-muted-foreground">({stats.balls})</span></p>
      </div>
      <p className="text-xs text-muted-foreground">Batsman</p>
    </div>
  )
};

const BowlerStats = ({ player, inning }: { player: Player | undefined, inning: Inning }) => {
   if (!player) return <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground h-[68px] flex items-center justify-center">Waiting for bowler...</div>;

   const stats = inning.deliveryHistory.reduce((acc, d) => {
    if (d.bowlerId === player.id) {
      acc.runs += d.runs;
      if(d.extra) acc.runs += 1; // Add 1 for wide/no-ball
      if (d.isWicket) acc.wickets += 1;
      if (!d.extra) acc.balls += 1; // Legitimate deliveries only
    }
    return acc;
  }, { runs: 0, wickets: 0, balls: 0 });

  const overs = Math.floor(stats.balls / 6);
  const ballsInOver = stats.balls % 6;
  const oversString = `${overs}.${ballsInOver}`;
  
  return (
    <div className="p-4 bg-muted/30 rounded-lg">
      <p className="font-semibold mb-1">{player.name}</p>
      <div className="flex items-center justify-between text-sm">
        <p>Overs: <span className="font-mono">{oversString}</span></p>
        <p>Runs: <span className="font-mono">{stats.runs}</span></p>
        <p>Wickets: <span className="font-mono">{stats.wickets}</span></p>
      </div>
    </div>
  )
}

export function PlayerMatchStats({ striker, nonStriker, bowler, inning }: PlayerMatchStatsProps) {
    return (
        <Card>
            <CardContent className="p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                    <BatsmanStats player={striker} inning={inning} isStriker={true} />
                    <BatsmanStats player={nonStriker} inning={inning} isStriker={false} />
                </div>
                 <div>
                    <BowlerStats player={bowler} inning={inning} />
                </div>
            </CardContent>
        </Card>
    );
}
