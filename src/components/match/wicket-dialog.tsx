'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-lg max-h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Who is Out?</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-grow">
            <div className="py-4 space-y-6 pr-4">
              <div className="space-y-2">
                <Label>Which batsman is out?</Label>
                <RadioGroup value={batsmanOutId} onValueChange={setBatsmanOutId} className="flex flex-col gap-2">
                  {striker && (
                    <div className="flex items-center space-x-2 p-2 border rounded-md">
                      <RadioGroupItem value={striker.id} id={`out-${striker.id}`} />
                      <Label htmlFor={`out-${striker.id}`} className="font-normal flex-1">{striker.name} (Striker)</Label>
                    </div>
                  )}
                  {nonStriker && (
                    <div className="flex items-center space-x-2 p-2 border rounded-md">
                      <RadioGroupItem value={nonStriker.id} id={`out-${nonStriker.id}`} />
                      <Label htmlFor={`out-${nonStriker.id}`} className="font-normal flex-1">{nonStriker.name} (Non-striker)</Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                  <Label>How did the batsman get out?</Label>
                  <RadioGroup onValueChange={setDismissalType} value={dismissalType} className="grid grid-cols-1 gap-y-2">
                    {dismissalTypes.map(type => (
                      <div key={type} className="flex items-center space-x-2 p-2 border rounded-md">
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
        <SheetFooter className="pt-4 border-t mt-auto">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleConfirm} disabled={!batsmanOutId || !dismissalType || (showFielderSelect && !fielderId)} className="w-full sm:w-auto">Submit</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
