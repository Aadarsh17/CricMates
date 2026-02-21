'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';

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
import { PlusCircle, User, Upload } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Player name must be at least 2 characters long.',
  }),
  imageUrl: z.string().optional(),
  role: z.enum(['Batsman', 'Bowler', 'All-rounder'], { required_error: 'Please select a player role.'}),
  battingStyle: z.string().optional(),
  bowlingStyle: z.string().optional(),
  isWicketKeeper: z.boolean().default(false),
});

type PlayerFormData = z.infer<typeof formSchema>;

interface AddPlayerDialogProps {
  onPlayerAdd: (data: PlayerFormData) => void;
  trigger?: React.ReactNode;
}

export function AddPlayerDialog({ onPlayerAdd, trigger }: AddPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<PlayerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      imageUrl: '',
      role: undefined,
      battingStyle: undefined,
      bowlingStyle: undefined,
      isWicketKeeper: false,
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreviewUrl(base64String);
        form.setValue('imageUrl', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  function onSubmit(values: PlayerFormData) {
    onPlayerAdd(values);
    form.reset();
    setPreviewUrl(null);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Player
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Add New Player</DialogTitle>
              <DialogDescription>
                Enter the details for the new player.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center justify-center gap-4 py-2">
                <Avatar className="h-24 w-24 border-2">
                  <AvatarImage src={previewUrl || ''} className="object-cover" />
                  <AvatarFallback className="bg-muted">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('player-image-upload')?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Upload Photo
                  </Button>
                  <input
                    id="player-image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Player Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Sachin Tendulkar" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <Select onValueChange={field.onChange} value={field.value || ''}>
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
                    <Select onValueChange={field.onChange} value={field.value || ''}>
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
              <Button type="submit" className="w-full">Save Player</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
