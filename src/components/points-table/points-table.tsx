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
import { TeamMatchHistoryDialog } from "./team-match-history-dialog";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PointsTableEntry = {
  team: Team;
  played: number;
  won: number;
  lost: number;
  tied: number;
  nrr: number;
  points: number;
};

const getBallsFromOvers = (overs: number) => {
    return Math.floor(overs) * 6 + Math.round((overs % 1) * 10);
};

const calculatePointsTable = (teams: Team[], matches: Match[], players: Player[]): PointsTableEntry[] => {
    return teams.map(team => {
        const completedMatches = matches.filter(m => (m.team1Id === team.id || m.team2Id === team.id) && m.status === 'completed');
        
        let won = 0;
        let lost = 0;
        let tied = 0;

        let totalRunsScored = 0;
        let totalBallsFaced = 0;
        let totalRunsConceded = 0;
        let totalBallsBowled = 0;

        completedMatches.forEach(match => {
            // Points calculation
            if (match.result) {
                 if (match.result.startsWith(team.name)) {
                    won++;
                } else if (match.result === 'Match is a Tie.') {
                    tied++;
                } else {
                    lost++;
                }
            }

            // NRR calculation
            match.innings.forEach(inning => {
                const battingTeamPlayers = players.filter(p => p.teamId === inning.battingTeamId);
                const allOutWickets = battingTeamPlayers.length > 1 ? battingTeamPlayers.length - 1 : 10;
                const isAllOut = inning.wickets >= allOutWickets;

                if (inning.battingTeamId === team.id) { // Team was batting
                    totalRunsScored += inning.score;
                    const ballsForCalc = isAllOut ? match.overs * 6 : getBallsFromOvers(inning.overs);
                    totalBallsFaced += ballsForCalc;
                } else if (inning.bowlingTeamId === team.id) { // Team was bowling
                    totalRunsConceded += inning.score;
                    const bowlingTeamPlayers = players.filter(p => p.teamId === inning.bowlingTeamId);
                    const opponentAllOutWickets = bowlingTeamPlayers.length > 1 ? bowlingTeamPlayers.length - 1 : 10;
                    const opponentIsAllOut = inning.wickets >= opponentAllOutWickets;
                    
                    const ballsForCalc = opponentIsAllOut ? match.overs * 6 : getBallsFromOvers(inning.overs);
                    totalBallsBowled += ballsForCalc;
                }
            });
        });

        const points = (won * 2) + (tied * 1);
        
        const runRateFor = totalBallsFaced > 0 ? totalRunsScored / (totalBallsFaced / 6) : 0;
        const runRateAgainst = totalBallsBowled > 0 ? totalRunsConceded / (totalBallsBowled / 6) : 0;
        const nrr = runRateFor - runRateAgainst;

        return {
            team,
            played: completedMatches.length,
            won,
            lost,
            tied,
            nrr: isNaN(nrr) ? 0 : nrr,
            points,
        };
    }).sort((a, b) => {
        if (b.points !== a.points) {
            return b.points - a.points;
        }
        return b.nrr - a.nrr;
    });
};


export function PointsTable({ teams, matches, players }: { teams: Team[], matches: Match[], players: Player[] }) {

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const pointsTableData = useMemo(() => calculatePointsTable(teams, matches, players), [teams, matches, players]);

  if (teams.length === 0) {
      return (
         <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm py-24">
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight">No Teams Found</h3>
              <p className="text-sm text-muted-foreground">
                Add teams to see the points table.
              </p>
            </div>
          </div>
      )
  }

  const completedMatches = matches.filter(m => m.status === 'completed');

  return (
    <>
      {selectedTeam && (
        <TeamMatchHistoryDialog
          team={selectedTeam}
          matches={completedMatches.filter(m => m.team1Id === selectedTeam.id || m.team2Id === selectedTeam.id)}
          teams={teams}
          open={!!selectedTeam}
          onOpenChange={(isOpen) => !isOpen && setSelectedTeam(null)}
        />
      )}
      <div className="rounded-lg border">
        <Table className="[&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px] font-semibold">Team</TableHead>
              <TableHead className="text-center font-semibold">MP</TableHead>
              <TableHead className="text-center font-semibold">W</TableHead>
              <TableHead className="text-center font-semibold">L</TableHead>
              <TableHead className="text-center font-semibold">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="cursor-help underline decoration-dashed">
                      T/NR
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tied / No Result</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="text-right font-semibold">NRR</TableHead>
              <TableHead className="text-right font-semibold">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pointsTableData.map(({ team, played, won, lost, tied, nrr, points }) => (
              <TableRow key={team.id}>
                <TableCell>
                  <Button variant="link" className="p-0 h-auto font-medium text-foreground hover:no-underline" onClick={() => setSelectedTeam(team)}>
                    {team.name}
                  </Button>
                </TableCell>
                <TableCell className="text-center">{played}</TableCell>
                <TableCell className="text-center">{won}</TableCell>
                <TableCell className="text-center">{lost}</TableCell>
                <TableCell className="text-center">{tied}</TableCell>
                <TableCell className="text-right font-mono">{nrr.toFixed(3)}</TableCell>
                <TableCell className="text-right font-bold">{points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
