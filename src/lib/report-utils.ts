
/**
 * @fileOverview Utility functions for match statistics, professional scorecard generation, and match flow timeline logic.
 */

export const getExtendedInningStats = (deliveries: any[]) => {
  if (!deliveries || deliveries.length === 0) return { batting: [], bowling: [], fow: [], partnerships: [] };
  
  const bat: Record<string, any> = {};
  const bowl: Record<string, any> = {};
  const fow: any[] = [];
  const partnerships: any[] = [];
  const battingOrder: string[] = [];

  let currentScore = 0;
  let currentBalls = 0;
  let currentWickets = 0;

  // Track the current partnership
  let activePartnership = {
    batter1Id: '',
    batter2Id: '',
    runs: 0,
    balls: 0,
    batter1Runs: 0,
    batter2Runs: 0,
    batter1Balls: 0,
    batter2Balls: 0
  };

  deliveries.forEach((d, idx) => {
    const sId = d.strikerPlayerId;
    const nsId = d.nonStrikerPlayerId;
    const bId = d.bowlerId || d.bowlerPlayerId;
    
    if (!sId) return;

    // Track batting order
    [sId, nsId].forEach(id => {
      if (id && id !== 'none' && !battingOrder.includes(id)) {
        battingOrder.push(id);
      }
    });

    if (!bat[sId]) {
      bat[sId] = { id: sId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '', bowlerId: '', fielderId: '' };
    }
    if (nsId && nsId !== 'none' && !bat[nsId]) {
      bat[nsId] = { id: nsId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '', bowlerId: '', fielderId: '' };
    }
    
    // Legal ball stats
    if (d.extraType !== 'wide') {
      bat[sId].balls += 1;
      bat[sId].runs += (d.runsScored || 0);
      if (d.runsScored === 4) bat[sId].fours += 1;
      if (d.runsScored === 6) bat[sId].sixes += 1;
    }

    currentScore += (d.totalRunsOnDelivery || 0);
    if (d.extraType !== 'wide' && d.extraType !== 'noball') currentBalls += 1;

    // Partnership Logic
    if (!activePartnership.batter1Id) {
      activePartnership.batter1Id = sId;
      activePartnership.batter2Id = nsId && nsId !== 'none' ? nsId : '';
    }

    activePartnership.runs += (d.totalRunsOnDelivery || 0);
    if (d.extraType !== 'wide' && d.extraType !== 'noball') activePartnership.balls += 1;
    
    if (sId === activePartnership.batter1Id) {
      activePartnership.batter1Runs += (d.runsScored || 0);
      if (d.extraType !== 'wide') activePartnership.batter1Balls += 1;
    } else if (sId === activePartnership.batter2Id) {
      activePartnership.batter2Runs += (d.runsScored || 0);
      if (d.extraType !== 'wide') activePartnership.batter2Balls += 1;
    }

    // Wicket Logic
    if (d.isWicket) {
      currentWickets += 1;
      const outPid = d.batsmanOutPlayerId || sId;
      if (bat[outPid]) {
        bat[outPid].out = true;
        bat[outPid].dismissal = d.dismissalType || 'out';
        bat[outPid].bowlerId = bId;
        bat[outPid].fielderId = d.fielderPlayerId;
      }
      
      fow.push({
        wicketNum: currentWickets,
        scoreAtWicket: currentScore,
        overs: `${Math.floor(currentBalls / 6)}.${currentBalls % 6}`,
        playerOutId: outPid,
        playerRuns: bat[outPid]?.runs || 0
      });

      partnerships.push({...activePartnership});
      
      // Start new partnership
      activePartnership = {
        batter1Id: outPid === activePartnership.batter1Id ? '' : activePartnership.batter1Id,
        batter2Id: outPid === activePartnership.batter2Id ? '' : activePartnership.batter2Id,
        runs: 0,
        balls: 0,
        batter1Runs: 0,
        batter2Runs: 0,
        batter1Balls: 0,
        batter2Balls: 0
      };
    }

    // End of innings partnership save
    if (idx === deliveries.length - 1 && activePartnership.balls > 0) {
      partnerships.push({...activePartnership});
    }

    // Bowling Stats
    if (bId) {
      if (!bowl[bId]) bowl[bId] = { id: bId, overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 };
      bowl[bId].runs += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') {
        bowl[bId].wickets += 1;
      }
      if (d.extraType !== 'wide' && d.extraType !== 'noball') {
        bowl[bId].balls += 1;
      }
    }
  });

  // Return sorted by batting order
  const sortedBatting = battingOrder.map(id => bat[id]).filter(b => !!b);

  return {
    batting: sortedBatting,
    bowling: Object.values(bowl).map(b => ({ ...b, oversDisplay: `${Math.floor(b.balls / 6)}.${b.balls % 6}` })),
    fow,
    partnerships
  };
};
