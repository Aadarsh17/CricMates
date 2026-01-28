'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Player } from '@/app/(app)/number-game/page';

interface WicketDialogProps {
  open: boolean;
  onClose: () => void;
  batsman: Player;
  allPlayers: Player[];
  bowler: Player;
  onConfirm: (wicketData: {
    dismissalType: string;
    fielderId?: string;
  }) => void;
}

const dismissalTypes = [
  'Bowled', 'Caught out', 'Run out', 'Stumping', 'Hit wicket'
];

export function WicketDialog({ open, onClose, batsman, allPlayers, bowler, onConfirm }: WicketDialogProps) {
  const [dismissalType, setDismissalType] = useState<string>('Bowled');
  const [fielderId, setFielderId] = useState<string | undefined>();

  useEffect(() => {
    if(open) {
        setDismissalType('Bowled');
        setFielderId(undefined);
    }
  }, [open]);

  const handleConfirm = () => {
    if (!dismissalType) return;
    if (showFielderSelect && !fielderId) return; // Require fielder if needed

    onConfirm({
      dismissalType,
      fielderId,
    });
    onClose();
  };

  const showFielderSelect = ['Caught out', 'Run out', 'Stumping'].includes(dismissalType);
  
  // Fielders can be any player except the batsman and the bowler
  const fielderOptions = allPlayers.filter(p => p.id !== batsman?.id && p.id !== bowler?.id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wicket: {batsman?.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-3">
            <Label>Dismissal Type</Label>
            <RadioGroup value={dismissalType} onValueChange={setDismissalType} className="grid grid-cols-2 gap-2">
              {dismissalTypes.map(type => (
                <div key={type} className="flex items-center space-x-2">
                  <RadioGroupItem value={type} id={`dismissal-${type}`} />
                  <Label htmlFor={`dismissal-${type}`} className="font-normal">{type}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          
          {showFielderSelect && (
            <div className="space-y-2">
                <Label>{dismissalType === 'Stumping' ? 'Wicket Keeper' : 'Fielder'}</Label>
                <Select onValueChange={setFielderId} value={fielderId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a player" />
                    </SelectTrigger>
                    <SelectContent>
                        {fielderOptions.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          )}

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!dismissalType || (showFielderSelect && !fielderId)}>Confirm Wicket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
