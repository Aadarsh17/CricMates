/**
 * @fileOverview Utility functions for match statistics, professional scorecard generation, and match flow timeline logic.
 */

export const getExtendedInningStats = (deliveries: any[]) => {
  if (!deliveries || deliveries.length === 0) return { batting: [], bowling: [], fow: [], partnerships: [], history: [] };
  
  const bat: Record<string, any> = {};
  const bowl: Record<string, any> = {};
  const fow: any[] = [];
  const partnerships: any[] = [];
  const battingOrder: string[] = [];

  let currentScore = 0;
  let currentBalls = 0;
  let currentWickets = 0;

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

    // Batting Order Tracking
    [sId, nsId].forEach(id => {
      if (id && id !== 'none' && !battingOrder.includes(id)) {
        battingOrder.push(id);
      }
    });

    if (!bat[sId]) {
      bat[sId] = { id: sId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, status: 'Not Out', dismissal: '', bowlerId: '', fielderId: '' };
    }
    if (nsId && nsId !== 'none' && !bat[nsId]) {
      bat[nsId] = { id: nsId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, status: 'Not Out', dismissal: '', bowlerId: '', fielderId: '' };
    }
    
    // Batting Stats
    if (d.extraType !== 'wide') {
      bat[sId].balls += 1;
      bat[sId].runs += (d.runsScored || 0);
      if (d.runsScored === 4) bat[sId].fours += 1;
      if (d.runsScored === 6) bat[sId].sixes += 1;
    }

    currentScore += (d.totalRunsOnDelivery || 0);
    if (['none', 'bye', 'legbye'].includes(d.extraType)) currentBalls += 1;

    // Partnership Tracking
    if (!activePartnership.batter1Id) {
      activePartnership.batter1Id = sId;
      activePartnership.batter2Id = nsId && nsId !== 'none' ? nsId : '';
    }

    activePartnership.runs += (d.totalRunsOnDelivery || 0);
    if (['none', 'bye', 'legbye'].includes(d.extraType)) activePartnership.balls += 1;
    
    if (sId === activePartnership.batter1Id) {
      activePartnership.batter1Runs += (d.runsScored || 0);
      if (d.extraType !== 'wide') activePartnership.batter1Balls += 1;
    } else if (sId === activePartnership.batter2Id) {
      activePartnership.batter2Runs += (d.runsScored || 0);
      if (d.extraType !== 'wide') activePartnership.batter2Balls += 1;
    }

    // Wicket Processing
    if (d.isWicket) {
      currentWickets += 1;
      const outPid = d.batsmanOutPlayerId || sId;
      if (bat[outPid]) {
        bat[outPid].out = true;
        bat[outPid].status = 'Out';
        bat[outPid].dismissal = d.dismissalType || 'out';
        bat[outPid].bowlerId = bId;
        bat[outPid].fielderId = d.fielderPlayerId;
      }
      
      fow.push({
        wicketNum: currentWickets,
        scoreAtWicket: currentScore,
        overs: `${Math.floor((currentBalls - 1) / 6)}.${((currentBalls - 1) % 6) + 1}`,
        playerOutId: outPid,
        playerRuns: bat[outPid]?.runs || 0
      });

      partnerships.push({...activePartnership});
      
      // Reset partnership
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

    if (idx === deliveries.length - 1 && activePartnership.balls > 0) {
      partnerships.push({...activePartnership});
    }

    // Bowling Stats
    if (bId) {
      if (!bowl[bId]) bowl[bId] = { id: bId, balls: 0, runs: 0, wickets: 0, maidens: 0 };
      bowl[bId].runs += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) {
        bowl[bId].wickets += 1;
      }
      if (['none', 'bye', 'legbye'].includes(d.extraType)) {
        bowl[bId].balls += 1;
      }
    }
  });

  const sortedBatting = battingOrder.map(id => bat[id]).filter(b => !!b);

  return {
    batting: sortedBatting,
    bowling: Object.values(bowl).map(b => ({ 
      ...b, 
      oversDisplay: `${Math.floor(b.balls / 6)}.${b.balls % 6}`,
      economy: b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'
    })),
    fow,
    partnerships,
    history: deliveries.map(d => ({
      label: d.overLabel,
      val: d.isWicket ? 'W' : d.totalRunsOnDelivery,
      type: d.isWicket ? 'wicket' : d.totalRunsOnDelivery >= 6 ? 'six' : d.totalRunsOnDelivery >= 4 ? 'four' : 'normal'
    }))
  };
};

/**
 * Generates an HTML report for Street Pro sessions.
 */
export const generateStreetReport = (players: any[], date: string) => {
  const sorted = [...players].sort((a, b) => b.batting.runs - a.batting.runs);
  
  let html = `
    <html>
    <head>
      <title>CricMates Street Pro Report - ${date}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
        h1 { color: #3f51b5; border-bottom: 4px solid #3f51b5; padding-bottom: 15px; margin-bottom: 5px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em; }
        .date { color: #64748b; font-weight: bold; font-size: 14px; margin-bottom: 30px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        th, td { border: 1px solid #e2e8f0; padding: 16px; text-align: left; }
        th { background-color: #f8fafc; font-weight: 900; text-transform: uppercase; font-size: 11px; color: #64748b; letter-spacing: 0.1em; }
        tr:nth-child(even) { background-color: #fcfcfc; }
        .footer { margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; }
        .highlight { color: #3f51b5; font-weight: 900; text-transform: uppercase; }
        .runs { font-weight: 900; font-size: 16px; }
        .wkts { font-weight: 900; color: #009688; }
      </style>
    </head>
    <body>
      <h1>CricMates Street Pro Session</h1>
      <p class="date">Official Scorecard • ${date}</p>
      
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Participant</th>
            <th>Runs</th>
            <th>Balls</th>
            <th>4s</th>
            <th>6s</th>
            <th>Wickets</th>
            <th>Economy</th>
          </tr>
        </thead>
        <tbody>
  `;

  sorted.forEach((p, i) => {
    const econ = p.bowling.balls > 0 ? (p.bowling.runs / (p.bowling.balls / 6)).toFixed(2) : '0.00';
    html += `
      <tr>
        <td>${i + 1}</td>
        <td class="highlight">${p.name}</td>
        <td class="runs">${p.batting.runs}</td>
        <td>${p.batting.balls}</td>
        <td>${p.batting.fours}</td>
        <td>${p.batting.sixes}</td>
        <td class="wkts">${p.bowling.wickets}</td>
        <td>${econ}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <div class="footer">Verified by CricMates Pro League Scoring Engine</div>
    </body>
    </html>
  `;
  return html;
};
