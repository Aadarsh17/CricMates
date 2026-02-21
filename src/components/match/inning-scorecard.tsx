
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Inning, Match, Player, Team, DeliveryRecord } from "@/lib/types";
import { useMemo } from "react";
import Link from "next/link";

type BattingStats = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissal: string;
  order: number;
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

    const battingTeam = getTeamById(inning.battingTeamId);
    const bowlingTeam = getTeamById(inning.bowlingTeamId);

    if (!battingTeam || !bowlingTeam) return null;

    const battingTeamPlayerIds = inning.battingTeamId === match.team1Id ? match.team1PlayerIds : match.team2PlayerIds;
    const battingTeamPlayers = players.filter(p => battingTeamPlayerIds?.includes(p.id)) || [];
    
    const orderOfAppearance: string[] = [];
    inning.deliveryHistory.forEach(d => {
        if (d.strikerId && !orderOfAppearance.includes(d.strikerId)) orderOfAppearance.push(d.strikerId);
        if (d.nonStrikerId && !orderOfAppearance.includes(d.nonStrikerId)) orderOfAppearance.push(d.nonStrikerId);
    });

    if (inning.strikerId && !orderOfAppearance.includes(inning.strikerId)) orderOfAppearance.push(inning.strikerId);
    if (inning.nonStrikerId && !orderOfAppearance.includes(inning.nonStrikerId)) orderOfAppearance.push(inning.nonStrikerId);

    const battingStats = new Map<string, BattingStats>();
    battingTeamPlayers.forEach(p => {
        const appearanceIdx = orderOfAppearance.indexOf(p.id);
        battingStats.set(p.id, { 
            runs: 0, 
            balls: 0, 
            fours: 0, 
            sixes: 0, 
            strikeRate: 0, 
            dismissal: '', 
            order: appearanceIdx === -1 ? 999 : appearanceIdx 
        });
    });

    const wicketsTakenByBowler = new Map<string, number>();
    const fallOfWickets: { score: number, wicket: number, over: string, player: string }[] = [];
    let currentTotalScore = 0;
    let currentLegalBalls = 0;
    let currentWicketsCount = 0;

    inning.deliveryHistory.forEach(d => {
        const strikerStat = battingStats.get(d.strikerId);
        if (strikerStat) {
            if (d.extra !== 'byes' && d.extra !== 'legbyes') {
                strikerStat.runs += d.runs;
                currentTotalScore += d.runs;
            }
            if (d.extra === 'wide' || d.extra === 'noball') {
                currentTotalScore += 1;
            }
            if (d.extra !== 'wide') {
                strikerStat.balls += 1;
                currentLegalBalls += 1;
            }
            if (d.runs === 4 && (d.extra !== 'byes' && d.extra !== 'legbyes')) strikerStat.fours += 1;
            if (d.runs === 6 && (d.extra !== 'byes' && d.extra !== 'legbyes')) strikerStat.sixes += 1;

            if (d.isWicket && d.dismissal) {
                currentWicketsCount++;
                const playerOut = getPlayerById(d.dismissal.batsmanOutId);
                fallOfWickets.push({
                    score: currentTotalScore,
                    wicket: currentWicketsCount,
                    over: formatOvers(currentLegalBalls),
                    player: playerOut?.name || 'Unknown'
                });

                if (d.dismissal.type !== 'Run out') {
                    const currentWickets = wicketsTakenByBowler.get(d.bowlerId) || 0;
                    wicketsTakenByBowler.set(d.bowlerId, currentWickets + 1);
                }
            }
        }
    });

    const outPlayerIds = new Set(inning.deliveryHistory.filter(d => d.isWicket && d.dismissal).map(d => d.dismissal!.batsmanOutId));
    const battedPlayerIds = new Set(orderOfAppearance);

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
                        case 'Catch out': dismissalString = `c ${fielder?.name || 'fielder'} b ${bowler?.name || 'bowler'}`; break;
                        case 'Run out': dismissalString = `run out (${fielder?.name || 'fielder'})`; break;
                        case 'Stumping': dismissalString = `st ${fielder?.name || 'keeper'} b ${bowler?.name || 'bowler'}`; break;
                        case 'Bowled': dismissalString = `b ${bowler?.name || 'bowler'}`; break;
                        case 'Hit wicket': dismissalString = `hit wicket b ${bowler?.name || 'bowler'}`; break;
                        default: dismissalString = `b ${bowler?.name || 'bowler'}`; break;
                    }
                    stat.dismissal = dismissalString;
                }
            } else if (battedPlayerIds.has(p.id)) {
                stat.dismissal = 'not out';
            } else {
                stat.dismissal = 'Yet to Bat';
            }
        }
    });

    const sortedBattingPlayers = [...battingTeamPlayers].sort((a, b) => {
        const statA = battingStats.get(a.id)!;
        const statB = battingStats.get(b.id)!;
        return statA.order - statB.order;
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
            maidens: 0,
        })
    });
    
    const extrasTotal = inning.deliveryHistory.reduce((acc, d) => {
        if (d.extra === 'byes' || d.extra === 'legbyes') return acc + d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') return acc + 1;
        return acc;
    }, 0);

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto">
                <Table className="whitespace-nowrap w-full">
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="min-w-[150px]">Batsman</TableHead>
                            <TableHead className="text-right">R</TableHead>
                            <TableHead className="text-right">B</TableHead>
                            <TableHead className="text-right">4s</TableHead>
                            <TableHead className="text-right">6s</TableHead>
                            <TableHead className="text-right">SR</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedBattingPlayers.map(p => {
                            const stats = battingStats.get(p.id);
                            if (!stats) return null;
                            const isYetToBat = stats.dismissal === 'Yet to Bat';
                            return (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <Link href={`/players/${p.id}`} className="font-semibold text-sm hover:underline hover:text-primary transition-colors">
                                                {p.name}
                                            </Link>
                                            <span className="text-xs text-muted-foreground">{stats.dismissal}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{isYetToBat ? '-' : stats.runs}</TableCell>
                                    <TableCell className="text-right font-mono">{isYetToBat ? '-' : stats.balls}</TableCell>
                                    <TableCell className="text-right font-mono">{isYetToBat ? '-' : stats.fours}</TableCell>
                                    <TableCell className="text-right font-mono">{isYetToBat ? '-' : stats.sixes}</TableCell>
                                    <TableCell className="text-right font-mono">{isYetToBat ? '-' : stats.strikeRate.toFixed(1)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="bg-muted/30 px-4 py-2 border-y flex justify-between text-sm">
                    <span>Extras: {extrasTotal}</span>
                    <span className="font-bold">Total: {inning.score}/{inning.wickets} ({inning.overs.toFixed(1)})</span>
                </div>
            </div>

            {fallOfWickets.length > 0 && (
                <div className="px-4 py-3 bg-muted/10 border rounded-lg">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Fall of Wickets</h4>
                    <p className="text-xs leading-relaxed">
                        {fallOfWickets.map((fw, i) => (
                            <span key={i}>
                                <span className="font-semibold">{fw.score}-{fw.wicket}</span> ({fw.player}, {fw.over} ov)
                                {i < fallOfWickets.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </p>
                </div>
            )}

            <div className="overflow-x-auto">
                <Table className="whitespace-nowrap w-full">
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="min-w-[150px]">Bowler</TableHead>
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
                                <TableRow key={bowlerId}>
                                    <TableCell>
                                        <Link href={`/players/${bowler.id}`} className="font-semibold text-sm hover:underline hover:text-primary transition-colors">
                                            {bowler.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{stats.overs}</TableCell>
                                    <TableCell className="text-right font-mono">{stats.maidens}</TableCell>
                                    <TableCell className="text-right font-mono">{stats.runs}</TableCell>
                                    <TableCell className="text-right font-mono font-bold text-primary">{stats.wickets}</TableCell>
                                    <TableCell className="text-right font-mono">{stats.economy.toFixed(1)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
