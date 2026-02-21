'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { useAppContext } from "@/context/AppContext";
import type { Team, Player } from "@/lib/types";
import { Loader2, PlusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const matchSchema = z.object({
  team1Id: z.string().min(1, "Team 1 is required"),
  team2Id: z.string().min(1, "Team 2 is required"),
  overs: z.coerce.number().min(1, "Minimum 1 over").max(50, "Maximum 50 overs"),
  tossWinnerId: z.string().min(1, "Toss winner is required"),
  tossDecision: z.enum(['bat', 'bowl']),
  team1PlayerIds: z.array(z.string()).min(1, "Select at least 1 player for Team 1"),
  team2PlayerIds: z.array(z.string()).min(1, "Select at least 1 player for Team 2"),
  team1CaptainId: z.string().min(1, "Captain for Team 1 is required"),
  team2CaptainId: z.string().min(1, "Captain for Team 2 is required"),
}).refine(data => data.team1Id !== data.team2Id, {
    message: "Teams must be different",
    path: ["team2Id"]
});

export default function NewMatchPage() {
    const router = useRouter();
    const { firestore: db } = useFirebase();
    const { addMatch } = useAppContext();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const teamsCollection = useMemoFirebase(() => db ? collection(db, 'teams') : null, [db]);
    const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);

    const playersCollection = useMemoFirebase(() => db ? collection(db, 'players') : null, [db]);
    const { data: players, isLoading: playersLoading } = useCollection<Player>(playersCollection);

    const form = useForm<z.infer<typeof matchSchema>>({
        resolver: zodResolver(matchSchema),
        defaultValues: {
            overs: 20,
            tossDecision: 'bat',
            team1PlayerIds: [],
            team2PlayerIds: [],
        }
    });

    const watchTeam1 = form.watch('team1Id');
    const watchTeam2 = form.watch('team2Id');
    const watchTeam1Players = form.watch('team1PlayerIds');
    const watchTeam2Players = form.watch('team2PlayerIds');

    const selectedTeam1Players = useMemo(() => players?.filter(p => watchTeam1Players.includes(p.id)) || [], [players, watchTeam1Players]);
    const selectedTeam2Players = useMemo(() => players?.filter(p => watchTeam2Players.includes(p.id)) || [], [players, watchTeam2Players]);

    const onSubmit = async (values: z.infer<typeof matchSchema>) => {
        setIsSubmitting(true);
        try {
            const matchId = await addMatch(values);
            if (matchId) {
                router.push(`/matches/${matchId}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (teamsLoading || playersLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Setup New Match</h1>
                <p className="text-muted-foreground">Configure teams, squads, and toss details.</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-6 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="team1Id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Team 1</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Team 1" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {teams?.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="team2Id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Team 2</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Team 2" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {teams?.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="overs"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Match Overs</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 md:grid-cols-2">
                         <Card>
                            <CardHeader>
                                <CardTitle>Team 1 Squad</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <ScrollArea className="h-64 border rounded-md p-2">
                                    <div className="space-y-2">
                                        {players?.map(player => (
                                            <div key={player.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded">
                                                <Checkbox 
                                                    id={`t1-${player.id}`}
                                                    checked={watchTeam1Players.includes(player.id)}
                                                    onCheckedChange={(checked) => {
                                                        const current = form.getValues('team1PlayerIds');
                                                        if (checked) form.setValue('team1PlayerIds', [...current, player.id]);
                                                        else form.setValue('team1PlayerIds', current.filter(id => id !== player.id));
                                                    }}
                                                    disabled={watchTeam2Players.includes(player.id)}
                                                />
                                                <label htmlFor={`t1-${player.id}`} className="text-sm cursor-pointer flex-1">
                                                    {player.name} <span className="text-[10px] text-muted-foreground uppercase">{player.role}</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <FormField
                                    control={form.control}
                                    name="team1CaptainId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Team 1 Captain</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Captain" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {selectedTeam1Players.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                         </Card>

                         <Card>
                            <CardHeader>
                                <CardTitle>Team 2 Squad</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <ScrollArea className="h-64 border rounded-md p-2">
                                    <div className="space-y-2">
                                        {players?.map(player => (
                                            <div key={player.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded">
                                                <Checkbox 
                                                    id={`t2-${player.id}`}
                                                    checked={watchTeam2Players.includes(player.id)}
                                                    onCheckedChange={(checked) => {
                                                        const current = form.getValues('team2PlayerIds');
                                                        if (checked) form.setValue('team2PlayerIds', [...current, player.id]);
                                                        else form.setValue('team2PlayerIds', current.filter(id => id !== player.id));
                                                    }}
                                                    disabled={watchTeam1Players.includes(player.id)}
                                                />
                                                <label htmlFor={`t2-${player.id}`} className="text-sm cursor-pointer flex-1">
                                                    {player.name} <span className="text-[10px] text-muted-foreground uppercase">{player.role}</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <FormField
                                    control={form.control}
                                    name="team2CaptainId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Team 2 Captain</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Captain" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {selectedTeam2Players.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                         </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Toss Details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-6 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="tossWinnerId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Toss Winner</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Winner" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {watchTeam1 && <SelectItem value={watchTeam1}>{teams?.find(t => t.id === watchTeam1)?.name}</SelectItem>}
                                                {watchTeam2 && <SelectItem value={watchTeam2}>{teams?.find(t => t.id === watchTeam2)?.name}</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="tossDecision"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Decision</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Decision" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="bat">Bat</SelectItem>
                                                <SelectItem value="bowl">Bowl</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Start Match
                    </Button>
                </form>
            </Form>
        </div>
    );
}
