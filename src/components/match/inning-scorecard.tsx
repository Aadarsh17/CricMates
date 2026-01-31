'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Inning, Match, Player, Team } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { calculatePlayerCVP } from "@/lib/stats";
import { useMemo } from "react";


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

export const InningScorecard = ({ inning, match, teams, players }: { inning: Inning; match: Match; teams: Team[], players: Player[] }) => {
    
    const getPlayerById = useMemo(() => (playerId: string) => players.find(p => p.id === playerId), [players]);
    const getTeamById = useMemo(() => (teamId: string) => teams.find(t => t.id === teamId), [teams]);
    const getPlayersByTeamId = useMemo(() => (teamId: string) => players.filter(p => p.teamId === teamId), [players]);

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

            if (d.isWicket && d.dismissal && d.dismissal.type !== 'Run out') {
                const currentWickets = wicketsTakenByBowler.get(d.bowlerId) || 0;
                wicketsTakenByBowler.set(d.bowlerId, currentWickets + 1);
            }
        }
    });

    const outPlayerIds = new Set(inning.deliveryHistory.filter(d => d.isWicket && d.dismissal).map(d => d.dismissal!.batsmanOutId));
    const battedPlayerIds = new Set(inning.deliveryHistory.flatMap(d => [d.strikerId, d.nonStrikerId].filter(Boolean) as string[]));

    battingTeamPlayers.forEach(p => {
        const stat = battingStats.get(p.id);
        if (stat) {
            stat.strikeRate = calculateStrikeRate(stat.runs, stat.balls);

            if (outPlayerIds.has(p.id)) {
                const wicketDelivery = inning.deliveryHistory.find(d => d.isWicket && d.dismissal?.batsmanOutId === p.id);
                if (wicketDelivery && wicketDelivery.dismissal) {
                    const bowler = getPlayerById(wicketDelivery.bowlerId);
                    const fielder = wicketDelivery.dismissal.fielderId ? getPlayerById(wicketDelivery.dismissal.fielderId) : null;
                    let dismissalString = '';

                    switch (wicketDelivery.dismissal.type) {
                        case 'Catch out':
                            dismissalString = `c ${fielder?.name || 'fielder'} b ${bowler?.name || 'bowler'}`;
                            break;
                        case 'Run out':
                            dismissalString = `run out (${fielder?.name || 'fielder'})`;
                            break;
                        case 'Stumping':
                            dismissalString = `st ${fielder?.name || 'keeper'} b ${bowler?.name || 'bowler'}`;
                            break;
                        case 'Bowled':
                            dismissalString = `b ${bowler?.name || 'bowler'}`;
                            break;
                        case 'Hit wicket':
                             dismissalString = `hit wicket b ${bowler?.name || 'bowler'}`;
                             break;
                        default:
                            dismissalString = `b ${bowler?.name || 'bowler'}`;
                            break;
                    }
                    stat.dismissal = dismissalString;
                } else {
                    stat.dismissal = 'Out'; // Fallback
                }
            } else if (battedPlayerIds.has(p.id)) {
                stat.dismissal = 'Not Out';
            } else {
                stat.dismissal = 'Yet to Bat';
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

    const sortedBattingPlayers = [...battingTeamPlayers].sort((a, b) => {
        const aBatted = battedPlayerIds.has(a.id);
        const bBatted = battedPlayerIds.has(b.id);
        const aOut = outPlayerIds.has(a.id);
        const bOut = outPlayerIds.has(b.id);

        if (aBatted && !bBatted) return -1;
        if (!aBatted && bBatted) return 1;

        if (aBatted && bBatted) {
            if (!aOut && bOut) return -1;
            if(aOut && !bOut) return 1;
        }

        return 0; // keep original order for players in same category
    });


    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-foreground p-3">
                <CardTitle className="text-lg text-background">{battingTeam.name} Innings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table className="whitespace-nowrap [&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
                    <TableHeader>
                        <TableRow className="bg-secondary hover:bg-secondary/90">
                            <TableHead className="w-[45%] text-secondary-foreground">Batsman</TableHead>
                            <TableHead className="text-right text-secondary-foreground">R</TableHead>
                            <TableHead className="text-right text-secondary-foreground">B</TableHead>
                            <TableHead className="text-right text-secondary-foreground">4s</TableHead>
                            <TableHead className="text-right text-secondary-foreground">6s</TableHead>
                            <TableHead className="text-right text-secondary-foreground">SR</TableHead>
                            <TableHead className="text-right text-secondary-foreground">CVP</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedBattingPlayers.map(p => {
                            const stats = battingStats.get(p.id)!;
                            const isYetToBat = stats.dismissal === 'Yet to Bat';
                            const cvp = match.status === 'completed' ? calculatePlayerCVP(p, match, players, teams) : 0;
                            return (
                            <TableRow key={p.id}>
                                <TableCell>
                                    <div>
                                        <p className="font-medium">{p.name}</p>
                                        <p className="text-xs text-muted-foreground">{stats.dismissal}</p>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">{isYetToBat ? '0' : stats.runs}</TableCell>
                                <TableCell className="text-right font-mono">{isYetToBat ? '0' : stats.balls}</TableCell>
                                <TableCell className="text-right font-mono">{isYetToBat ? '0' : stats.fours}</TableCell>
                                <TableCell className="text-right font-mono">{isYetToBat ? '0' : stats.sixes}</TableCell>
                                <TableCell className="text-right font-mono">{isYetToBat ? '0.00' : (stats.strikeRate > 0 ? stats.strikeRate.toFixed(2): '0.00')}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">{cvp}</TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>

                <div className="flex justify-between items-center px-4 py-2 bg-secondary/20">
                   <p className="text-sm">Extras: {extrasTotal}</p>
                   <p className="font-bold">Total: {inning.score}/{inning.wickets} <span className="font-normal text-sm text-muted-foreground">({inning.overs.toFixed(1)} Overs)</span></p>
                </div>

                <Table className="whitespace-nowrap [&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
                     <TableHeader>
                        <TableRow className="bg-secondary hover:bg-secondary/90">
                            <TableHead className="w-[45%] text-secondary-foreground">Bowler</TableHead>
                            <TableHead className="text-right text-secondary-foreground">O</TableHead>
                            <TableHead className="text-right text-secondary-foreground">M</TableHead>
                            <TableHead className="text-right text-secondary-foreground">R</TableHead>
                            <TableHead className="text-right text-secondary-foreground">W</TableHead>
                            <TableHead className="text-right text-secondary-foreground">ER</TableHead>
                            <TableHead className="text-right text-secondary-foreground">CVP</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bowlersUsed.map(bowlerId => {
                            const bowler = getPlayerById(bowlerId);
                            const stats = bowlingStats.get(bowlerId);
                            if (!bowler || !stats) return null;
                            const cvp = match.status === 'completed' ? calculatePlayerCVP(bowler, match, players, teams) : 0;
                            return (
                                 <TableRow key={bowler.id}>
                                    <TableCell>
                                      <div>
                                          <p className="font-medium">{bowler.name}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{stats.overs}</TableCell>
                                    <TableCell className="text-right font-mono">{stats.maidens}</TableCell>
                                    <TableCell className="text-right font-mono">{stats.runs}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold">{stats.wickets}</TableCell>
                                    <TableCell className="text-right font-mono">{stats.economy > 0 ? stats.economy.toFixed(2): '0.00'}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold">{cvp}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>

            </CardContent>
        </Card>
    )
}
