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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { EditPlayerDialog } from "../players/edit-player-dialog";
import { DeletePlayerDialog } from "../players/delete-player-dialog";
import Link from "next/link";

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
  const [playerToEdit, setPlayerToEdit] = useState<Player | null>(null);

  const allPlayerStats = useMemo(() => calculatePlayerStats(players, teams, matches), [players, teams, matches]);

  const sortedPlayerStats = useMemo(() => {
    let stats = [...allPlayerStats];
    if (searchQuery) {
        stats = stats.filter(s => s.player.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (sortConfig) {
      stats.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? 0;
        const bVal = b[sortConfig.key] ?? 0;
        return sortConfig.direction === 'ascending' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
      });
    }
    return stats;
  }, [allPlayerStats, searchQuery, sortConfig]);

  const requestSort = (key: keyof AggregatedPlayerStats) => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (sortConfig?.key === key && sortConfig.direction === 'descending') direction = 'ascending';
    setSortConfig({ key, direction });
  };

  const headers: { key: keyof AggregatedPlayerStats; label: string; tooltip: string }[] = [
    { key: 'matches', label: 'M', tooltip: 'Matches' },
    { key: 'runsScored', label: 'R', tooltip: 'Runs' },
    { key: 'battingAverage', label: 'Avg', tooltip: 'Average' },
    { key: 'strikeRate', label: 'SR', tooltip: 'Strike Rate' },
    { key: 'wicketsTaken', label: 'W', tooltip: 'Wickets' },
    { key: 'economyRate', label: 'Econ', tooltip: 'Economy' },
  ];

  if (players.length === 0) {
      return (
         <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 p-6 text-center">
            <p className="text-muted-foreground">No players found. Add players to teams to see stats.</p>
          </div>
      )
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          className="pl-9 h-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="whitespace-nowrap w-full">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[180px] sticky left-0 bg-muted/50 z-10">Player</TableHead>
                {headers.map(h => (
                  <TableHead key={h.key} className="text-right cursor-pointer hover:text-primary transition-colors" onClick={() => requestSort(h.key)}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="font-bold underline decoration-dotted underline-offset-4">{h.label}</TooltipTrigger>
                        <TooltipContent>{h.tooltip}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                ))}
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayerStats.map((s) => (
                <TableRow key={s.player.id} className="hover:bg-muted/30">
                  <TableCell className="sticky left-0 bg-background/95 backdrop-blur-sm font-semibold text-sm">
                    <div className="flex flex-col">
                        <Link href={`/players/${s.player.id}`} className="hover:underline hover:text-primary transition-colors">
                            {s.player.name}
                        </Link>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.player.role}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{s.matches}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-sm">{s.runsScored}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{s.battingAverage?.toFixed(1) ?? '-'}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{s.strikeRate?.toFixed(1) ?? '-'}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-sm text-primary">{s.wicketsTaken}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{s.economyRate?.toFixed(1) ?? '-'}</TableCell>
                  <TableCell className="text-right">
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setPlayerToEdit(s.player)}>Edit</DropdownMenuItem>
                              <DeletePlayerDialog onDelete={() => onDeletePlayer(s.player.id)} />
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {playerToEdit && (
        <EditPlayerDialog
          player={playerToEdit}
          onPlayerEdit={(data) => onEditPlayer(playerToEdit.id, data)}
          open={!!playerToEdit}
          onOpenChange={(open) => !open && setPlayerToEdit(null)}
        />
      )}
    </div>
  );
}
