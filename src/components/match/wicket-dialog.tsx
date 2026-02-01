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
import type { Player } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';

interface WicketDialogProps {
  open: boolean;
  onClose: () => void;
  striker?: Player;
  nonStriker?: Player;
  availableBatsmen: Player[];
  bowlingTeamPlayers: Player[];
  onConfirm: (wicketData: {
    batsmanOutId: string;
    dismissalType: string;
    newBatsmanId?: string;
    fielderId?: string;
  }) => void;
}

const dismissalTypes = [
  'Bowled', 'Catch out', 'Run out', 'Stumping', 'Hit wicket'
];

export function WicketDialog({ open, onClose, striker, nonStriker, availableBatsmen, bowlingTeamPlayers, onConfirm }: WicketDialogProps) {
  const [batsmanOutId, setBatsmanOutId] = useState<string | undefined>(striker?.id);
  const [dismissalType, setDismissalType] = useState<string>('Bowled');
  const [newBatsmanId, setNewBatsmanId] = useState<string | undefined>();
  const [fielderId, setFielderId] = useState<string | undefined>();
  
  useEffect(() => {
    if(open) {
        setBatsmanOutId(striker?.id);
        setDismissalType('Bowled');
        setNewBatsmanId(undefined);
        setFielderId(undefined);
    }
  }, [open, striker]);

  const handleConfirm = () => {
    if (!batsmanOutId || !dismissalType) {
      return;
    }
     if ( (dismissalType === 'Catch out' || dismissalType === 'Run out' || dismissalType === 'Stumping') && !fielderId ) {
        return;
    }
    onConfirm({
      batsmanOutId,
      dismissalType,
      newBatsmanId,
      fielderId,
    });
    onClose();
  };

  const showFielderSelect = ['Catch out', 'Run out', 'Stumping'].includes(dismissalType);
  const wicketKeeper = bowlingTeamPlayers.find(p => p.isWicketKeeper);

  let fielderOptions = bowlingTeamPlayers;
  if(dismissalType === 'Stumping' && wicketKeeper) {
    fielderOptions = [wicketKeeper];
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Who is Out?</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
            <div className="py-4 space-y-6 pr-6">
              <div className="space-y-2">
                <Label>Which batsman is out?</Label>
                <RadioGroup value={batsmanOutId} onValueChange={setBatsmanOutId} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {striker && (
                    <div className="flex items-center space-x-2 p-3 border rounded-md">
                      <RadioGroupItem value={striker.id} id={`out-${striker.id}`} />
                      <Label htmlFor={`out-${striker.id}`} className="font-normal flex-1">{striker.name} (Striker)</Label>
                    </div>
                  )}
                  {nonStriker && (
                    <div className="flex items-center space-x-2 p-3 border rounded-md">
                      <RadioGroupItem value={nonStriker.id} id={`out-${nonStriker.id}`} />
                      <Label htmlFor={`out-${nonStriker.id}`} className="font-normal flex-1">{nonStriker.name} (Non-striker)</Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                  <Label>How did the batsman get out?</Label>
                  <RadioGroup onValueChange={setDismissalType} value={dismissalType} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dismissalTypes.map(type => (
                      <div key={type} className="flex items-center space-x-2 p-3 border rounded-md">
                          <RadioGroupItem value={type} id={`dismissal-${type}`} />
                          <Label htmlFor={`dismissal-${type}`} className="font-normal flex-1">{type}</Label>
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

               <div className="space-y-2">
                  <Label>Incoming Batsman (optional)</Label>
                  <Select onValueChange={setNewBatsmanId} value={newBatsmanId}>
                      <SelectTrigger>
                          <SelectValue placeholder="Select incoming batsman" />
                      </SelectTrigger>
                      <SelectContent>
                          {availableBatsmen.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>

            </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!batsmanOutId || !dismissalType || (showFielderSelect && !fielderId)}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}