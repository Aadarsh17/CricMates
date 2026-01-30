'use client';

import type { Match } from "@/lib/types";
import { InningScorecard } from "./inning-scorecard";

export function FullScorecard({ match }: { match: Match }) {
    const firstInning = match.innings[0];
    const secondInning = match.innings.length > 1 ? match.innings[1] : null;
    
    return (
        <div className="space-y-6">
            <InningScorecard inning={firstInning} match={match} />
            {secondInning && <InningScorecard inning={secondInning} match={match} />}
        </div>
    )
}
