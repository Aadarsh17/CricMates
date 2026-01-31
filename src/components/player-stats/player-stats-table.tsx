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
import { Input } from "@/components/ui/input";
import { MoreVertical, Search } from "lucide-react";
import { AggregatedPlayerStats, calculatePlayerStats } from "@/lib/stats";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { EditPlayerDialog } from "../players/edit-player-dialog";
import { DeletePlayerDialog } from "../players/delete-player-dialog";

type PlayerFormData = {
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder';
  isWicketKeeper?: boolean;
  battingStyle?: string;
  bowlingStyle?: string;
}
interface PlayerStatsTableProps {
  players: Player[];
  teams: Team[];
  matches: Match[];
  onEditPlayer: (playerId: string, playerData: PlayerFormData) => void;
  onDeletePlayer: (playerId: string) => void;
}


export function PlayerStatsTable({ players, teams, matches, onEditPlayer, onDeletePlayer }: PlayerStatsTableProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof AggregatedPlayerStats; direction: 'ascending' | 'descending' } | null>({ key: 'runsScored', direction: 'descending' });
  
  const allPlayerStats = useMemo(() => calculatePlayerStats(players, teams, matches), [players, teams, matches]);

  const filteredPlayerStats = useMemo(() => {
    if (!searchQuery) {
      return allPlayerStats;
    }
    return allPlayerStats.filter(stat =>
      stat.player.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allPlayerStats, searchQuery]);

  const sortedPlayerStats = useMemo(() => {
    let sortableItems = [...filteredPlayerStats];
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
  }, [filteredPlayerStats, sortConfig]);

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
    { key: 'ducks', label: 'Ducks', tooltip: 'Times Dismissed for 0 runs', numeric: true },
    { key: 'goldenDucks', label: 'GD', tooltip: 'Golden Ducks (out for 0 on first ball)', numeric: true },
    { key: 'wicketsTaken', label: 'Wkts', tooltip: 'Wickets Taken', numeric: true },
    { key: 'economyRate', label: 'Econ', tooltip: 'Economy Rate', numeric: true },
  ];

  if (players.length === 0) {
      return (
         <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm py-24">
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight">No Players Found</h3>
              <p className="text-sm text-muted-foreground">
                Add players to see their stats.
              </p>
            </div>
          </div>
      )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search for a player..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <TooltipProvider>
        <div className="rounded-lg border">
          <Table className="whitespace-nowrap [&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
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
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayerStats.map((stats) => (
                <TableRow key={stats.player.id}>
                  <TableCell>
                      <p className="font-bold">{stats.player.name}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{stats.player.role}</p>
                  </TableCell>
                  <TableCell className="text-right">{stats.matches}</TableCell>
                  <TableCell className="text-right font-bold">{stats.runsScored}</TableCell>
                  <TableCell className="text-right">{stats.highestScore}</TableCell>
                  <TableCell className="text-right">{stats.battingAverage?.toFixed(2) ?? '-'}</TableCell>
                  <TableCell className="text-right">{stats.strikeRate?.toFixed(2) ?? '-'}</TableCell>
                  <TableCell className="text-right">{stats.ducks}</TableCell>
                  <TableCell className="text-right">{stats.goldenDucks}</TableCell>
                  <TableCell className="text-right font-bold">{stats.wicketsTaken}</TableCell>
                  <TableCell className="text-right">{stats.economyRate?.toFixed(2) ?? '-'}</TableCell>
                  <TableCell className="text-right">{stats.bestBowlingWickets > 0 ? `${stats.bestBowlingWickets}/${stats.bestBowlingRuns}` : '-'}</TableCell>
                  <TableCell>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                              <EditPlayerDialog player={stats.player} onPlayerEdit={(data) => onEditPlayer(stats.player.id, data)} />
                              <DeletePlayerDialog onDelete={() => onDeletePlayer(stats.player.id)} />
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>
    </div>
  );
}
