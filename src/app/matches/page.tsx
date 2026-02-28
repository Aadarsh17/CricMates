"use client"

import { MOCK_MATCHES } from '@/lib/firebase-mock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, PlayCircle, Trophy, User } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';

export default function MatchesPage() {
  const { isUmpire } = useApp();
  const liveMatches = MOCK_MATCHES.filter(m => m.status === 'live');
  const pastMatches = MOCK_MATCHES.filter(m => m.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Match Center</h1>
          <p className="text-muted-foreground">Track live scores and review match history.</p>
        </div>
        {isUmpire && (
          <Button className="bg-secondary hover:bg-secondary/90">
            <PlayCircle className="mr-2 h-4 w-4" /> Start New Match
          </Button>
        )}
      </div>

      <Tabs defaultValue="live" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="live">Live Matches</TabsTrigger>
          <TabsTrigger value="past">Completed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="live" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {liveMatches.length > 0 ? (
              liveMatches.map(match => (
                <Card key={match.id} className="border-t-4 border-t-destructive shadow-sm overflow-hidden">
                  <div className="bg-destructive/5 p-2 text-center text-[10px] font-bold text-destructive flex items-center justify-center">
                    <span className="animate-pulse w-2 h-2 bg-destructive rounded-full mr-2" />
                    LIVE UPDATES
                  </div>
                  <CardHeader>
                    <div className="flex justify-between items-center mb-2">
                       <p className="text-xs text-muted-foreground flex items-center">
                        <Calendar className="w-3 h-3 mr-1" /> Today
                      </p>
                      <Badge variant="outline" className="text-destructive border-destructive">In Progress</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-center">
                        <p className="font-bold text-lg">{match.team1.name}</p>
                        <p className="text-2xl font-black text-primary">{match.currentScore.team1}</p>
                      </div>
                      <div className="text-muted-foreground font-bold">VS</div>
                      <div className="text-center">
                        <p className="font-bold text-lg">{match.team2.name}</p>
                        <p className="text-muted-foreground text-sm">{match.currentScore.team2}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-center italic text-muted-foreground bg-muted p-2 rounded-md">
                      {match.summary}
                    </p>
                    <div className="flex gap-2">
                      <Button className="flex-1" variant="outline" asChild>
                        <Link href={`/match/${match.id}`}>Scorecard</Link>
                      </Button>
                      <Button className="flex-1" asChild>
                        <Link href={`/match/${match.id}`}>Watch Live</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl">
                <PlayCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No matches are live right now.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          <div className="space-y-4">
            {pastMatches.map(match => (
              <Card key={match.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-stretch">
                    <div className="bg-primary text-white p-6 md:w-1/4 flex flex-col justify-center items-center text-center">
                      <Trophy className="w-8 h-8 mb-2 text-secondary" />
                      <p className="text-xs font-bold uppercase tracking-widest opacity-70">Result</p>
                      <p className="font-bold">{match.result}</p>
                    </div>
                    <div className="flex-1 p-6 flex items-center justify-between">
                      <div className="flex flex-col items-center flex-1 text-center px-4">
                        <p className="font-bold text-lg">{match.team1.name}</p>
                        <p className="text-2xl font-black text-primary/80">{match.currentScore.team1}</p>
                      </div>
                      <div className="text-muted-foreground font-black px-4">VS</div>
                      <div className="flex flex-col items-center flex-1 text-center px-4">
                        <p className="font-bold text-lg">{match.team2.name}</p>
                        <p className="text-2xl font-black text-primary/80">{match.currentScore.team2}</p>
                      </div>
                      <div className="ml-4 hidden md:block">
                        <Button variant="ghost" asChild>
                          <Link href={`/match/${match.id}`}>Details</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}