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

interface InningStartDialogProps {
  open: boolean;
  onClose: () => void;
  inningNumber: number;
  battingTeamName: string | undefined;
}

export function InningStartDialog({ open, onClose, inningNumber, battingTeamName }: InningStartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Inning {inningNumber} Starting</DialogTitle>
          <DialogDescription>
            {battingTeamName} will bat now.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>Start Inning</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
