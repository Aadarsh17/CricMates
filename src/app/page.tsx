
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Activity, Users, ArrowRight, PlayCircle } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const db = useFirestore();
  
  const liveMatchesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches'), where('status', '==', 'live'), limit(1)), 
  [db]);
  const { data: liveMatches } = useCollection(liveMatchesQuery);
  const liveMatch = liveMatches?.[0];

  const topPlayersQuery = useMemoFirebase(() => 
    query(collection(db, 'players'), orderBy('careerCVP', 'desc'), limit(3)), 
  [db]);
  const { data: topPlayers } = useCollection(topPlayersQuery);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="relative rounded-2xl overflow-hidden h-[400px] flex items-center justify-center text-center">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0" 
          style={{ backgroundImage: `url('https://picsum.photos/seed/crickethero/1200/600')` }}
          data-ai-hint="cricket stadium"
        />
        <div className="absolute inset-0 bg-primary/70 z-10" />
        <div className="relative z-20 text-white px-4">
          <Badge className="mb-4 bg-secondary text-white border-none">Professional Scoring Suite</Badge>
          <h1 className="text-4xl md:text-6xl font-bold font-headline mb-4 tracking-tight">CricMates ScoresTracker</h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">Ball-by-ball precision, real-time analytics, and comprehensive league management in one place.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-secondary hover:bg-secondary/90 h-12 px-8" asChild>
              <Link href="/matches">Live Match Center</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 border-white hover:bg-white/20 h-12 px-8" asChild>
              <Link href="/teams">Manage Teams</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-l-4 border-l-secondary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="text-destructive w-5 h-5 animate-pulse" />
              <CardTitle>Live Updates</CardTitle>
            </div>
            {liveMatch && <Badge variant="destructive" className="animate-pulse">LIVE NOW</Badge>}
          </CardHeader>
          <CardContent>
            {liveMatch ? (
              <div className="p-6 bg-muted/50 rounded-xl border border-border/50">
                <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                  <div className="flex-1 text-center">
                    <p className="font-bold text-xl mb-1">Team 1</p>
                    <p className="text-3xl font-black text-primary">Score Loading...</p>
                  </div>
                  <div className="px-6 font-black text-muted-foreground">VS</div>
                  <div className="flex-1 text-center">
                    <p className="font-bold text-xl mb-1">Team 2</p>
                    <p className="text-lg text-muted-foreground font-semibold">Yet to Bat</p>
                  </div>
                </div>
                <div className="mt-6 flex justify-center">
                  <Button variant="secondary" asChild>
                    <Link href={`/match/${liveMatch.id}`}>Watch Full Scorecard <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-xl">
                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No matches are currently active.</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/match/new">Start a match as Umpire</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-xl">
              <Trophy className="text-secondary w-5 h-5" />
              <span>MVP Rankings</span>
            </CardTitle>
            <CardDescription>Top Cricket Value Points (CVP)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPlayers && topPlayers.length > 0 ? topPlayers.map((player, idx) => (
              <div key={player.id} className="flex items-center justify-between p-3 hover:bg-muted transition-colors rounded-lg border border-transparent hover:border-border">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{player.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{player.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-primary">{player.careerCVP}</p>
                  <p className="text-[8px] uppercase font-bold text-muted-foreground">Points</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-center text-muted-foreground py-4">No player data available.</p>
            )}
            <Button variant="ghost" className="w-full mt-2 text-primary font-bold hover:bg-primary/5" asChild>
              <Link href="/rankings">Global Leaderboard <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Squad Hub', desc: 'Manage teams & players', icon: Users, href: '/teams', color: 'bg-blue-500' },
          { title: 'History', desc: 'Archive of past glories', icon: Activity, href: '/matches', color: 'bg-secondary' },
          { title: 'Number Game', desc: 'Casual street cricket', icon: PlayCircle, href: '/number-game', color: 'bg-destructive' },
          { title: 'New Match', desc: 'Official officiating', icon: PlayCircle, href: '/match/new', color: 'bg-primary' },
        ].map((item) => (
          <Link href={item.href} key={item.title} className="group">
            <Card className="hover:border-primary transition-all cursor-pointer h-full border-b-4 border-b-transparent hover:border-b-primary shadow-sm">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                <div className={`${item.color}/10 p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  <item.icon className={`w-8 h-8 ${item.color.replace('bg-', 'text-')}`} />
                </div>
                <h3 className="font-bold text-lg">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
