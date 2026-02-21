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
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { Team } from '@/lib/types';
import { Upload, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Team name must be at least 2 characters long.',
  }),
  logoUrl: z.string().optional(),
});

interface EditTeamDialogProps {
  team: Team;
  onTeamEdit: (name: string, logoUrl?: string) => void;
}

export function EditTeamDialog({ team, onTeamEdit }: EditTeamDialogProps) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(team.logoUrl || null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: team.name,
      logoUrl: team.logoUrl || '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: team.name,
        logoUrl: team.logoUrl || '',
      });
      setPreviewUrl(team.logoUrl || null);
    }
  }, [open, team, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreviewUrl(base64String);
        form.setValue('logoUrl', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    onTeamEdit(values.name, values.logoUrl);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          Edit Team
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Team</DialogTitle>
              <DialogDescription>
                Update the name and logo for your team.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-6">
              <div className="flex flex-col items-center justify-center gap-4">
                <Avatar className="h-24 w-24 border-4 border-muted shadow-inner">
                  <AvatarImage src={previewUrl || ''} className="object-cover" />
                  <AvatarFallback className="bg-muted">
                    <Shield className="h-12 w-12 text-muted-foreground/40" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('team-logo-edit-upload')?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Change Logo
                  </Button>
                  <input
                    id="team-logo-edit-upload"
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
                    <FormLabel>Team Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Royal Challengers" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
