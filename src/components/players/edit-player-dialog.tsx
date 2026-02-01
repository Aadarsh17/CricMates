'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { Player } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Player name must be at least 2 characters long.',
  }),
  role: z.enum(['Batsman', 'Bowler', 'All-rounder']),
  battingStyle: z.string().optional(),
  bowlingStyle: z.string().optional(),
  isWicketKeeper: z.boolean().default(false),
});

type PlayerFormData = z.infer<typeof formSchema>;

interface EditPlayerDialogProps {
  player: Player;
  onPlayerEdit: (data: PlayerFormData) => void;
}

export function EditPlayerDialog({ player, onPlayerEdit }: EditPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<PlayerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: player.name,
      role: player.role,
      battingStyle: player.battingStyle || 'Right-hand bat',
      bowlingStyle: player.bowlingStyle || 'None',
      isWicketKeeper: player.isWicketKeeper || false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: player.name,
        role: player.role,
        battingStyle: player.battingStyle || 'Right-hand bat',
        bowlingStyle: player.bowlingStyle || 'None',
        isWicketKeeper: player.isWicketKeeper || false,
      });
    }
  }, [player, open, form]);

  function onSubmit(values: PlayerFormData) {
    onPlayerEdit(values);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          Edit
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Player</DialogTitle>
              <DialogDescription>
                Update the details for the player.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Player Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Virat Kohli" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Batsman">Batsman</SelectItem>
                        <SelectItem value="Bowler">Bowler</SelectItem>
                        <SelectItem value="All-rounder">All-rounder</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="battingStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batting Style</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a batting style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Right-hand bat">Right-hand bat</SelectItem>
                        <SelectItem value="Left-hand bat">Left-hand bat</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bowlingStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bowling Style</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a bowling style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Right-hand fast">Right-hand fast</SelectItem>
                        <SelectItem value="Right-hand spinner (off-spin)">Right-hand spinner (off-spin)</SelectItem>
                        <SelectItem value="Left-hand fast">Left-hand fast</SelectItem>
                        <SelectItem value="Left-hand spinner">Left-hand spinner</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
                <FormField
                  control={form.control}
                  name="isWicketKeeper"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Wicket-Keeper</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
