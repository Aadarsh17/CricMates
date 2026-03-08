"use client"

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { PlayCircle, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft, UserPlus, Search, ChevronLeft, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function NewMatchPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isQuickRegOpen, setIsQuickRegOpen] = useState(false);
  const [quickRegTarget, setQuickRegTarget] = useState<'team1' | 'team2'>('team1');
  const [quickRegName, setQuickRegName] = useState('');

  const [setup, setSetup] = useState({
    team1Id: '',
    team2Id: '',
    team1Squad: [] as string[],
    team2Squad: [] as string[],
    totalOvers: '6',
    tossWinner: '',
    tossDecision: 'bat',
    strikerId: '',
    nonStrikerId: '',
    bowlerId: ''
  });

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams'), orderBy('name', 'asc')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  useEffect(() => {
    const t1 = searchParams.get('t1');
    const t2 = searchParams.get('t2');
    if (t1 && t2) setSetup(prev => ({ ...prev, team1Id: t1, team2Id: t2, totalOvers: searchParams.get('overs') || '6' }));
  }, [searchParams]);

  const filteredPool = allPlayers?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const handleQuickRegister = () => {
    if (!user || !quickRegName.trim()) return;
    const pid = doc(collection(db, 'players')).id;
    const targetTeamId = quickRegTarget === 'team1' ? setup.team1Id : setup.team2Id;
    const pData = { id: pid, name: quickRegName, teamId: targetTeamId, ownerId: user.uid, role: 'All-rounder', battingStyle: 'Right Handed Bat', isWicketKeeper: false, isRetired: false, matchesPlayed: 0, runsScored: 0, wicketsTaken: 0, highestScore: 0, bestBowlingFigures: '0/0', careerCVP: 0 };
    setDocumentNonBlocking(doc(db, 'players', pid), pData, { merge: true });
    
    if (quickRegTarget === 'team1') setSetup(s => ({ ...s, team1Squad: [...s.team1Squad, pid] }));
    else setSetup(s => ({ ...s, team2Squad: [...s.team2Squad, pid] }));
    
    setQuickRegName(''); setIsQuickRegOpen(false);
    toast({ title: "Player Registered" });
  };

  const handleStartMatch = () => {
    if (!setup.strikerId || !setup.nonStrikerId || !setup.bowlerId) return;
    const mid = doc(collection(db, 'matches')).id;
    const mData = { id: mid, team1Id: setup.team1Id, team2Id: setup.team2Id, team1SquadPlayerIds: setup.team1Squad, team2SquadPlayerIds: setup.team2Squad, totalOvers: parseInt(setup.totalOvers), status: 'live', tossWinnerTeamId: setup.tossWinner, tossDecision: setup.tossDecision, currentInningNumber: 1, matchDate: new Date().toISOString(), umpireId: user?.uid || 'anonymous', resultDescription: 'Match in Progress' };
    setDocumentNonBlocking(doc(db, 'matches', mid), mData, { merge: true });
    
    const batId = setup.tossWinner === setup.team1Id ? (setup.tossDecision === 'bat' ? setup.team1Id : setup.team2Id) : (setup.tossDecision === 'bat' ? setup.team2Id : setup.team1Id);
    const bowlId = batId === setup.team1Id ? setup.team2Id : setup.team1Id;

    const iData = { id: 'inning_1', matchId: mid, inningNumber: 1, battingTeamId: batId, bowlingTeamId: bowlId, score: 0, wickets: 0, oversCompleted: 0, ballsInCurrentOver: 0, strikerPlayerId: setup.strikerId, nonStrikerPlayerId: setup.nonStrikerId, currentBowlerPlayerId: setup.bowlerId };
    setDocumentNonBlocking(doc(db, 'matches', mid, 'innings', 'inning_1'), iData, { merge: true });
    
    router.push(`/match/${mid}`);
  };

  if (!isUmpire) return <div className="p-20 text-center"><ShieldCheck className="w-16 h-16 mx-auto mb-4" /><h2>Umpire Role Required</h2></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-2xl font-black uppercase text-primary">New Match</h1>
      </div>

      {step === 1 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl font-black uppercase">Teams & Format</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Home Team</Label><Select value={setup.team1Id} onValueChange={(v) => setSetup({...setup, team1Id: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent>{teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Away Team</Label><Select value={setup.team2Id} onValueChange={(v) => setSetup({...setup, team2Id: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent>{teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Overs</Label><Input type="number" value={setup.totalOvers} onChange={(e) => setSetup({...setup, totalOvers: e.target.value})} className="h-12 font-bold" /></div>
            <Button className="w-full h-14 font-black uppercase" disabled={!setup.team1Id || !setup.team2Id} onClick={() => setStep(2)}>Configure Squads</Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl font-black uppercase">Select Squads</CardTitle><div className="relative mt-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search pool..." className="pl-10 h-10 font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              {[ {id: 'team1', tid: setup.team1Id, squad: setup.team1Squad}, {id: 'team2', tid: setup.team2Id, squad: setup.team2Squad} ].map(t => (
                <div key={t.id} className="space-y-3 bg-slate-50 p-4 rounded-xl border">
                  <div className="flex justify-between items-center border-b pb-2"><h3 className="font-black text-xs uppercase truncate">{teams?.find(team => team.id === t.tid)?.name}</h3><Button variant="ghost" size="icon" onClick={() => { setQuickRegTarget(t.id as any); setIsQuickRegOpen(true); }} className="h-6 w-6 text-primary"><UserPlus className="w-4 h-4" /></Button></div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                    {filteredPool.map(p => (
                      <div key={p.id} className="flex items-center gap-2"><Checkbox checked={t.squad.includes(p.id)} onCheckedChange={(c) => {
                        if (t.id === 'team1') setSetup({...setup, team1Squad: c ? [...setup.team1Squad, p.id] : setup.team1Squad.filter(id => id !== p.id)});
                        else setSetup({...setup, team2Squad: c ? [...setup.team2Squad, p.id] : setup.team2Squad.filter(id => id !== p.id)});
                      }} id={`${t.id}-${p.id}`} /><Label htmlFor={`${t.id}-${p.id}`} className="text-xs font-bold truncate flex-1">{p.name}</Label></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1 font-black uppercase" onClick={() => setStep(1)}>Back</Button><Button className="flex-1 h-14 font-black uppercase" onClick={() => setStep(3)}>The Toss</Button></div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl font-black uppercase">The Toss</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Winner</Label><Select value={setup.tossWinner} onValueChange={(v) => setSetup({...setup, tossWinner: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={setup.team1Id}>{teams?.find(t => t.id === setup.team1Id)?.name}</SelectItem><SelectItem value={setup.team2Id}>{teams?.find(t => t.id === setup.team2Id)?.name}</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Decision</Label><Select value={setup.tossDecision} onValueChange={(v) => setSetup({...setup, tossDecision: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bat">Elect to Bat</SelectItem><SelectItem value="bowl">Elect to Bowl</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1 font-black uppercase" onClick={() => setStep(2)}>Back</Button><Button className="flex-1 h-14 font-black uppercase" disabled={!setup.tossWinner} onClick={() => setStep(4)}>Openers</Button></div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl font-black uppercase">Start Positions</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Striker</Label><Select value={setup.strikerId} onValueChange={(v) => setSetup({...setup, strikerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent>{allPlayers?.filter(p => (setup.tossWinner === setup.team1Id ? (setup.tossDecision === 'bat' ? setup.team1Squad : setup.team2Squad) : (setup.tossDecision === 'bat' ? setup.team2Squad : setup.team1Squad)).includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Non-Striker</Label><Select value={setup.nonStrikerId} onValueChange={(v) => setSetup({...setup, nonStrikerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent>{allPlayers?.filter(p => (setup.tossWinner === setup.team1Id ? (setup.tossDecision === 'bat' ? setup.team1Squad : setup.team2Squad) : (setup.tossDecision === 'bat' ? setup.team2Squad : setup.team1Squad)).includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Opening Bowler</Label><Select value={setup.bowlerId} onValueChange={(v) => setSetup({...setup, bowlerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent>{allPlayers?.filter(p => (setup.tossWinner === setup.team1Id ? (setup.tossDecision === 'bowl' ? setup.team1Squad : setup.team2Squad) : (setup.tossDecision === 'bowl' ? setup.team2Squad : setup.team1Squad)).includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <Button className="w-full h-16 text-lg font-black uppercase bg-secondary hover:bg-secondary/90" onClick={handleStartMatch} disabled={!setup.strikerId || !setup.nonStrikerId || !setup.bowlerId}>START MATCH</Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Reg Dialog */}
      <Dialog open={isQuickRegOpen} onOpenChange={setIsQuickRegOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-primary z-[200]">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Quick Player Add</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4"><Label className="text-[10px] font-black uppercase text-slate-400">Player Name</Label><Input value={quickRegName} onChange={(e) => setQuickRegName(e.target.value)} placeholder="Full Name" className="h-12 font-bold" /></div>
          <DialogFooter><Button onClick={handleQuickRegister} disabled={!quickRegName.trim()} className="w-full h-14 font-black uppercase">Add to Squad</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
