'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Shield, Users, BarChart, PlayCircle, Calendar, ArrowRight, Upload, Camera, Check } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Match, Team, Player } from "@/lib/types";
import { useMemo, useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export default function HomePage() {
  const { firestore: db } = useFirebase();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState([100]); // Percentage

  // Load custom logo from localStorage on mount
  useEffect(() => {
    const savedLogo = localStorage.getItem('cricmates_league_logo');
    if (savedLogo) {
      setCustomLogo(savedLogo);
    }
  }, []);

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
  const teams = teamsData || [];

  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
  const { data: playersData, isLoading: playersLoading } = useCollection<Player>(playersCollection);
  const players = playersData || [];
  
  const liveMatchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'live')) : null, [db]);
  const { data: liveMatchesData, isLoading: liveMatchesLoading } = useCollection<Match>(liveMatchesQuery);
  const liveMatches = liveMatchesData || [];

  const completedMatchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'completed')) : null, [db]);
  const { data: completedMatchesData, isLoading: completedMatchesLoading } = useCollection<Match>(completedMatchesQuery);
  const completedMatches = completedMatchesData || [];
  
  const getTeam = (id: string) => teams.find(t => t.id === id);
  
  const sortedCompletedMatches = useMemo(() => {
    return [...completedMatches].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
    }).slice(0, 4);
  }, [completedMatches]);

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setTempImage(base64String);
        setIsAdjusting(true);
        setZoom([100]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmAdjustment = () => {
    if (tempImage) {
      // In a real app we might use canvas to crop, but for MVP we save the zoom effect style
      // or just save the image and apply zoom in display. 
      // To keep it simple and persistent, we'll store the final base64 if we had a cropper.
      // Since we don't have a cropper library, we'll just save the image and zoom preference.
      setCustomLogo(tempImage);
      localStorage.setItem('cricmates_league_logo', tempImage);
      localStorage.setItem('cricmates_league_logo_zoom', zoom[0].toString());
      setIsAdjusting(false);
      setTempImage(null);
      toast({ title: "Logo Updated", description: "Your custom league logo has been saved." });
    }
  };

  // Get saved zoom for display
  const savedZoom = typeof window !== 'undefined' ? localStorage.getItem('cricmates_league_logo_zoom') : '100';
  const displayZoom = customLogo ? (savedZoom || '100') : '100';

  return (
    <div className="space-y-8 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto pb-10">
      
      {/* Logo Adjustment Dialog */}
      <Dialog open={isAdjusting} onOpenChange={setIsAdjusting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Logo</DialogTitle>
            <DialogDescription>
              Zoom and position your logo to fit perfectly in the circular space.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-10 space-y-8">
            <div className="relative w-48 h-48 rounded-full border-4 border-primary/20 bg-background overflow-hidden flex items-center justify-center shadow-inner">
              {tempImage && (
                <div 
                  className="relative w-full h-full transition-transform duration-75"
                  style={{ transform: `scale(${zoom[0] / 100})` }}
                >
                  <Image 
                    src={tempImage} 
                    alt="Temp Logo" 
                    fill 
                    className="object-cover" 
                  />
                </div>
              )}
            </div>
            <div className="w-full px-6 space-y-4">
              <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <span>Zoom</span>
                <span>{zoom[0]}%</span>
              </div>
              <Slider 
                value={zoom} 
                onValueChange={setZoom} 
                min={50} 
                max={300} 
                step={1}
                className="cursor-pointer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjusting(false)}>Cancel</Button>
            <Button onClick={handleConfirmAdjustment}>
              <Check className="mr-2 h-4 w-4" /> OK, Looks Good
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hero / Welcome Section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-primary/5 p-6 sm:p-8 rounded-3xl border border-primary/10">
          <div className="text-center md:text-left space-y-3 flex-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight font-headline text-primary leading-tight">
              Welcome, Mates! 🏏
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto md:mx-0">
              Your ultimate cricket companion. Effortless scoring, powerful stats, and team management all in one place.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
               <Button asChild variant="default" className="w-full sm:w-auto shadow-lg shadow-primary/20 rounded-full px-6">
                  <Link href="/matches/new">
                      <PlusCircle className="mr-2 h-4 w-4" /> Start New Match
                  </Link>
              </Button>
               <Button asChild variant="outline" className="w-full sm:w-auto rounded-full px-6">
                  <Link href="/teams">
                      <Users className="mr-2 h-4 w-4" /> Manage Teams
                  </Link>
              </Button>
            </div>
          </div>
          
          {/* Custom Logo Upload Area */}
          <div className="relative group cursor-pointer" onClick={handleLogoClick}>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
            />
            <div className={`relative w-40 h-40 sm:w-48 sm:h-48 rounded-full border-4 border-dashed border-primary/20 bg-background overflow-hidden flex items-center justify-center transition-all group-hover:border-primary/50 group-hover:shadow-xl`}>
              {customLogo ? (
                <div 
                  className="relative w-full h-full"
                  style={{ transform: `scale(${Number(displayZoom) / 100})` }}
                >
                  <Image 
                    src={customLogo} 
                    alt="League Logo" 
                    fill 
                    className="object-cover transition-transform" 
                  />
                </div>
              ) : (
                <div className="text-center p-4">
                  <div className="bg-primary/10 rounded-full p-4 inline-block mb-2 group-hover:bg-primary/20 transition-colors">
                    <Camera className="h-8 w-8 text-primary/60" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upload Logo</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                <Upload className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/teams" className="group rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary">
              <Card className="h-full border-primary/10 group-hover:border-primary/30 transition-all duration-300 group-hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Teams</CardTitle>
                      <div className="p-2 bg-primary/10 rounded-lg text-primary"><Shield className="h-4 w-4" /></div>
                  </CardHeader>
                  <CardContent className="pt-4">
                      {teamsLoading ? <Skeleton className="h-10 w-16" /> : <div className="text-3xl font-black">{teams.length}</div>}
                      <p className="text-xs text-muted-foreground mt-1 font-medium">Registered league members</p>
                  </CardContent>
              </Card>
          </Link>
          <Link href="/player-stats" className="group rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary">
               <Card className="h-full border-primary/10 group-hover:border-primary/30 transition-all duration-300 group-hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Players</CardTitle>
                      <div className="p-2 bg-primary/10 rounded-lg text-primary"><Users className="h-4 w-4" /></div>
                  </CardHeader>
                  <CardContent className="pt-4">
                      {playersLoading ? <Skeleton className="h-10 w-16" /> : <div className="text-3xl font-black">{players.length}</div>}
                       <p className="text-xs text-muted-foreground mt-1 font-medium">Registered athletes</p>
                  </CardContent>
              </Card>
          </Link>
          <Link href="/matches" className="group rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary sm:col-span-2 lg:col-span-1">
               <Card className="h-full border-primary/10 group-hover:border-primary/30 transition-all duration-300 group-hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Matches Played</CardTitle>
                      <div className="p-2 bg-primary/10 rounded-lg text-primary"><BarChart className="h-4 w-4" /></div>
                  </CardHeader>
                  <CardContent className="pt-4">
                      {completedMatchesLoading ? <Skeleton className="h-10 w-16" /> : <div className="text-3xl font-black">{completedMatches.length}</div>}
                       <p className="text-xs text-muted-foreground mt-1 font-medium">Historical records</p>
                  </CardContent>
              </Card>
          </Link>
      </div>

      {/* Recent Activity Section */}
      {(liveMatches.length > 0 || sortedCompletedMatches.length > 0) && (
          <div className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <PlayCircle className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight font-headline">Recent & Live</h2>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/5 font-bold group">
                  <Link href="/matches" className="flex items-center gap-1">
                    View All <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
              
              <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
                  {[...liveMatches, ...sortedCompletedMatches].map(match => {
                      const team1 = getTeam(match.team1Id);
                      const team2 = getTeam(match.team2Id);
                      const inning1 = match.innings[0];
                      const inning2 = match.innings[1];
                      const currentInning = match.innings[match.currentInning - 1];
                      const isWinner1 = match.result?.startsWith(team1?.name || '');
                      const isWinner2 = match.result?.startsWith(team2?.name || '');

                      return (
                          <Card key={match.id} className="relative overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-muted">
                              <Link href={`/matches/${match.id}`} className="absolute inset-0 z-0" />
                              <CardContent className="p-0 relative z-10">
                                  {/* Card Header Info */}
                                  <div className="px-5 pt-5 pb-3 flex justify-between items-center border-b border-muted/50 bg-muted/5">
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2">
                                      <Calendar className="h-3.5 w-3.5" />
                                      {new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                      <span className="text-muted-foreground/30">•</span>
                                      <span>{match.overs} Overs</span>
                                    </div>
                                    <Badge variant={match.status === 'live' ? 'destructive' : 'secondary'} className="text-[10px] px-2 py-0 h-5 font-bold uppercase tracking-wider">
                                      {match.status}
                                    </Badge>
                                  </div>

                                  {/* Scores Section */}
                                  <div className="p-5 space-y-4">
                                    <div className={`flex items-center justify-between ${isWinner1 ? 'text-primary' : ''}`}>
                                      <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 relative rounded-lg border bg-muted shrink-0 overflow-hidden shadow-sm">
                                          {team1 && <Image src={team1.logoUrl} alt="" fill className="object-cover" />}
                                        </div>
                                        <span className={`text-base sm:text-lg font-bold truncate max-w-[140px] sm:max-w-none ${isWinner1 ? '' : 'text-foreground/80'}`}>{team1?.name}</span>
                                      </div>
                                      <div className="text-right">
                                        <div className={`text-base sm:text-lg font-black font-mono leading-none ${isWinner1 ? 'text-primary' : 'text-foreground'}`}>
                                          {inning1 ? `${inning1.score}/${inning1.wickets}` : '-'}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-bold font-mono mt-1">
                                          ({inning1 ? inning1.overs.toFixed(1) : '0.0'})
                                        </div>
                                      </div>
                                    </div>

                                    <div className={`flex items-center justify-between ${isWinner2 ? 'text-primary' : ''}`}>
                                      <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 relative rounded-lg border bg-muted shrink-0 overflow-hidden shadow-sm">
                                          {team2 && <Image src={team2.logoUrl} alt="" fill className="object-cover" />}
                                        </div>
                                        <span className={`text-base sm:text-lg font-bold truncate max-w-[140px] sm:max-w-none ${isWinner2 ? '' : 'text-foreground/80'}`}>{team2?.name}</span>
                                      </div>
                                      <div className="text-right">
                                        <div className={`text-base sm:text-lg font-black font-mono leading-none ${isWinner2 ? 'text-primary' : 'text-foreground'}`}>
                                          {inning2 ? `${inning2.score}/${inning2.wickets}` : '-'}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-bold font-mono mt-1">
                                          ({inning2 ? inning2.overs.toFixed(1) : '0.0'})
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Result / Status Footer */}
                                  <div className="px-5 py-3 border-t border-muted/50 bg-primary/5">
                                    {match.result ? (
                                      <p className="text-xs font-black text-primary uppercase tracking-tight truncate">{match.result}</p>
                                    ) : (
                                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 bg-destructive rounded-full animate-pulse" />
                                        Batting: <span className="font-bold text-foreground">{getTeam(currentInning.battingTeamId)?.name}</span>
                                      </p>
                                    )}
                                  </div>
                              </CardContent>
                          </Card>
                      )
                  })}
              </div>
          </div>
      )}
      
      {!liveMatchesLoading && liveMatches.length === 0 && sortedCompletedMatches.length === 0 && (
          <div className="flex h-80 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 p-8 text-center animate-in zoom-in duration-500">
            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <PlayCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">Ready to Play?</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">Start a new match to track scores and build your tournament history.</p>
            <Button asChild className="mt-6 shadow-xl shadow-primary/20 rounded-full px-8 h-12">
              <Link href="/matches/new"><PlusCircle className="mr-2 h-5 w-5" /> Start Match</Link>
            </Button>
          </div>
      )}
    </div>
  );
}
