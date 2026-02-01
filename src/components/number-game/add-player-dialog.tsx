'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

interface AddPlayerDialogProps {
  onAddPlayer: (name: string) => void;
  disabled?: boolean;
}

export function AddPlayerDialog({ onAddPlayer, disabled }: AddPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      onAddPlayer(name.trim());
      setName('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
            <Plus className="mr-2 h-4 w-4" /> Add Player
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a New Player</DialogTitle>
          <DialogDescription>Enter the name of the player to add to the end of the batting order.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
            <Label htmlFor="playerName">Player Name</Label>
            <Input id="playerName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={handleAdd} disabled={!name.trim()}>Add Player</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
