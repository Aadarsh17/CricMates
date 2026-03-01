
"use client"

import { useState } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserCircle, Star, ShieldCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';

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
    <div className="space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline tracking-tight text-slate-900">Player Pool</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">League Participant Directory</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search players or roles..." 
            className="pl-10 h-11 shadow-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse h-40 bg-slate-50 border-none" />
          ))}
        </div>
      ) : filteredPlayers && filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredPlayers.map(player => (
            <Link key={player.id} href={`/players/${player.id}`} className="group">
              <Card className="hover:shadow-md transition-all border-l-4 border-l-slate-200 hover:border-l-primary group-hover:border-primary overflow-hidden cursor-pointer h-full">
                <CardContent className="p-0">
                  <div className="p-4 flex items-center gap-4">
                    <Avatar className="w-12 h-12 border-2 border-slate-100 group-hover:border-primary/20 transition-colors">
                      <AvatarImage src={player.imageUrl} />
                      <AvatarFallback className="font-black text-slate-400">{player.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-slate-900 truncate group-hover:text-primary transition-colors">{player.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-[8px] font-black uppercase px-1 py-0 h-4">{player.role}</Badge>
                        {player.isWicketKeeper && <Badge className="bg-secondary text-[8px] px-1 py-0 h-4 text-white">WK</Badge>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="bg-slate-50/50 p-3 border-t grid grid-cols-3 gap-1 text-center group-hover:bg-primary/5 transition-colors">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Runs</p>
                      <p className="text-xs font-black">{player.runsScored}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Wkts</p>
                      <p className="text-xs font-black">{player.wicketsTaken}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">CVP</p>
                      <p className="text-xs font-black text-primary">{player.careerCVP}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
          <UserCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No players found matching your search</p>
        </div>
      )}
    </div>
  );
}
