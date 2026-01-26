'use client';

import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DeliveryRecord, Inning, Match } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const OverSummary = ({ overNumber, deliveries, inning }: { overNumber: number, deliveries: DeliveryRecord[], inning: Inning }) => {
    const { getPlayerById } = useAppContext();
    const bowler = getPlayerById(deliveries[0]?.bowlerId);
    
    let runsInOver = 0;
    let wicketsInOver = 0;
    deliveries.forEach(d => {
        runsInOver += d.runs;
        if (d.extra === 'wide' || d.extra === 'noball') {
            runsInOver += 1;
        }
        if (d.isWicket) {
            wicketsInOver++;
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
        <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
                <p>End of Over {overNumber}: <span className="font-bold">{runsInOver} run{runsInOver !== 1 && 's'}</span></p>
                <p className="font-semibold">{scoreAtOverEnd}/{wicketsAtOverEnd}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                {deliveries.map((d, i) => (
                    <Badge key={i} variant={d.isWicket ? "destructive" : "secondary"} className="text-sm">{d.outcome}</Badge>
                ))}
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <p>Striker: {striker?.name} | Non-striker: {nonStriker?.name}</p>
              <p>Bowler: {bowler?.name || 'N/A'}</p>
            </div>
        </div>
    )
}

const InningOvers = ({ inning }: { inning: Inning }) => {
    const { getTeamById } = useAppContext();
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
        <Card>
            <CardHeader>
                <CardTitle>{battingTeam?.name} Innings</CardTitle>
                <CardDescription>Over by Over Summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {overs.length > 0 ? (
                    overs.reverse().map((overDeliveries, index) => (
                        <div key={index} className="space-y-4">
                            <OverSummary 
                                overNumber={overs.length - index} 
                                deliveries={overDeliveries} 
                                inning={inning} 
                            />
                            {index < overs.length -1 && <Separator />}
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No overs have been bowled yet.</p>
                )}
            </CardContent>
        </Card>
    );
};


export function OverByOver({ match }: { match: Match }) {
    const firstInning = match.innings[0];
    const secondInning = match.innings.length > 1 ? match.innings[1] : null;

    return (
        <div className="space-y-6">
            {secondInning && <InningOvers inning={secondInning} />}
            {firstInning && <InningOvers inning={firstInning} />}
        </div>
    )
}
