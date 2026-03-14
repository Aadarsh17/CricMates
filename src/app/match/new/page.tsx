"use client"

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCollection, useMemoFirebase, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase';
import { useApp } from '@/context/AppContext';
import { ShieldCheck, ArrowRight, UserPlus, Search, ChevronLeft, Award, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

function NewMatchContent() {
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
    matchNumber: 'Match 1',
    team1Id: '',
    team2Id: '',
    team1Squad: [] as string[],
    team2Squad: [] as string[],
    team1CaptainId: '',
    team1ViceCaptainId: '',
    team1WicketKeeperId: '',
    team2CaptainId: '',
    team2ViceCaptainId: '',
    team2WicketKeeperId: '',
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
    const prevNum = searchParams.get('mNum');
    
    if (t1 && t2) {
      let nextNum = 'Match 1';
      if (prevNum && prevNum.startsWith('Match ')) {
        const num = parseInt(prevNum.split(' ')[1]);
        if (!isNaN(num)) nextNum = `Match ${num + 1}`;
      }
      setSetup(prev => ({ 
        ...prev, 
        team1Id: t1, 
        team2Id: t2, 
        matchNumber: nextNum,
        totalOvers: searchParams.get('overs') || '6' 
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (teams && setup.team1Id) {
      const t1 = teams.find(t => t.id === setup.team1Id);
      if (t1) {
        setSetup(prev => ({ 
          ...prev, 
          team1CaptainId: t1.captainId || prev.team1CaptainId,
          team1ViceCaptainId: t1.viceCaptainId || prev.team1ViceCaptainId,
          team1WicketKeeperId: t1.wicketKeeperId || prev.team1WicketKeeperId
        }));
      }
    }
    if (teams && setup.team2Id) {
      const t2 = teams.find(t => t.id === setup.team2Id);
      if (t2) {
        setSetup(prev => ({ 
          ...prev, 
          team2CaptainId: t2.captainId || prev.team2CaptainId,
          team2ViceCaptainId: t2.viceCaptainId || prev.team2ViceCaptainId,
          team2WicketKeeperId: t2.wicketKeeperId || prev.team2WicketKeeperId
        }));
      }
    }
  }, [teams, setup.team1Id, setup.team2Id]);

  const filteredPool = allPlayers?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const handleQuickRegister = () => {
    if (!user || !quickRegName.trim()) return;
    const pid = doc(collection(db, 'temp')).id;
    const targetTeamId = quickRegTarget === 'team1' ? setup.team1Id : setup.team2Id;
    const pData = { id: pid, name: quickRegName, teamId: targetTeamId, ownerId: user.uid, role: 'All-rounder', battingStyle: 'Right Handed Bat', isWicketKeeper: false, isRetired: false, matchesPlayed: 0, runsScored: 0, wicketsTaken: 0, highestScore: 0, bestBowlingFigures: '0/0', careerCVP: 0, imageUrl: '' };
    setDocumentNonBlocking(doc(db, 'players', pid), pData, { merge: true });
    
    if (quickRegTarget === 'team1') setSetup(s => ({ ...s, team1Squad: [...s.team1Squad, pid] }));
    else setSetup(s => ({ ...s, team2Squad: [...s.team2Squad, pid] }));
    
    setQuickRegName(''); setIsQuickRegOpen(false);
    toast({ title: "Player Registered" });
  };

  const handleStartMatch = () => {
    if (!setup.strikerId || !setup.bowlerId) return;
    const mid = doc(collection(db, 'matches')).id;
    const mData = { 
      id: mid, 
      matchNumber: setup.matchNumber,
      team1Id: setup.team1Id, 
      team2Id: setup.team2Id, 
      team1SquadPlayerIds: setup.team1Squad, 
      team2SquadPlayerIds: setup.team2Squad, 
      team1CaptainId: setup.team1CaptainId,
      team1ViceCaptainId: setup.team1ViceCaptainId,
      team1WicketKeeperId: setup.team1WicketKeeperId,
      team2CaptainId: setup.team2CaptainId,
      team2ViceCaptainId: setup.team2ViceCaptainId,
      team2WicketKeeperId: setup.team2WicketKeeperId,
      totalOvers: parseInt(setup.totalOvers), 
      status: 'live', 
      tossWinnerTeamId: setup.tossWinner, 
      tossDecision: setup.tossDecision, 
      currentInningNumber: 1, 
      matchDate: new Date().toISOString(), 
      umpireId: user?.uid || 'anonymous', 
      resultDescription: 'Match in Progress' 
    };
    setDocumentNonBlocking(doc(db, 'matches', mid), mData, { merge: true });
    
    const batId = setup.tossWinner === setup.team1Id ? (setup.tossDecision === 'bat' ? setup.team1Id : setup.team2Id) : (setup.tossDecision === 'bat' ? setup.team2Id : setup.team1Id);
    const bowlId = batId === setup.team1Id ? setup.team2Id : match.team1Id;

    const iData = { id: 'inning_1', battingTeamId: batId, score: 0, wickets: 0, oversCompleted: 0, ballsInCurrentOver: 0, strikerPlayerId: setup.strikerId, nonStrikerPlayerId: setup.nonStrikerId || '', currentBowlerPlayerId: setup.bowlerId, isDeclaredFinished: false };
    setDocumentNonBlocking(doc(db, 'matches', mid, 'innings', 'inning_1'), iData, { merge: true });
    
    router.push(`/match/${mid}`);
  };

  if (!isUmpire) return <div className="p-20 text-center"><ShieldCheck className="w-16 h-16 mx-auto mb-4" /><h2>Umpire Role Required</h2></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-2xl font-black uppercase text-primary">New Match setup</h1>
      </div>

      {step === 1 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl font-black uppercase">Teams & Format</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Match Label</Label>
              <Input 
                value={setup.matchNumber} 
                onChange={(e) => setSetup({...setup, matchNumber: e.target.value})} 
                placeholder="e.g. Match 1"
                className="h-12 font-bold" 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Home Team</Label><Select value={setup.team1Id} onValueChange={(v) => setSetup({...setup, team1Id: v, team1Squad: [], team1CaptainId: '', team1ViceCaptainId: '', team1WicketKeeperId: ''})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Team" /></SelectTrigger><SelectContent>{teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Away Team</Label><Select value={setup.team2Id} onValueChange={(v) => setSetup({...setup, team2Id: v, team2Squad: [], team2CaptainId: '', team2ViceCaptainId: '', team2WicketKeeperId: ''})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Team" /></SelectTrigger><SelectContent>{teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Overs</Label><Input type="number" value={setup.totalOvers} onChange={(e) => setSetup({...setup, totalOvers: e.target.value})} className="h-12 font-bold" /></div>
            <Button className="w-full h-14 font-black uppercase" disabled={!setup.team1Id || !setup.team2Id} onClick={() => setStep(2)}>Configure Squads</Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-t-4 border-t-primary shadow-lg overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl font-black uppercase">Official Squads</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search player pool..." className="pl-10 h-12 font-bold bg-slate-50 border-2" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[ 
                {id: 'team1', tid: setup.team1Id, squad: setup.team1Squad, otherSquad: setup.team2Squad, captainKey: 'team1CaptainId' as const, vcKey: 'team1ViceCaptainId' as const, wkKey: 'team1WicketKeeperId' as const}, 
                {id: 'team2', tid: setup.team2Id, squad: setup.team2Squad, otherSquad: setup.team1Squad, captainKey: 'team2CaptainId' as const, vcKey: 'team2ViceCaptainId' as const, wkKey: 'team2WicketKeeperId' as const} 
              ].map(t => {
                const teamData = teams?.find(team => team.id === t.tid);
                const teamName = teamData?.name || 'Team';
                return (
                  <div key={t.id} className="space-y-4 bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center border-b pb-3">
                      <h3 className="font-black text-sm uppercase text-slate-900 leading-tight pr-4">{teamName}</h3>
                      <Button variant="ghost" size="icon" onClick={() => { setQuickRegTarget(t.id as any); setIsQuickRegOpen(true); }} className="h-8 w-8 text-primary bg-primary/5 rounded-lg shrink-0">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                      {filteredPool.map(p => {
                        const isSelectedInOther = t.otherSquad.includes(p.id);
                        return (
                          <div key={p.id} className={cn("flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-50")}>
                            <Checkbox 
                              checked={t.squad.includes(p.id)} 
                              onCheckedChange={(c) => {
                                if (t.id === 'team1') {
                                  const nextSquad = c ? [...setup.team1Squad, p.id] : setup.team1Squad.filter(id => id !== p.id);
                                  setSetup({...setup, team1Squad: nextSquad});
                                } else {
                                  const nextSquad = c ? [...setup.team2Squad, p.id] : setup.team2Squad.filter(id => id !== p.id);
                                  setSetup({...setup, team2Squad: nextSquad});
                                }
                              }} 
                              id={`${t.id}-${p.id}`} 
                              className="h-5 w-5 rounded-md border-2"
                            />
                            <Label htmlFor={`${t.id}-${p.id}`} className="text-xs font-bold flex-1 cursor-pointer py-1 flex items-center justify-between">
                              <span>{p.name}</span>
                              {isSelectedInOther && <Badge variant="outline" className="text-[7px] h-4 font-black uppercase text-primary border-primary/30">Common Player</Badge>}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-4 border-t space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1"><Award className="w-2.5 h-2.5" /> Captain</Label>
                        <Select value={setup[t.captainKey] || 'none'} onValueChange={(v) => setSetup({...setup, [t.captainKey]: v === 'none' ? '' : v})}>
                          <SelectTrigger className="h-9 font-bold bg-slate-50 border-none shadow-none text-xs"><SelectValue placeholder="Pick Captain" /></SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="none" className="text-xs font-bold uppercase">No Captain</SelectItem>
                            {allPlayers?.filter(p => t.squad.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id} className="text-xs font-bold">{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> Vice-Captain</Label>
                        <Select value={setup[t.vcKey] || 'none'} onValueChange={(v) => setSetup({...setup, [t.vcKey]: v === 'none' ? '' : v})}>
                          <SelectTrigger className="h-9 font-bold bg-slate-50 border-none shadow-none text-xs"><SelectValue placeholder="Pick VC" /></SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="none" className="text-xs font-bold uppercase">No Vice-Captain</SelectItem>
                            {allPlayers?.filter(p => t.squad.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id} className="text-xs font-bold">{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" /> Wicket-Keeper</Label>
                        <Select value={setup[t.wkKey] || 'none'} onValueChange={(v) => setSetup({...setup, [t.wkKey]: v === 'none' ? '' : v})}>
                          <SelectTrigger className="h-9 font-bold bg-slate-50 border-none shadow-none text-xs"><SelectValue placeholder="Pick WK" /></SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="none" className="text-xs font-bold uppercase">No Wicket-Keeper</SelectItem>
                            {allPlayers?.filter(p => t.squad.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id} className="text-xs font-bold">{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-14 font-black uppercase tracking-widest border-2" onClick={() => setStep(1)}>Back</Button>
              <Button 
                className="flex-1 h-14 font-black uppercase tracking-widest shadow-xl" 
                disabled={setup.team1Squad.length < 1 || setup.team2Squad.length < 1}
                onClick={() => setStep(3)}
              >
                Match Start
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl font-black uppercase">The Toss</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Winner</Label><Select value={setup.tossWinner} onValueChange={(v) => setSetup({...setup, tossWinner: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Team" /></SelectTrigger><SelectContent>{[setup.team1Id, setup.team2Id].map(tid => (<SelectItem key={tid} value={tid}>{teams?.find(t => t.id === tid)?.name}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Decision</Label><Select value={setup.tossDecision} onValueChange={(v) => setSetup({...setup, tossDecision: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bat">Elect to Bat</SelectItem><SelectItem value="bowl">Elect to Bowl</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex gap-3"><Button variant="outline" className="flex-1 h-14 font-black uppercase border-2" onClick={() => setStep(2)}>Back</Button><Button className="flex-1 h-14 font-black uppercase shadow-xl" disabled={!setup.tossWinner} onClick={() => setStep(4)}>Openers</Button></div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader><CardTitle className="text-xl font-black uppercase">Start Positions</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Striker (REQUIRED)</Label><Select value={setup.strikerId} onValueChange={(v) => setSetup({...setup, strikerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Pick Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => (setup.tossWinner === setup.team1Id ? (setup.tossDecision === 'bat' ? setup.team1Squad : setup.team2Squad) : (setup.tossDecision === 'bat' ? setup.team2Squad : setup.team1Squad)).includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Non-Striker (OPTIONAL)</Label><Select value={setup.nonStrikerId || 'none'} onValueChange={(v) => setSetup({...setup, nonStrikerId: v === 'none' ? '' : v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="No Non-Striker" /></SelectTrigger><SelectContent><SelectItem value="none">No Non-Striker (Solo Mode)</SelectItem>{allPlayers?.filter(p => (setup.tossWinner === setup.team1Id ? (setup.tossDecision === 'bat' ? setup.team1Squad : setup.team2Squad) : (setup.tossDecision === 'bat' ? setup.team2Squad : setup.team1Squad)).includes(p.id) && p.id !== setup.strikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Opening Bowler (REQUIRED)</Label><Select value={setup.bowlerId} onValueChange={(v) => setSetup({...setup, bowlerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Pick Bowler" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => (setup.tossWinner === setup.team1Id ? (setup.tossDecision === 'bowl' ? setup.team1Squad : setup.team2Squad) : (setup.tossDecision === 'bowl' ? setup.team2Squad : setup.team1Squad)).includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-16 font-black uppercase border-2" onClick={() => setStep(3)}>Back</Button>
              <Button className="flex-[2] h-16 text-lg font-black uppercase bg-secondary hover:bg-secondary/90 shadow-2xl" onClick={handleStartMatch} disabled={!setup.strikerId || !setup.bowlerId}>START MATCH</Button>
            </div>
          </CardContent>
        </Card>
      )}

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

export default function NewMatchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <NewMatchContent />
    </Suspense>
  );
}
