'use client';

import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { Match, Team, Player } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UmpireControls } from '@/components/match/umpire-controls';
import { FullScorecard } from '@/components/match/full-scorecard';
import { OverByOver } from '@/components/match/over-by-over';
import { MatchSquads } from '@/components/match/match-squads';
import { MatchAnalysis } from '@/components/match/match-analysis';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState, useEffect } from 'react';
import { InningStartDialog } from '@/components/match/inning-start-dialog';
import { SelectBowlerDialog } from '@/components/match/select-bowler-dialog';
import { Button } from '@/components/ui/button';
import { Share2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MatchDetailPage() {
    const params = useParams();
    const matchId = params.id as string;
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [isInningStartOpen, setIsInningStartOpen] = useState(false);
    const [isSelectBowlerOpen, setIsSelectBowlerOpen] = useState(false);
    const [sharing, setSharing] = useState(false);

    const matchRef = useMemoFirebase(() => db ? doc(db, 'matches', matchId) : null, [db, matchId]);
    const { data: match, isLoading: matchLoading } = useDoc<Match>(matchRef);

    const teamsCollection = useMemoFirebase(() => db ? collection(db, 'teams') : null, [db]);
    const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);

    const playersCollection = useMemoFirebase(() => db ? collection(db, 'players') : null, [db]);
    const { data: players, isLoading: playersLoading } = useCollection<Player>(playersCollection);

    const currentInning = match?.innings[match.currentInning - 1];
    
    useEffect(() => {
        if (match?.status === 'live' && currentInning && currentInning.deliveryHistory.length === 0 && !currentInning.strikerId) {
            setIsInningStartOpen(true);
        }
    }, [match?.status, match?.currentInning, currentInning?.deliveryHistory.length, currentInning?.strikerId]);

    useEffect(() => {
        if (match?.status === 'live' && currentInning && currentInning.overs > 0 && currentInning.overs % 1 === 0 && !currentInning.bowlerId) {
             const lastDelivery = currentInning.deliveryHistory.at(-1);
             if (lastDelivery && lastDelivery.extra !== 'wide' && lastDelivery.extra !== 'noball') {
                setIsSelectBowlerOpen(true);
             }
        }
    }, [match?.status, currentInning?.overs, currentInning?.bowlerId, currentInning?.deliveryHistory]);

    const striker = useMemo(() => players?.find(p => p.id === currentInning?.strikerId), [players, currentInning?.strikerId]);
    const nonStriker = useMemo(() => players?.find(p => p.id === currentInning?.nonStrikerId), [players, currentInning?.nonStrikerId]);
    const bowler = useMemo(() => players?.find(p => p.id === currentInning?.bowlerId), [players, currentInning?.bowlerId]);

    const handleShare = async () => {
        if (!match || !teams) return;
        setSharing(true);
        
        const team1 = teams.find(t => t.id === match.team1Id);
        const team2 = teams.find(t => t.id === match.team2Id);
        const shareUrl = `${window.location.origin}/share/match/${matchId}`;
        
        let shareText = `🏏 *CricMates Score Update* 🏏\n\n${team1?.name} vs ${team2?.name}\n`;
        
        match.innings.forEach((inn, idx) => {
            const team = teams.find(t => t.id === inn.battingTeamId);
            shareText += `\n*${team?.name}*: ${inn.score}/${inn.wickets} (${inn.overs.toFixed(1)})`;
        });

        if (match.status === 'completed' && match.result) {
            shareText += `\n\n🏆 *Result:* ${match.result}`;
        } else {
            shareText += `\n\n🔴 *Match is LIVE*`;
        }

        shareText += `\n\nFull scorecard here: ${shareUrl}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'CricMates Score Update',
                    text: shareText,
                });
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            navigator.clipboard.writeText(shareText);
            toast({
                title: "Score Summary Copied!",
                description: "The formatted scorecard summary is ready to share.",
            });
        }
        setSharing(false);
    };

    if (matchLoading || teamsLoading || playersLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-[500px] w-full" />
            </div>
        );
    }

    if (!match) return <div className="p-8 text-center text-muted-foreground">Match not found.</div>;

    const team1 = teams?.find(t => t.id === match.team1Id);
    const team2 = teams?.find(t => t.id === match.team2Id);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InningStartDialog 
                open={isInningStartOpen} 
                onClose={() => setIsInningStartOpen(false)} 
                inningNumber={match.currentInning}
                battingTeamName={teams?.find(t => t.id === currentInning?.battingTeamId)?.name}
            />
            {currentInning && (
                <SelectBowlerDialog 
                    open={isSelectBowlerOpen} 
                    onClose={() => setIsSelectBowlerOpen(false)} 
                    match={match} 
                    players={players || []} 
                />
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold font-headline">
                        {team1?.name} vs {team2?.name}
                    </h1>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider">{match.overs} Over Match • {new Date(match.date).toLocaleDateString()}</p>
                </div>
                <Button onClick={handleShare} variant="outline" className="shrink-0 w-full md:w-auto" disabled={sharing}>
                    {sharing ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                    Share Scorecard
                </Button>
            </div>

            <Tabs defaultValue={match.status === 'live' ? 'scoring' : 'scorecard'} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex bg-muted p-1">
                    {match.status === 'live' && <TabsTrigger value="scoring">Scorer</TabsTrigger>}
                    <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
                    <TabsTrigger value="overs">Overs</TabsTrigger>
                    <TabsTrigger value="squads">Squads</TabsTrigger>
                    <TabsTrigger value="analysis">Stats</TabsTrigger>
                </TabsList>

                {match.status === 'live' && (
                    <TabsContent value="scoring">
                        <UmpireControls 
                            match={match} 
                            teams={teams || []} 
                            players={players || []}
                            striker={striker}
                            nonStriker={nonStriker}
                            bowler={bowler}
                        />
                    </TabsContent>
                )}

                <TabsContent value="scorecard">
                    <FullScorecard match={match} teams={teams || []} players={players || []} />
                </TabsContent>

                <TabsContent value="overs">
                    <OverByOver match={match} teams={teams || []} players={players || []} />
                </TabsContent>

                <TabsContent value="squads">
                    <MatchSquads match={match} teams={teams || []} players={players || []} />
                </TabsContent>

                <TabsContent value="analysis">
                    <MatchAnalysis match={match} teams={teams || []} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
