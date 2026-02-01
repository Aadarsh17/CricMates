'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Player, Match } from '@/lib/types';
import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';

interface SelectBowlerDialogProps {
  open: boolean;
  onClose: () => void;
  match: Match;
  players: Player[];
}

export function SelectBowlerDialog({ open, onClose, match, players }: SelectBowlerDialogProps) {
  const { setPlayerInMatch } = useAppContext();
  const [selectedBowler, setSelectedBowler] = useState<string | null>(null);

  const bowlers = useMemo(() => {
      const inning = match.innings[match.currentInning - 1];
      const bowlingTeamPlayerIds = inning.bowlingTeamId === match.team1Id ? match.team1PlayerIds : match.team2PlayerIds;
      const lastBowlerId = inning.deliveryHistory.at(-1)?.bowlerId;
      return players.filter(p => bowlingTeamPlayerIds?.includes(p.id) && p.id !== lastBowlerId);
  }, [match, players]);

  const handleSelect = () => {
    if (selectedBowler) {
      setPlayerInMatch(match, 'bowler', selectedBowler);
      setSelectedBowler(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Over Complete</DialogTitle>
          <DialogDescription>
            Select the bowler for the next over.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Label>New Bowler</Label>
            <Select onValueChange={setSelectedBowler} value={selectedBowler || ''}>
                <SelectTrigger>
                    <SelectValue placeholder="Select a bowler" />
                </SelectTrigger>
                <SelectContent>
                    {bowlers.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <DialogFooter>
          <Button onClick={handleSelect} disabled={!selectedBowler}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
