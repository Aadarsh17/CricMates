'use client';
import type { Match, Team } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";

export function Scoreboard({ match, teams }: { match: Match, teams: Team[] }) {
    const getTeamById = useMemo(() => (teamId: string) => teams.find(t => t.id === teamId), [teams]);
    const currentInning = match.innings[match.currentInning - 1];
    const battingTeam = getTeamById(currentInning.battingTeamId);

    const ballsBowled = Math.floor(currentInning.overs) * 6 + (currentInning.overs % 1) * 10;
    const crr = ballsBowled > 0 ? (currentInning.score / (ballsBowled / 6)).toFixed(2) : '0.00';
    
    let rrr = 'N/A';
    let target = 'N/A';
    
    if (match.currentInning === 2) {
        const firstInningScore = match.innings[0].score;
        target = (firstInningScore + 1).toString();
        const runsNeeded = firstInningScore + 1 - currentInning.score;
        const totalBalls = match.overs * 6;
        const ballsRemaining = totalBalls - ballsBowled;

        if (runsNeeded <= 0) {
            rrr = '0.00';
        } else if (ballsRemaining > 0) {
            rrr = (runsNeeded / (ballsRemaining / 6)).toFixed(2);
        } else {
            rrr = '∞';
        }
    }

    return (
        <Card>
            <CardContent className="p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">{battingTeam?.name} Innings ({match.overs} overs)</p>
                <div className="flex justify-center items-center gap-4">
                    <p className="text-4xl font-bold">{currentInning.score}/{currentInning.wickets}</p>
                    <p className="text-2xl text-muted-foreground">({currentInning.overs.toFixed(1)})</p>
                </div>
                <div className="flex justify-around text-sm pt-2">
                    <div><span className="font-semibold">CRR:</span> {crr}</div>
                    <div><span className="font-semibold">RRR:</span> {rrr}</div>
                    <div><span className="font-semibold">Target:</span> {target}</div>
                </div>
            </CardContent>
        </Card>
    );
}
