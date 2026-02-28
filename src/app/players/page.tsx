
"use client"

import { useState } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserCircle, Star, ShieldCheck } from 'lucide-react';

export default function PlayersPage() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: players, isLoading } = useCollection(playersQuery);

  const filteredPlayers = players?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Player Pool</h1>
          <p className="text-muted-foreground">Comprehensive directory of all league participants.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search players or roles..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse h-40 bg-muted" />
          ))}
        </div>
      ) : filteredPlayers && filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredPlayers.map(player => (
            <Card key={player.id} className="hover:shadow-md transition-all group overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 flex items-center gap-4">
                  <Avatar className="w-12 h-12 border-2 border-primary/10 group-hover:border-primary transition-colors">
                    <AvatarImage src={player.imageUrl} />
                    <AvatarFallback>{player.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{player.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">{player.role}</Badge>
                      {player.isWicketKeeper && <Badge className="bg-secondary text-[8px] px-1 py-0">WK</Badge>}
                    </div>
                  </div>
                </div>
                <div className="bg-muted/30 p-4 border-t grid grid-cols-3 gap-1 text-center">
                  <div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Runs</p>
                    <p className="text-sm font-black">{player.runsScored}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Wkts</p>
                    <p className="text-sm font-black">{player.wicketsTaken}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">CVP</p>
                    <p className="text-sm font-black text-primary">{player.careerCVP}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center border-2 border-dashed rounded-2xl">
          <UserCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground">No players found matching your search.</p>
        </div>
      )}
    </div>
  );
}
