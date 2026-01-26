'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Team, Match, Player } from "@/lib/types";
import { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


type AggregatedPlayerStats = {
  player: Player;
  team: Team | undefined;
  matches: number;
  inningsBatted: number;
  runsScored: number;
  ballsFaced: number;
  outs: number;
  highestScore: number;
  battingAverage: number | null;
  strikeRate: number | null;
  fours: number;
  sixes: number;

  oversBowled: string;
  runsConceded: number;
  wicketsTaken: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
  bowlingAverage: number | null;
  economyRate: number | null;
};

const formatOvers = (balls: number) => {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${overs}.${remainingBalls}`;
};

const calculatePlayerStats = (players: Player[], teams: Team[], matches: Match[]): AggregatedPlayerStats[] => {
    return players.map(player => {
        let inningsBatted = 0;
        let runsScored = 0;
        let ballsFaced = 0;
        let outs = 0;
        let highestScore = 0;
        let fours = 0;
        let sixes = 0;
        
        let ballsBowled = 0;
        let runsConceded = 0;
        let wicketsTaken = 0;
        const bowlingInnings: { wickets: number, runs: number }[] = [];


        const playerMatches = matches.filter(m => m.status === 'completed' && (m.innings.some(i => i.battingTeamId === player.teamId || i.bowlingTeamId === player.teamId)));
        
        const uniqueMatchIds = new Set<string>();

        playerMatches.forEach(match => {
            let playedInMatch = false;

            match.innings.forEach(inning => {
                const isBattingInning = inning.battingTeamId === player.teamId;
                const isBowlingInning = inning.bowlingTeamId === player.teamId;

                if (isBattingInning) {
                    const playerDeliveriesAsStriker = inning.deliveryHistory.filter(d => d.strikerId === player.id);
                    const battedInInning = playerDeliveriesAsStriker.length > 0;
                   
                    if (battedInInning) {
                        playedInMatch = true;
                        inningsBatted++;
                        let runsThisInning = 0;
    
                        playerDeliveriesAsStriker.forEach(d => {
                            if (d.extra !== 'byes' && d.extra !== 'legbyes') {
                                runsScored += d.runs;
                                runsThisInning += d.runs;
                                if (d.runs === 4) fours++;
                                if (d.runs === 6) sixes++;
                            }
                            if (d.extra !== 'wide') {
                               ballsFaced++;
                            }
                        });

                        const wicketDelivery = inning.deliveryHistory.find(d => d.isWicket && d.strikerId === player.id);
                        if (wicketDelivery) {
                            outs++;
                        }

                        if (runsThisInning > highestScore) {
                            highestScore = runsThisInning;
                        }
                    }
                }
                
                if (isBowlingInning) {
                    const playerDeliveriesAsBowler = inning.deliveryHistory.filter(d => d.bowlerId === player.id);
                    if (playerDeliveriesAsBowler.length > 0) {
                         playedInMatch = true;
                         let wicketsThisInning = 0;
                         let runsConcededThisInning = 0;
    
                         playerDeliveriesAsBowler.forEach(d => {
                             if (d.extra !== 'wide' && d.extra !== 'noball') {
                                 ballsBowled++;
                             }
                             runsConceded += d.runs;
                             runsConcededThisInning += d.runs;
    
                             if (d.extra === 'wide' || d.extra === 'noball') {
                                 runsConceded++;
                                 runsConcededThisInning++;
                             }
                             if (d.isWicket && d.outcome !== 'Retired' && d.outcome !== 'run out') { // Simple check
                                 wicketsTaken++;
                                 wicketsThisInning++;
                             }
                         });
                         bowlingInnings.push({ wickets: wicketsThisInning, runs: runsConcededThisInning });
                    }
                }
            });
            if (playedInMatch) {
              uniqueMatchIds.add(match.id);
            }
        });
        
        const matchesPlayed = uniqueMatchIds.size;
        
        const battingAverage = outs > 0 ? runsScored / outs : null;
        const strikeRate = ballsFaced > 0 ? (runsScored / ballsFaced) * 100 : null;

        const bowlingAverage = wicketsTaken > 0 ? runsConceded / wicketsTaken : null;
        const economyRate = ballsBowled > 0 ? runsConceded / (ballsBowled / 6) : null;
        
        let bestBowlingWickets = 0;
        let bestBowlingRuns = Infinity;

        bowlingInnings.forEach(inning => {
            if (inning.wickets > bestBowlingWickets) {
                bestBowlingWickets = inning.wickets;
                bestBowlingRuns = inning.runs;
            } else if (inning.wickets === bestBowlingWickets && inning.runs < bestBowlingRuns) {
                bestBowlingRuns = inning.runs;
            }
        });
        
        return {
            player,
            team: teams.find(t => t.id === player.teamId),
            matches: matchesPlayed,
            inningsBatted,
            runsScored,
            ballsFaced,
            outs,
            highestScore,
            battingAverage,
            strikeRate,
            fours,
            sixes,

            oversBowled: formatOvers(ballsBowled),
            runsConceded,
            wicketsTaken,
            bestBowlingWickets: bestBowlingWickets,
            bestBowlingRuns: bestBowlingRuns === Infinity ? 0 : bestBowlingRuns,
            bowlingAverage,
            economyRate,
        };
    });
};

export function PlayerStatsTable({ players, teams, matches }: { players: Player[], teams: Team[], matches: Match[] }) {

  const [sortConfig, setSortConfig] = useState<{ key: keyof AggregatedPlayerStats; direction: 'ascending' | 'descending' } | null>({ key: 'runsScored', direction: 'descending' });
  
  const allPlayerStats = useMemo(() => calculatePlayerStats(players, teams, matches), [players, teams, matches]);

  const sortedPlayerStats = useMemo(() => {
    let sortableItems = [...allPlayerStats];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? -1;
        const bValue = b[sortConfig.key] ?? -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [allPlayerStats, sortConfig]);

  const requestSort = (key: keyof AggregatedPlayerStats) => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (name: keyof AggregatedPlayerStats) => {
    if (!sortConfig || sortConfig.key !== name) {
      return null;
    }
    return sortConfig.direction === 'descending' ? ' ▼' : ' ▲';
  };

  const statHeaders: { key: keyof AggregatedPlayerStats; label: string; tooltip: string, numeric: boolean }[] = [
    { key: 'matches', label: 'MP', tooltip: 'Matches Played', numeric: true },
    { key: 'runsScored', label: 'Runs', tooltip: 'Total Runs Scored', numeric: true },
    { key: 'highestScore', label: 'HS', tooltip: 'Highest Score', numeric: true },
    { key: 'battingAverage', label: 'Avg', tooltip: 'Batting Average', numeric: true },
    { key: 'strikeRate', label: 'SR', tooltip: 'Strike Rate', numeric: true },
    { key: 'wicketsTaken', label: 'Wkts', tooltip: 'Wickets Taken', numeric: true },
    { key: 'economyRate', label: 'Econ', tooltip: 'Economy Rate', numeric: true },
  ];

  if (players.length === 0) {
      return (
         <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm py-24">
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight">No Players Found</h3>
              <p className="text-sm text-muted-foreground">
                Add players to teams to see their stats.
              </p>
            </div>
          </div>
      )
  }

  return (
    <TooltipProvider>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] font-semibold">Player</TableHead>
              {statHeaders.map(header => (
                 <TableHead key={header.key} className="text-right font-semibold cursor-pointer" onClick={() => requestSort(header.key)}>
                   <Tooltip>
                     <TooltipTrigger className="cursor-help underline decoration-dashed">
                       {header.label}{getSortIndicator(header.key)}
                     </TooltipTrigger>
                     <TooltipContent>
                       <p>{header.tooltip}</p>
                     </TooltipContent>
                   </Tooltip>
                 </TableHead>
              ))}
              <TableHead className="text-right font-semibold">
                <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dashed">
                       BBI
                    </TooltipTrigger>
                    <TooltipContent>
                       <p>Best Bowling in an Inning</p>
                    </TooltipContent>
                 </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPlayerStats.map((stats) => (
              <TableRow key={stats.player.id}>
                <TableCell>
                    <p className="font-medium">{stats.player.name}</p>
                    <p className="text-xs text-muted-foreground">{stats.team?.name || 'No Team'}</p>
                </TableCell>
                <TableCell className="text-right">{stats.matches}</TableCell>
                <TableCell className="text-right font-bold">{stats.runsScored}</TableCell>
                <TableCell className="text-right">{stats.highestScore}</TableCell>
                <TableCell className="text-right">{stats.battingAverage?.toFixed(2) ?? '-'}</TableCell>
                <TableCell className="text-right">{stats.strikeRate?.toFixed(2) ?? '-'}</TableCell>
                <TableCell className="text-right font-bold">{stats.wicketsTaken}</TableCell>
                <TableCell className="text-right">{stats.economyRate?.toFixed(2) ?? '-'}</TableCell>
                <TableCell className="text-right">{stats.bestBowlingWickets > 0 ? `${stats.bestBowlingWickets}/${stats.bestBowlingRuns}` : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
