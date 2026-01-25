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
import type { Player } from '@/lib/types';
import { useState } from 'react';

interface SelectBowlerDialogProps {
  open: boolean;
  bowlers: Player[];
  onBowlerSelect: (bowlerId: string) => void;
}

export function SelectBowlerDialog({ open, bowlers, onBowlerSelect }: SelectBowlerDialogProps) {
  const [selectedBowler, setSelectedBowler] = useState<string | null>(null);

  const handleSelect = () => {
    if (selectedBowler) {
      onBowlerSelect(selectedBowler);
      setSelectedBowler(null);
    }
  };

  return (
    <Dialog open={open}>
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
