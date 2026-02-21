
'use client';

import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Player, GameState } from "@/lib/number-game-types";

type AggregatedPlayer = Omit<Player, 'isOut' | 'dismissal' | 'consecutiveDots' | 'duck' | 'goldenDuck'> & {
    gamesPlayed: number;
    ducks: number;
    goldenDucks: number;
}

export function AggregatedStatsTable({ gameHistory }: { gameHistory: GameState[] }) {

  const aggregatedStats = useMemo(() => {
    const statsMap = new Map<string, AggregatedPlayer>();

    if (gameHistory.length > 0) {
      gameHistory[0].players.forEach(p => {
        statsMap.set(p.id, {
          id: p.id,
          name: p.name,
          gamesPlayed: 0,
          runs: 0, balls: 0, fours: 0, sixes: 0,
          oversBowled: 0, ballsBowled: 0, runsConceded: 0, wicketsTaken: 0,
          ducks: 0, goldenDucks: 0,
        });
      });
    }

    gameHistory.forEach(game => {
      game.players.forEach(playerInGame => {
        const stats = statsMap.get(playerInGame.id);
        if (stats) {
          stats.gamesPlayed++;
          stats.runs += playerInGame.runs;
          stats.balls += playerInGame.balls;
          stats.fours += playerInGame.fours;
          stats.sixes += playerInGame.sixes;
          stats.ballsBowled += playerInGame.ballsBowled;
          stats.runsConceded += playerInGame.runsConceded;
          stats.wicketsTaken += playerInGame.wicketsTaken;
          if (playerInGame.duck) stats.ducks++;
          if (playerInGame.goldenDuck) stats.goldenDucks++;
        }
      });
    });

    return Array.from(statsMap.values());
  }, [gameHistory]);

  if (aggregatedStats.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Career Stats (Number Game)</CardTitle>
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold mb-2">Batting</h3>
        <div className="rounded-lg border">
          <Table className="whitespace-nowrap [&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Games</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Balls</TableHead>
                <TableHead className="text-right">4s</TableHead>
                <TableHead className="text-right">6s</TableHead>
                <TableHead className="text-right">Ducks</TableHead>
                <TableHead className="text-right">Golden Ducks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregatedStats.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{p.gamesPlayed}</TableCell>
                  <TableCell className="text-right">{p.runs}</TableCell>
                  <TableCell className="text-right">{p.balls}</TableCell>
                  <TableCell className="text-right">{p.fours}</TableCell>
                  <TableCell className="text-right">{p.sixes}</TableCell>
                  <TableCell className="text-right">{p.ducks}</TableCell>
                  <TableCell className="text-right">{p.goldenDucks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <h3 className="font-semibold mt-6 mb-2">Bowling</h3>
        <div className="rounded-lg border">
          <Table className="whitespace-nowrap [&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
              <TableHeader>
                  <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">Games</TableHead>
                      <TableHead className="text-right">Overs</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">Wickets</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {aggregatedStats.filter(p => p.ballsBowled > 0).map((p) => (
                       <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.gamesPlayed}</TableCell>
                          <TableCell className="text-right">{`${Math.floor(p.ballsBowled / 6)}.${p.ballsBowled % 6}`}</TableCell>
                          <TableCell className="text-right">{p.runsConceded}</TableCell>
                          <TableCell className="text-right">{p.wicketsTaken}</TableCell>
                       </TableRow>
                  ))}
              </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
