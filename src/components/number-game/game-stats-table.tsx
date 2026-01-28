'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Player } from "@/app/(app)/number-game/page";

const formatDismissal = (dismissal: Player['dismissal']) => {
    if (!dismissal) return 'Not Out';
    const { type, bowlerName, fielderName } = dismissal;

    switch(type) {
        case 'Bowled':
        case 'Hit wicket':
            return `${type.toLowerCase()} b. ${bowlerName}`;
        case 'Caught out':
            return `c. ${fielderName || 'fielder'} b. ${bowlerName}`;
        case 'Stumping':
            return `st. ${fielderName || 'keeper'} b. ${bowlerName}`;
        case 'Run out':
            return `run out (${fielderName || 'fielder'})`;
        case '3-dots':
             return `3-dots b. ${bowlerName}`;
        default:
            return `${type} b. ${bowlerName}`;
    }
}

export function GameStatsTable({ players }: { players: Player[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Game Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold mb-2">Batting</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Dismissal</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Balls</TableHead>
                <TableHead className="text-right">4s</TableHead>
                <TableHead className="text-right">6s</TableHead>
                <TableHead className="text-right">Duck</TableHead>
                <TableHead className="text-right">Golden Duck</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    {p.isOut ? formatDismissal(p.dismissal) : 'Not Out'}
                  </TableCell>
                  <TableCell className="text-right">{p.runs}</TableCell>
                  <TableCell className="text-right">{p.balls}</TableCell>
                  <TableCell className="text-right">{p.fours}</TableCell>
                  <TableCell className="text-right">{p.sixes}</TableCell>
                  <TableCell className="text-right">{p.duck ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-right">{p.goldenDuck ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <h3 className="font-semibold mt-6 mb-2">Bowling</h3>
        <div className="rounded-lg border">
          <Table>
              <TableHeader>
                  <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">Overs</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">Wickets</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {players.filter(p => p.ballsBowled > 0).map((p) => (
                       <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
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
