
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, PlayCircle, Trophy, History, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';

export default function MatchesPage() {
  const { isUmpire } = useApp();
  const db = useFirestore();

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: matches, isLoading } = useCollection(matchesQuery);

  const liveMatches = matches?.filter(m => m.status === 'live') || [];
  const pastMatches = matches?.filter(m => m.status === 'completed') || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Match Center</h1>
          <p className="text-muted-foreground">Track live scores and review historic performances.</p>
        </div>
        {isUmpire && (
          <Button className="bg-secondary hover:bg-secondary/90" asChild>
            <Link href="/match/new">
              <PlayCircle className="mr-2 h-4 w-4" /> Start New Match
            </Link>
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
                <Card key={match.id} className="border-t-4 border-t-destructive shadow-md overflow-hidden hover:shadow-lg transition-all">
                  <div className="bg-destructive/10 p-2 text-center text-[10px] font-bold text-destructive flex items-center justify-center">
                    <span className="animate-pulse w-2 h-2 bg-destructive rounded-full mr-2" />
                    MATCH IN PROGRESS
                  </div>
                  <CardHeader>
                    <div className="flex justify-between items-center mb-4">
                       <p className="text-xs text-muted-foreground flex items-center">
                        <Calendar className="w-3 h-3 mr-1" /> {new Date(match.matchDate).toLocaleDateString()}
                      </p>
                      <Badge variant="destructive" className="animate-pulse uppercase text-[10px]">Live</Badge>
                    </div>
                    <div className="text-center py-4 bg-muted/50 rounded-xl">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Competing Teams</p>
                      <p className="font-black text-xl text-primary">Match # {match.id.slice(-4).toUpperCase()}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button className="w-full" asChild>
                      <Link href={`/match/${match.id}`}>Open Scoreboard <ArrowRight className="ml-2 w-4 h-4" /></Link>
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl">
                <PlayCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No matches are currently live.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          <div className="space-y-4">
            {pastMatches.length > 0 ? (
              pastMatches.map(match => (
                <Card key={match.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row items-stretch">
                      <div className="bg-primary text-white p-6 md:w-1/4 flex flex-col justify-center items-center text-center">
                        <Trophy className="w-8 h-8 mb-2 text-secondary" />
                        <p className="text-xs font-bold uppercase tracking-widest opacity-70">Outcome</p>
                        <p className="font-bold">{match.resultDescription || 'Result Pending'}</p>
                      </div>
                      <div className="flex-1 p-6 flex items-center justify-between">
                        <div className="flex flex-col items-center flex-1 text-center px-4">
                          <p className="font-bold text-lg">Team 1</p>
                          <p className="text-xs text-muted-foreground">ID: {match.team1Id.slice(0, 5)}</p>
                        </div>
                        <div className="text-muted-foreground font-black px-4">VS</div>
                        <div className="flex flex-col items-center flex-1 text-center px-4">
                          <p className="font-bold text-lg">Team 2</p>
                          <p className="text-xs text-muted-foreground">ID: {match.team2Id.slice(0, 5)}</p>
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
              ))
            ) : (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No past matches found in the archive.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
