'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAppContext } from '@/context/AppContext';
import { type Team, type Match } from '@/lib/types';
import Link from 'next/link';
import { Button } from '../ui/button';
import { format } from 'date-fns';
import { Trophy } from 'lucide-react';

interface TeamMatchHistoryDialogProps {
  team: Team;
  matches: Match[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TeamMatchHistoryDialog({ team, matches, open, onOpenChange }: TeamMatchHistoryDialogProps) {
  const { getTeamById } = useAppContext();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{team.name} - Match History</DialogTitle>
          <DialogDescription>
            A list of completed matches for {team.name}. Click a match to view the scorecard.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
            {matches.length > 0 ? (
                 <Table className="[&_td]:py-2 [&_td]:px-2 sm:[&_td]:px-4 [&_th]:px-2 sm:[&_th]:px-4">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Opponent</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(match => {
                            const opponentId = match.team1Id === team.id ? match.team2Id : match.team1Id;
                            const opponent = getTeamById(opponentId);
                            
                            return (
                                <TableRow key={match.id}>
                                    <TableCell>{format(new Date(match.date), 'PP')}</TableCell>
                                    <TableCell>{opponent?.name || 'Unknown'}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm">
                                            {match.result?.startsWith(team.name) && <Trophy className="w-4 h-4 text-primary"/>}
                                            <p className={`${match.result?.startsWith(team.name) ? 'font-semibold': ''}`}>{match.result}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={`/matches/${match.id}`}>View Scorecard</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                 </Table>
            ): (
                <div className="text-center text-muted-foreground py-10">
                    <p>No completed matches found for this team.</p>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
