"use client"

import { MOCK_TEAMS, MOCK_PLAYERS } from '@/lib/firebase-mock';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';

export default function TeamsPage() {
  const { isUmpire } = useApp();
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Teams</h1>
          <p className="text-muted-foreground">Manage squads and view franchise performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted p-1 rounded-lg flex">
            <Button 
              variant={view === 'grid' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setView('grid')}
              className="px-2"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button 
              variant={view === 'list' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setView('list')}
              className="px-2"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          {isUmpire && (
            <Button className="bg-secondary hover:bg-secondary/90">
              <Plus className="mr-2 h-4 w-4" /> Register Team
            </Button>
          )}
        </div>
      </div>

      <div className={view === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
        {MOCK_TEAMS.map(team => {
          const teamPlayers = MOCK_PLAYERS.filter(p => p.teamId === team.id);
          
          if (view === 'grid') {
            return (
              <Card key={team.id} className="hover:shadow-lg transition-all group cursor-pointer border-t-4 border-t-primary">
                <CardHeader className="flex flex-row items-center space-x-4">
                  <Avatar className="w-16 h-16 border-2 border-muted shadow-sm group-hover:border-secondary transition-colors">
                    <AvatarImage src={team.logoUrl} />
                    <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="group-hover:text-primary transition-colors">{team.name}</CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Users className="w-3 h-3 mr-1" />
                      {teamPlayers.length} Players
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center mb-6">
                    <div className="bg-muted/50 p-2 rounded-lg">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Won</p>
                      <p className="text-lg font-black text-secondary">{team.stats.won}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded-lg">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Lost</p>
                      <p className="text-lg font-black text-destructive">{team.stats.lost}</p>
                    </div>
                    <div className="bg-muted/50 p-2 rounded-lg">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Points</p>
                      <p className="text-lg font-black text-primary">{team.stats.points}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Key Players</p>
                    <div className="flex -space-x-2">
                      {teamPlayers.slice(0, 4).map(p => (
                        <Avatar key={p.id} className="w-8 h-8 border-2 border-background">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            {p.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {teamPlayers.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold">
                          +{teamPlayers.length - 4}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" className="w-full justify-between mt-2 hover:bg-primary/5 hover:text-primary p-0 h-8 text-xs font-bold">
                      View Squad Details <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={team.id} className="hover:bg-muted/30 cursor-pointer transition-colors overflow-hidden">
               <div className="flex flex-col md:flex-row items-center p-4 gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={team.logoUrl} />
                  <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{team.name}</h3>
                  <div className="flex gap-4">
                    <span className="text-xs text-muted-foreground">NRR: {team.stats.nrr.toFixed(3)}</span>
                    <span className="text-xs text-muted-foreground">{teamPlayers.length} Members</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Matches</p>
                    <p className="font-bold">{team.stats.played}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Points</p>
                    <Badge className="bg-primary text-white font-bold">{team.stats.points}</Badge>
                  </div>
                  <Button variant="outline" size="sm">Manage</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}