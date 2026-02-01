'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Player, type Inning } from "@/lib/types";

const getBatsmanStats = (playerId: string, inning: Inning) => {
  const initialStats = { runs: 0, balls: 0, fours: 0, sixes: 0 };
  if (!playerId) return initialStats;

  const stats = inning.deliveryHistory.reduce((acc, d) => {
    if (d.strikerId === playerId) {
      if (d.extra !== 'byes' && d.extra !== 'legbyes') {
        acc.runs += d.runs;
        if(d.runs === 4) acc.fours += 1;
        if(d.runs === 6) acc.sixes += 1;
      }
      if (d.extra !== 'wide') {
        acc.balls += 1;
      }
    }
    return acc;
  }, initialStats);
  
  return stats;
};

const getBowlerStats = (playerId: string, inning: Inning) => {
    const initialStats = { runs: 0, wickets: 0, balls: 0, maidens: 0 };
    if (!playerId) return initialStats;

    const stats = inning.deliveryHistory.reduce((acc, d) => {
        if (d.bowlerId === playerId) {
            acc.runs += d.runs;
            if (d.extra === 'wide' || d.extra === 'noball') acc.runs += 1;
            if (d.isWicket && d.dismissal?.type !== 'Run out') acc.wickets += 1;
            if (d.extra !== 'wide' && d.extra !== 'noball') acc.balls += 1;
        }
        return acc;
    }, initialStats);

    // Maiden calculation would be complex here, so we'll omit it for now.
    return stats;
}


export function LivePlayerStats({ striker, nonStriker, bowler, inning }: { striker?: Player; nonStriker?: Player; bowler?: Player; inning: Inning; }) {
    const strikerStats = getBatsmanStats(striker?.id || '', inning);
    const nonStrikerStats = getBatsmanStats(nonStriker?.id || '', inning);
    const bowlerStats = getBowlerStats(bowler?.id || '', inning);
    
    const strikerSR = strikerStats.balls > 0 ? ((strikerStats.runs / strikerStats.balls) * 100).toFixed(2) : '0.00';
    const nonStrikerSR = nonStrikerStats.balls > 0 ? ((nonStrikerStats.runs / nonStrikerStats.balls) * 100).toFixed(2) : '0.00';

    const bowlerOvers = `${Math.floor(bowlerStats.balls / 6)}.${bowlerStats.balls % 6}`;
    const bowlerER = bowlerStats.balls > 0 ? (bowlerStats.runs / (bowlerStats.balls / 6)).toFixed(2) : '0.00';

    return (
        <div className="p-0">
            <Table className="whitespace-nowrap [&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[120px]">Player</TableHead>
                        <TableHead className="text-right">R</TableHead>
                        <TableHead className="text-right">B</TableHead>
                        <TableHead className="text-right">4s</TableHead>
                        <TableHead className="text-right">6s</TableHead>
                        <TableHead className="text-right">SR</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow className="bg-muted/30">
                        <TableCell className="font-semibold">{striker?.name || 'Select Striker'}{striker ? '*' : ''}</TableCell>
                        <TableCell className="text-right font-mono">{strikerStats.runs}</TableCell>
                        <TableCell className="text-right font-mono">{strikerStats.balls}</TableCell>
                        <TableCell className="text-right font-mono">{strikerStats.fours}</TableCell>
                        <TableCell className="text-right font-mono">{strikerStats.sixes}</TableCell>
                        <TableCell className="text-right font-mono">{strikerSR}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell className="font-semibold">{nonStriker?.name || 'Select Non-striker'}</TableCell>
                        <TableCell className="text-right font-mono">{nonStrikerStats.runs}</TableCell>
                        <TableCell className="text-right font-mono">{nonStrikerStats.balls}</TableCell>
                        <TableCell className="text-right font-mono">{nonStrikerStats.fours}</TableCell>
                        <TableCell className="text-right font-mono">{nonStrikerStats.sixes}</TableCell>
                        <TableCell className="text-right font-mono">{nonStrikerSR}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
            <div className="border-t">
                <Table className="whitespace-nowrap [&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Bowler</TableHead>
                            <TableHead className="text-right">O</TableHead>
                            <TableHead className="text-right">M</TableHead>
                            <TableHead className="text-right">R</TableHead>
                            <TableHead className="text-right">W</TableHead>
                            <TableHead className="text-right">ER</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         <TableRow>
                            <TableCell className="font-semibold">{bowler?.name || 'Select Bowler'}</TableCell>
                            <TableCell className="text-right font-mono">{bowlerOvers}</TableCell>
                            <TableCell className="text-right font-mono">{bowlerStats.maidens}</TableCell>
                            <TableCell className="text-right font-mono">{bowlerStats.runs}</TableCell>
                            <TableCell className="text-right font-mono">{bowlerStats.wickets}</TableCell>
                            <TableCell className="text-right font-mono">{bowlerER}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
