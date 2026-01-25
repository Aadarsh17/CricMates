'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Inning } from "@/lib/types";
import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";

type BattingStats = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissal: string;
};

type BowlingStats = {
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
};

const calculateStrikeRate = (runs: number, balls: number) => {
  if (balls === 0) return 0;
  return parseFloat(((runs / balls) * 100).toFixed(2));
};

const calculateEconomy = (runs: number, balls: number) => {
  if (balls === 0) return 0;
  const overs = balls / 6;
  return parseFloat((runs / overs).toFixed(2));
};

const formatOvers = (balls: number) => {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${overs}.${remainingBalls}`;
};

export const InningScorecard = ({ inning }: { inning: Inning }) => {
    const { getPlayerById, getTeamById, getPlayersByTeamId } = useAppContext();
    
    const battingTeam = getTeamById(inning.battingTeamId);
    const bowlingTeam = getTeamById(inning.bowlingTeamId);

    if (!battingTeam || !bowlingTeam) return null;

    const battingTeamPlayers = getPlayersByTeamId(battingTeam.id);
    
    const battingStats = new Map<string, BattingStats>();
    
    battingTeamPlayers.forEach(p => {
        battingStats.set(p.id, { runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: '' });
    });

    const wicketsTakenByBowler = new Map<string, number>();

    inning.deliveryHistory.forEach(d => {
        const strikerStat = battingStats.get(d.strikerId);
        if (strikerStat) {
            if (d.extra !== 'byes' && d.extra !== 'legbyes') {
                strikerStat.runs += d.runs;
            }

            if (d.extra !== 'wide') {
                strikerStat.balls += 1;
            }

            if (d.runs === 4 && (d.extra !== 'byes' && d.extra !== 'legbyes')) strikerStat.fours += 1;
            if (d.runs === 6 && (d.extra !== 'byes' && d.extra !== 'legbyes')) strikerStat.sixes += 1;

            if (d.isWicket) {
                const currentWickets = wicketsTakenByBowler.get(d.bowlerId) || 0;
                wicketsTakenByBowler.set(d.bowlerId, currentWickets + 1);
            }
        }
    });

    const outPlayerIds = new Set(inning.deliveryHistory.filter(d => d.isWicket).map(d => d.strikerId));
    const battedPlayerIds = new Set(inning.deliveryHistory.flatMap(d => [d.strikerId, d.nonStrikerId].filter(Boolean) as string[]));

    battingTeamPlayers.forEach(p => {
        const stat = battingStats.get(p.id);
        if (stat) {
            stat.strikeRate = calculateStrikeRate(stat.runs, stat.balls);

            if (outPlayerIds.has(p.id)) {
                const wicketDelivery = inning.deliveryHistory.find(d => d.isWicket && d.strikerId === p.id)!;
                const bowler = getPlayerById(wicketDelivery.bowlerId);
                stat.dismissal = wicketDelivery.outcome === 'Retired' ? 'Retired' : `b. ${bowler?.name || 'Unknown'}`;
            } else if (battedPlayerIds.has(p.id)) {
                stat.dismissal = 'Not Out';
            } else {
                stat.dismissal = 'Yet to bat';
            }
        }
    });

    const bowlingStats = new Map<string, BowlingStats>();
    const bowlersUsed = [...new Set(inning.deliveryHistory.map(d => d.bowlerId).filter(Boolean))];

    bowlersUsed.forEach(bowlerId => {
        const bowlerDeliveries = inning.deliveryHistory.filter(d => d.bowlerId === bowlerId);
        let runsConceded = 0;
        let legalBalls = 0;
        bowlerDeliveries.forEach(d => {
            runsConceded += d.runs;
            if(d.extra === 'wide' || d.extra === 'noball') runsConceded += 1;
            if(d.extra !== 'wide' && d.extra !== 'noball') legalBalls +=1;
        });

        const wickets = wicketsTakenByBowler.get(bowlerId) || 0;

        bowlingStats.set(bowlerId, {
            runs: runsConceded,
            overs: formatOvers(legalBalls),
            wickets: wickets,
            economy: calculateEconomy(runsConceded, legalBalls),
            maidens: 0, // Maiden calculation is complex, omitting for now
        })
    });
    
    const extrasTotal = inning.deliveryHistory.reduce((acc, d) => {
        if (d.extra === 'byes' || d.extra === 'legbyes') return acc + d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') return acc + 1;
        return acc;
    }, 0);


    // Sort batting order: batted, then yet to bat
    const sortedBattingPlayers = [...battingTeamPlayers].sort((a, b) => {
        const aBatted = battedPlayerIds.has(a.id);
        const bBatted = battedPlayerIds.has(b.id);
        if (aBatted && !bBatted) return -1;
        if (!aBatted && bBatted) return 1;
        return 0; // keep original order for players who batted/not batted
    });


    return (
        <Card>
            <CardHeader>
                <CardTitle>{battingTeam.name} Innings</CardTitle>
            </CardHeader>
            <CardContent>
                <h3 className="font-semibold mb-2 text-sm text-muted-foreground">BATTING</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Batsman</TableHead>
                            <TableHead className="text-right">R</TableHead>
                            <TableHead className="text-right">B</TableHead>
                            <TableHead className="text-right">4s</TableHead>
                            <TableHead className="text-right">6s</TableHead>
                            <TableHead className="text-right">SR</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedBattingPlayers.map(p => {
                            const stats = battingStats.get(p.id)!;
                            return (
                            <TableRow key={p.id}>
                                <TableCell>
                                    <p className="font-medium">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">{stats.dismissal}</p>
                                </TableCell>
                                <TableCell className="text-right">{stats.runs}</TableCell>
                                <TableCell className="text-right">{stats.balls}</TableCell>
                                <TableCell className="text-right">{stats.fours}</TableCell>
                                <TableCell className="text-right">{stats.sixes}</TableCell>
                                <TableCell className="text-right">{stats.strikeRate > 0 ? stats.strikeRate.toFixed(2): '0.00'}</TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>

                <div className="flex justify-between items-center mt-4 px-4 py-2 bg-muted/50 rounded-md">
                   <p className="text-sm">Extras: {extrasTotal}</p>
                   <p className="font-bold">Total: {inning.score}/{inning.wickets} <span className="font-normal text-sm text-muted-foreground">({inning.overs.toFixed(1)} Overs)</span></p>
                </div>

                <Separator className="my-6" />

                <h3 className="font-semibold mb-2 text-sm text-muted-foreground">BOWLING</h3>
                <Table>
                     <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Bowler</TableHead>
                            <TableHead className="text-right">O</TableHead>
                            <TableHead className="text-right">M</TableHead>
                            <TableHead className="text-right">R</TableHead>
                            <TableHead className="text-right">W</TableHead>
                            <TableHead className="text-right">ER</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bowlersUsed.map(bowlerId => {
                            const bowler = getPlayerById(bowlerId);
                            const stats = bowlingStats.get(bowlerId);
                            if (!bowler || !stats) return null;
                            return (
                                 <TableRow key={bowler.id}>
                                    <TableCell className="font-medium">{bowler.name}</TableCell>
                                    <TableCell className="text-right">{stats.overs}</TableCell>
                                    <TableCell className="text-right">{stats.maidens}</TableCell>
                                    <TableCell className="text-right">{stats.runs}</TableCell>
                                    <TableCell className="text-right">{stats.wickets}</TableCell>
                                    <TableCell className="text-right">{stats.economy > 0 ? stats.economy.toFixed(2): '0.00'}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>

            </CardContent>
        </Card>
    )
}
