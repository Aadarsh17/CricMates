"use client"

import { MOCK_MATCHES, MOCK_PLAYERS, MOCK_TEAMS } from '@/lib/firebase-mock';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Activity, Users, ArrowRight, PlayCircle } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const liveMatch = MOCK_MATCHES.find(m => m.status === 'live');
  const recentPlayers = MOCK_PLAYERS.slice(0, 3).sort((a, b) => b.stats.cvp - a.stats.cvp);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="relative rounded-2xl overflow-hidden h-[300px] flex items-center justify-center text-center">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0" 
          style={{ backgroundImage: `url('https://picsum.photos/seed/crickethero/1200/600')` }}
          data-ai-hint="cricket stadium"
        />
        <div className="absolute inset-0 bg-primary/70 z-10" />
        <div className="relative z-20 text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold font-headline mb-4">Master Your Cricket League</h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">Professional ball-by-ball scoring, player rankings, and team management for casual and professional leagues.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-secondary hover:bg-secondary/90" asChild>
              <Link href="/matches">View Live Scores</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 border-white hover:bg-white/20" asChild>
              <Link href="/teams">Manage Teams</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Match Card */}
        <Card className="lg:col-span-2 border-l-4 border-l-secondary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="text-destructive w-5 h-5 animate-pulse" />
              <CardTitle>Live Matches</CardTitle>
            </div>
            <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
          </CardHeader>
          <CardContent>
            {liveMatch ? (
              <div className="flex flex-col md:flex-row justify-between items-center p-4 bg-muted/50 rounded-xl space-y-4 md:space-y-0">
                <div className="flex items-center space-x-4 w-full md:w-auto">
                  <div className="text-center flex-1">
                    <p className="font-bold text-lg">{liveMatch.team1.name}</p>
                    <p className="text-2xl font-black text-primary">{liveMatch.currentScore.team1}</p>
                  </div>
                  <div className="text-muted-foreground font-bold">VS</div>
                  <div className="text-center flex-1">
                    <p className="font-bold text-lg">{liveMatch.team2.name}</p>
                    <p className="text-sm text-muted-foreground">{liveMatch.currentScore.team2}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center md:items-end w-full md:w-auto">
                  <p className="text-sm italic text-muted-foreground mb-4">{liveMatch.summary}</p>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/match/${liveMatch.id}`}>Watch Live <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No matches currently live.</p>
            )}
          </CardContent>
        </Card>

        {/* Top Rankings */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="text-secondary w-5 h-5" />
              <span>MVP Rankings</span>
            </CardTitle>
            <CardDescription>Top Cricket Value Points (CVP)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentPlayers.map((player, idx) => (
              <div key={player.id} className="flex items-center justify-between p-2 hover:bg-muted transition-colors rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-muted-foreground w-4">{idx + 1}</span>
                  <div>
                    <p className="font-medium">{player.name}</p>
                    <p className="text-xs text-muted-foreground">{player.role}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-bold">
                  {player.stats.cvp} pts
                </Badge>
              </div>
            ))}
            <Button variant="ghost" className="w-full mt-2 text-primary hover:text-primary hover:bg-primary/5" asChild>
              <Link href="/rankings">View All Rankings <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/number-game" className="group">
          <Card className="hover:border-secondary transition-all cursor-pointer h-full">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="bg-secondary/10 p-3 rounded-full group-hover:scale-110 transition-transform">
                <PlayCircle className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="font-bold">Number Game</h3>
              <p className="text-xs text-muted-foreground">Casual street cricket rules: 3 Dots = Out!</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/teams" className="group">
          <Card className="hover:border-primary transition-all cursor-pointer h-full">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="bg-primary/10 p-3 rounded-full group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold">Team Hub</h3>
              <p className="text-xs text-muted-foreground">Manage squads, view win rates and history.</p>
            </CardContent>
          </Card>
        </Link>
        {/* Placeholder for others */}
        <div className="hidden md:block">
           <Card className="bg-primary text-white h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div>
                <h3 className="text-xl font-bold mb-2">Ready to Score?</h3>
                <p className="text-sm opacity-80">Switch to Umpire mode to start a new match.</p>
              </div>
              <Trophy className="w-12 h-12 opacity-20 self-end" />
            </CardContent>
          </Card>
        </div>
        <div className="hidden md:block">
           <Card className="bg-secondary text-white h-full">
            <CardContent className="p-6 flex flex-col justify-between h-full">
              <div>
                <h3 className="text-xl font-bold mb-2">Public Share</h3>
                <p className="text-sm opacity-80">Send live scoreboard links to your friends.</p>
              </div>
              <Activity className="w-12 h-12 opacity-20 self-end" />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}