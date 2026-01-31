'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeliveryRecord, Inning, Match, Player, Team } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { useMemo } from "react";

const DeliveryBadge = ({ delivery }: { delivery: DeliveryRecord }) => {
    const isFour = delivery.runs === 4 && !delivery.extra;
    const isSix = delivery.runs === 6 && !delivery.extra;
    const isWicket = delivery.isWicket;

    let baseClasses = "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm";
    let variantClasses = "bg-muted text-muted-foreground";

    if (isWicket) {
        variantClasses = "bg-destructive text-destructive-foreground";
    } else if (isFour || isSix) {
        variantClasses = "bg-primary text-primary-foreground";
    } else if (delivery.extra) {
        variantClasses = "bg-secondary text-secondary-foreground";
    }

    return (
        <div className={`${baseClasses} ${variantClasses}`}>
            {delivery.outcome}
        </div>
    )
}


const OverSummary = ({ overNumber, deliveries, inning, players }: { overNumber: number, deliveries: DeliveryRecord[], inning: Inning, players: Player[] }) => {
    const getPlayerById = useMemo(() => (playerId: string) => players.find(p => p.id === playerId), [players]);
    const bowler = getPlayerById(deliveries[0]?.bowlerId);
    
    let runsInOver = 0;
    deliveries.forEach(d => {
        runsInOver += d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') {
            runsInOver += 1;
        }
    });

    let scoreAtOverEnd = 0;
    let wicketsAtOverEnd = 0;
    const overEndDeliveryIndex = inning.deliveryHistory.findIndex(d => d.timestamp === deliveries[deliveries.length - 1].timestamp);

    for (let i = 0; i <= overEndDeliveryIndex; i++) {
        const d = inning.deliveryHistory[i];
        scoreAtOverEnd += d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') {
            scoreAtOverEnd += 1;
        }
        if (d.isWicket) {
            wicketsAtOverEnd++;
        }
    }

    const striker = getPlayerById(deliveries[deliveries.length - 1].strikerId);
    const nonStriker = getPlayerById(deliveries[deliveries.length - 1].nonStrikerId || '');

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-baseline">
                <div className="text-sm">
                    <p className="text-muted-foreground">Over {overNumber} • {bowler?.name || 'N/A'}</p>
                    <p className="font-bold">{runsInOver} Run{runsInOver !== 1 && 's'}</p>
                </div>
                <p className="font-bold text-lg">{scoreAtOverEnd}/{wicketsAtOverEnd}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                {deliveries.map((d, i) => (
                    <DeliveryBadge key={i} delivery={d} />
                ))}
            </div>
            <div className="text-xs text-muted-foreground">
              <p><span className="font-semibold">On Strike:</span> {striker?.name} | <span className="font-semibold">Non-striker:</span> {nonStriker?.name}</p>
            </div>
        </div>
    )
}

const InningOvers = ({ inning, teams, players }: { inning: Inning, teams: Team[], players: Player[] }) => {
    const getTeamById = useMemo(() => (teamId: string) => teams.find(t => t.id === teamId), [teams]);
    const battingTeam = getTeamById(inning.battingTeamId);

    const overs: DeliveryRecord[][] = [];
    if (inning.deliveryHistory.length > 0) {
        let currentOver: DeliveryRecord[] = [];
        let legalDeliveriesInOver = 0;
        
        for (const delivery of inning.deliveryHistory) {
            currentOver.push(delivery);
            if (delivery.extra !== 'wide' && delivery.extra !== 'noball') {
                legalDeliveriesInOver++;
            }
            if (legalDeliveriesInOver === 6) {
                overs.push(currentOver);
                currentOver = [];
                legalDeliveriesInOver = 0;
            }
        }
        if (currentOver.length > 0) {
            overs.push(currentOver);
        }
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-foreground text-background p-4">
                <CardTitle className="text-lg">{battingTeam?.name} Innings</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {overs.length > 0 ? (
                    overs.reverse().map((overDeliveries, index) => (
                        <div key={index} className="space-y-4">
                            <OverSummary 
                                overNumber={overs.length - index} 
                                deliveries={overDeliveries} 
                                inning={inning} 
                                players={players}
                            />
                            {index < overs.length -1 && <Separator />}
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No overs have been bowled yet.</p>
                )}
            </CardContent>
        </Card>
    );
};


export function OverByOver({ match, teams, players }: { match: Match; teams: Team[]; players: Player[]; }) {
    const firstInning = match.innings[0];
    const secondInning = match.innings.length > 1 ? match.innings[1] : null;

    return (
        <div className="space-y-6">
            {secondInning && <InningOvers inning={secondInning} teams={teams} players={players} />}
            {firstInning && <InningOvers inning={firstInning} teams={teams} players={players} />}
        </div>
    )
}
