
export type Player = {
    id: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    consecutiveDots: number;
    dismissal?: {
        type: string;
        bowlerName: string;
        fielderName?: string;
    };
    duck: boolean;
    goldenDuck: boolean;
    ballsBowled: number;
    runsConceded: number;
    wicketsTaken: number;
    oversBowled: number;
};

export type GameState = {
    status: 'setup' | 'live' | 'completed';
    players: Player[];
    currentBatsmanIndex: number;
    currentBowlerIndex: number;
    totalWickets: number;
    totalOvers: number;
    currentOver: {
        deliveries: string[];
        legalBalls: number;
    };
};
