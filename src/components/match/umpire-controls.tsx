'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { UserX } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import type { Match, Player } from "@/lib/types";
import { Badge } from '../ui/badge';
import { RetirePlayerDialog } from './retire-player-dialog';
import { WicketDialog } from './wicket-dialog';

type ExtraOptions = {
    wicket: boolean;
    wide: boolean;
    noball: boolean;
    byes: boolean;
    legbyes: boolean;
};

export function UmpireControls({ match }: { match: Match }) {
    const { recordDelivery, swapStrikers, undoDelivery, retireStriker, forceEndInning, getPlayerById, getPlayersByTeamId, getTeamById } = useAppContext();
    const [extras, setExtras] = useState<ExtraOptions>({
        wicket: false, wide: false, noball: false, byes: false, legbyes: false
    });
    const [isRetireDialogOpen, setIsRetireDialogOpen] = useState(false);
    const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
    const [deliveryForWicket, setDeliveryForWicket] = useState<{ runs: number, extra: 'wide' | 'noball' | 'byes' | 'legbyes' | null } | null>(null);
    
    const currentInning = match.innings[match.currentInning - 1];
    const striker = getPlayerById(currentInning.strikerId || '');
    const nonStriker = getPlayerById(currentInning.nonStrikerId || '');

    // Get available batsmen
    const battingTeamPlayers = getPlayersByTeamId(currentInning.battingTeamId);
    const outPlayerIds = new Set(match.innings.flatMap(inning => inning.deliveryHistory.filter(d => d.isWicket && d.dismissal).map(d => d.dismissal!.batsmanOutId)));
    const retiredHurtPlayerIds = new Set(currentInning.retiredHurtPlayerIds || []);
    const onFieldPlayerIds = new Set([currentInning.strikerId, currentInning.nonStrikerId].filter(Boolean));
    const availableBatsmen = battingTeamPlayers.filter(p => 
        !outPlayerIds.has(p.id) && 
        !retiredHurtPlayerIds.has(p.id) &&
        !onFieldPlayerIds.has(p.id)
    );

    const bowlingTeamPlayers = getPlayersByTeamId(currentInning.bowlingTeamId);

    const handleExtraChange = (extra: keyof ExtraOptions, checked: boolean) => {
        setExtras(prev => {
            const newExtras = { ...prev };
            // Mutually exclusive extras
            if (checked) {
                if (extra === 'wide') {
                    newExtras.noball = false; newExtras.byes = false; newExtras.legbyes = false;
                }
                if (extra === 'noball') {
                    newExtras.wide = false;
                }
                if (extra === 'byes' || extra === 'legbyes') {
                    newExtras.wide = false;
                }
            }
            newExtras[extra] = checked;
            return newExtras;
        });
    };

    const handleDelivery = (runs: number) => {
        let extraType: 'wide' | 'noball' | 'byes' | 'legbyes' | null = null;
        if (extras.wide) extraType = 'wide';
        else if (extras.noball) extraType = 'noball';
        else if (extras.byes) extraType = 'byes';
        else if (extras.legbyes) extraType = 'legbyes';

        if (extras.wicket) {
            setDeliveryForWicket({ runs, extra: extraType });
            setIsWicketDialogOpen(true);
            return;
        }

        let outcomeString = runs.toString();
        if(extras.wicket) outcomeString = 'W';
        if(extraType === 'wide') outcomeString = `${runs > 0 ? runs : ''}wd`;
        if(extraType === 'noball') outcomeString = `${runs > 0 ? runs : ''}nb`;
        if(extraType === 'byes') outcomeString = `${runs}b`;
        if(extraType === 'legbyes') outcomeString = `${runs}lb`;


        recordDelivery(match, {
            runs: runs,
            isWicket: extras.wicket,
            extra: extraType,
            outcome: outcomeString,
        });

        // Reset extras after recording
        setExtras({ wicket: false, wide: false, noball: false, byes: false, legbyes: false });
    };
    
    const handleWicketConfirm = (wicketData: { batsmanOutId: string; dismissalType: string; newBatsmanId?: string; fielderId?: string; }) => {
        if (!deliveryForWicket) return;

        recordDelivery(match, {
            runs: deliveryForWicket.runs,
            isWicket: true,
            extra: deliveryForWicket.extra,
            outcome: wicketData.dismissalType,
            wicketDetails: wicketData,
        });

        setIsWicketDialogOpen(false);
        setDeliveryForWicket(null);
        setExtras({ wicket: false, wide: false, noball: false, byes: false, legbyes: false });
    }

    const handleRetireConfirm = () => {
        retireStriker(match);
        setIsRetireDialogOpen(false);
    };

    const CurrentOver = () => {
        const deliveries = currentInning.deliveryHistory;
        const overs = currentInning.overs;
        const overDeliveries = [];
        if (deliveries.length > 0) {
            let legalBallsInCurrentOver = 0;
            const overNumber = Math.floor(overs);
            const ballsInOver = Math.round((overs - overNumber) * 10);
            if (ballsInOver > 0) {
                legalBallsInCurrentOver = ballsInOver;
            } else if (overs > 0 && overs % 1 === 0 && deliveries.at(-1)?.extra !== 'wide' && deliveries.at(-1)?.extra !== 'noball') {
                legalBallsInCurrentOver = 6;
            }

            let ballsFound = 0;
            for (let i = deliveries.length - 1; i >= 0; i--) {
                const delivery = deliveries[i];
                overDeliveries.unshift(delivery);
                if (delivery.extra !== 'wide' && delivery.extra !== 'noball') {
                    ballsFound++;
                }
                if (ballsFound >= legalBallsInCurrentOver) {
                    break;
                }
            }
        }

        return (
            <div className="space-y-2">
                <Label>This Over</Label>
                <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-md min-h-[40px] items-center">
                    {overDeliveries.length > 0 ? overDeliveries.map((d, i) => (
                        <Badge key={i} variant={d.isWicket ? 'destructive' : 'secondary'} className="text-md">
                            {d.outcome}
                        </Badge>
                    )) : <p className="text-sm text-muted-foreground px-2">No deliveries bowled in this over yet.</p>}
                </div>
            </div>
        );
    };
    
    const endInningButtonText = match.currentInning === 1 ? 'End 1st Inning' : 'End Match';

    return (
        <>
            <WicketDialog
                open={isWicketDialogOpen}
                onClose={() => setIsWicketDialogOpen(false)}
                striker={striker}
                nonStriker={nonStriker}
                availableBatsmen={availableBatsmen}
                bowlingTeamPlayers={bowlingTeamPlayers}
                onConfirm={handleWicketConfirm}
            />
            <RetirePlayerDialog 
                open={isRetireDialogOpen}
                onClose={() => setIsRetireDialogOpen(false)}
                striker={striker}
                onConfirm={handleRetireConfirm}
            />
            <Card>
                <CardHeader>
                    <CardTitle>Umpire Controls</CardTitle>
                    <CardDescription>Record the outcome of each delivery.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <CurrentOver />
                    <div className="space-y-3">
                        <Label>Extras & Wicket</Label>
                        <div className="flex flex-wrap gap-4 items-center">
                            {Object.keys(extras).map(extra => (
                                <div key={extra} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={extra} 
                                        checked={extras[extra as keyof ExtraOptions]}
                                        onCheckedChange={(checked) => handleExtraChange(extra as keyof ExtraOptions, !!checked)}
                                    />
                                    <Label htmlFor={extra} className="font-normal capitalize">{extra === 'noball' ? 'NB' : extra}</Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {[0, 1, 2, 3, 4, 6].map(runs => (
                            <Button key={runs} className="h-14 text-lg" variant="outline" onClick={() => handleDelivery(runs)}>
                                {runs}
                            </Button>
                        ))}
                        <Button className="h-14 text-sm font-bold" variant="outline" onClick={() => swapStrikers(match)}>Swap</Button>
                        <Button className="h-14 text-sm font-bold" variant="outline" onClick={() => undoDelivery(match)}>Undo</Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 border-t pt-4 mt-2">
                        <Button variant="destructive" onClick={() => setIsRetireDialogOpen(true)}><UserX className="mr-2 h-4 w-4" /> Retire Batsman</Button>
                        <Button variant="destructive" className="bg-red-700 hover:bg-red-800" onClick={() => forceEndInning(match)}>{endInningButtonText}</Button>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
