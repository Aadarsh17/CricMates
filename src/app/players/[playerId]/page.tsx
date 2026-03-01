
"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trophy, Activity, History as HistoryIcon, Target, Star, TrendingUp, User, ShieldCheck, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;
  const db = useFirestore();
  const router = useRouter();

  const playerRef = useMemoFirebase(() => doc(db, 'players', playerId), [db, playerId]);
  const { data: player, isLoading: isPlayerLoading } = useDoc(playerRef);

  const teamRef = useMemoFirebase(() => player?.teamId ? doc(db, 'teams', player.teamId) : null, [db, player?.teamId]);
  const { data: team } = useDoc(teamRef);

  // Query matches where the player was in the squad
  const matchesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches'), orderBy('matchDate', 'desc'), limit(10)), 
  [db]);
  const { data: allMatches } = useCollection(matchesQuery);

  const recentMatches = allMatches?.filter(m => 
    m.team1SquadPlayerIds?.includes(playerId) || m.team2SquadPlayerIds?.includes(playerId)
  ) || [];

  if (isPlayerLoading) return <div className="p-20 text-center font-black animate-pulse">LOADING PROFILE...</div>;
  if (!player) return <div className="p-20 text-center">Player not found.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0"><ArrowLeft className="w-5 h-5"/></Button>
        <Avatar className="w-20 h-20 border-4 border-primary shadow-xl">
            <AvatarImage src={player.imageUrl} />
            <AvatarFallback className="text-2xl font-black">{player.name[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-black font-headline tracking-tight">{player.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
             <Badge className="bg-primary text-white font-black uppercase text-[10px]">{player.role}</Badge>
             {team && <Badge variant="outline" className="text-[10px] font-bold border-primary text-primary">{team.name}</Badge>}
             {player.isWicketKeeper && <Badge className="bg-secondary text-white font-black uppercase text-[10px]">Wicket Keeper</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm rounded-xl overflow-hidden border-none bg-slate-900 text-white">
          <CardContent className="p-8">
             <div className="flex justify-between items-center mb-8">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cricket Value Points</p>
                    <h2 className="text-6xl font-black text-primary">{player.careerCVP}</h2>
                </div>
                <Trophy className="w-16 h-16 text-primary opacity-20" />
             </div>
             <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Matches</p>
                    <p className="text-2xl font-black">{player.matchesPlayed}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Runs</p>
                    <p className="text-2xl font-black">{player.runsScored}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Wickets</p>
                    <p className="text-2xl font-black">{player.wicketsTaken}</p>
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm border border-slate-100">
           <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-400"><Star className="w-3 h-3"/> Best Records</CardTitle></CardHeader>
           <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                 <span className="text-[10px] font-black uppercase text-slate-500">Highest Score</span>
                 <span className="text-xl font-black text-slate-900">{player.highestScore}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                 <span className="text-[10px] font-black uppercase text-slate-500">Best Bowling</span>
                 <span className="text-xl font-black text-slate-900">{player.bestBowlingFigures}</span>
              </div>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="batting" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-12 bg-slate-100 p-1 rounded-xl">
           <TabsTrigger value="batting" className="font-bold">Batting</TabsTrigger>
           <TabsTrigger value="bowling" className="font-bold">Bowling</TabsTrigger>
           <TabsTrigger value="fielding" className="font-bold">Fielding</TabsTrigger>
           <TabsTrigger value="recent" className="font-bold">History</TabsTrigger>
        </TabsList>

        <TabsContent value="batting" className="mt-6 space-y-4">
           <Card className="rounded-xl shadow-sm overflow-hidden">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow><TableHead className="font-black uppercase text-[10px]">Batting Statistic</TableHead><TableHead className="text-right font-black uppercase text-[10px]">Value</TableHead></TableRow>
                 </TableHeader>
                 <TableBody>
                    <TableRow><TableCell className="font-bold">Total Runs</TableCell><TableCell className="text-right font-black">{player.runsScored}</TableCell></TableRow>
                    <TableRow><TableCell className="font-bold">Highest Score</TableCell><TableCell className="text-right font-black">{player.highestScore}</TableCell></TableRow>
                    <TableRow><TableCell className="font-bold">Style</TableCell><TableCell className="text-right font-black">{player.battingStyle}</TableCell></TableRow>
                    <TableRow><TableCell className="font-bold">Avg / SR</TableCell><TableCell className="text-right font-black text-slate-400">Stat Pending...</TableCell></TableRow>
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="bowling" className="mt-6 space-y-4">
           <Card className="rounded-xl shadow-sm overflow-hidden">
              <Table>
                 <TableHeader className="bg-slate-50">
                    <TableRow><TableHead className="font-black uppercase text-[10px]">Bowling Statistic</TableHead><TableHead className="text-right font-black uppercase text-[10px]">Value</TableHead></TableRow>
                 </TableHeader>
                 <TableBody>
                    <TableRow><TableCell className="font-bold">Total Wickets</TableCell><TableCell className="text-right font-black text-primary">{player.wicketsTaken}</TableCell></TableRow>
                    <TableRow><TableCell className="font-bold">Best Figures</TableCell><TableCell className="text-right font-black">{player.bestBowlingFigures}</TableCell></TableRow>
                    <TableRow><TableCell className="font-bold">Recent Economy</TableCell><TableCell className="text-right font-black text-slate-400">---</TableCell></TableRow>
                 </TableBody>
              </Table>
           </Card>
        </TabsContent>

        <TabsContent value="fielding" className="mt-6">
            <Card className="p-8 text-center border-2 border-dashed rounded-xl bg-slate-50/50">
                <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Fielding metrics coming soon</p>
            </Card>
        </TabsContent>

        <TabsContent value="recent" className="mt-6 space-y-3">
           {recentMatches.length > 0 ? recentMatches.map(match => (
              <Card key={match.id} className="rounded-xl shadow-sm border-l-4 border-l-primary hover:border-primary transition-all">
                 <CardContent className="p-4 flex items-center justify-between">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{new Date(match.matchDate).toLocaleDateString()}</p>
                       <p className="font-black text-sm">vs {match.team1Id === player.teamId ? match.team2Name : match.team1Name}</p>
                       <p className="text-[10px] font-bold text-primary uppercase">{match.resultDescription}</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="text-[10px] font-black uppercase text-primary">
                       <Link href={`/match/${match.id}`}>View Scorecard <ChevronRight className="w-3 h-3 ml-1"/></Link>
                    </Button>
                 </CardContent>
              </Card>
           )) : (
              <div className="py-20 text-center border-2 border-dashed rounded-xl bg-slate-50/50">
                 <HistoryIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                 <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No recent matches found</p>
              </div>
           )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
