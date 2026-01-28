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
import { Label } from '@/components/ui/label';
import type { Player } from '@/lib/types';

interface RetirePlayerDialogProps {
  open: boolean;
  onClose: () => void;
  striker: Player | undefined;
  onConfirm: () => void;
}

export function RetirePlayerDialog({ open, onClose, striker, onConfirm }: RetirePlayerDialogProps) {
  
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Retire Batsman</DialogTitle>
          <DialogDescription>
            Confirm retirement for the current striker. This will allow them to return to bat later.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <Label>Striker to Retire</Label>
            <p className="font-semibold p-2 bg-muted rounded-md">{striker?.name || 'No striker selected'}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!striker}>Confirm Retire Hurt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
