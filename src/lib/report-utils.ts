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
    const isLegal = ['none', 'bye', 'legbye'].includes(d.extraType);
    if (isLegal) currentBalls += 1;

    // Partnership Tracking
    if (!activePartnership.batter1Id) {
      activePartnership.batter1Id = sId;
      activePartnership.batter2Id = nsId && nsId !== 'none' ? nsId : '';
    }

    activePartnership.runs += (d.totalRunsOnDelivery || 0);
    if (isLegal) activePartnership.balls += 1;
    
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
      
      const overDisplay = `${Math.floor((currentBalls - 1) / 6)}.${((currentBalls - 1) % 6) + 1}`;
      
      fow.push({
        wicketNum: currentWickets,
        scoreAtWicket: currentScore,
        overs: overDisplay,
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
      if (isLegal) {
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
 * Generates a detailed 1-page HTML report for a standard league match.
 */
export const generateMatchReport = (match: any, teamNames: Record<string, string>, playerNames: Record<string, string>, inn1: any, inn2: any, stats1: any, stats2: any) => {
  const dateStr = new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  
  const renderInning = (title: string, team: string, inning: any, stats: any) => `
    <div class="inning-section">
      <div class="inning-header">
        <span class="inning-title">${title}</span>
        <span class="inning-score">${team}: ${inning?.score || 0}/${inning?.wickets || 0} (${inning?.oversCompleted}.${inning?.ballsInCurrentOver || 0})</span>
      </div>
      <table>
        <thead>
          <tr><th>Batter</th><th>Runs</th><th>Balls</th><th>4s</th><th>6s</th><th>SR</th></tr>
        </thead>
        <tbody>
          ${stats.batting.map((b: any) => `
            <tr>
              <td class="player-name">${playerNames[b.id]} <br/><small>${b.out ? b.dismissal : 'not out'}</small></td>
              <td class="bold">${b.runs}</td>
              <td>${b.balls}</td>
              <td>${b.fours}</td>
              <td>${b.sixes}</td>
              <td>${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="height: 20px;"></div>
      <table>
        <thead>
          <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>ER</th></tr>
        </thead>
        <tbody>
          ${stats.bowling.map((bw: any) => `
            <tr>
              <td class="player-name">${playerNames[bw.id]}</td>
              <td>${bw.oversDisplay}</td>
              <td>${bw.maidens}</td>
              <td class="bold">${bw.runs}</td>
              <td class="bold color-sec">${bw.wickets}</td>
              <td>${bw.economy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  return `
    <html>
    <head>
      <title>CricMates Official Report - ${match.id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.4; background: #f8fafc; }
        .container { max-width: 900px; margin: auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 4px solid #3f51b5; padding-bottom: 20px; margin-bottom: 30px; }
        h1 { margin: 0; color: #3f51b5; font-weight: 900; text-transform: uppercase; font-size: 28px; letter-spacing: -0.05em; }
        .result { font-weight: 900; color: #009688; text-transform: uppercase; margin-top: 10px; font-size: 18px; }
        .meta { color: #64748b; font-weight: bold; font-size: 12px; text-transform: uppercase; margin-top: 5px; }
        .inning-section { margin-bottom: 40px; }
        .inning-header { background: #1e293b; color: white; padding: 12px 20px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .inning-title { font-weight: 900; text-transform: uppercase; font-size: 14px; }
        .inning-score { font-weight: 900; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; background: #f1f5f9; padding: 10px; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
        .player-name { font-weight: 700; text-transform: uppercase; }
        .bold { font-weight: 900; }
        .color-sec { color: #009688; }
        .footer { text-align: center; margin-top: 50px; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; border-top: 1px dashed #e2e8f0; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CricMates Pro League</h1>
          <div class="meta">${teamNames[match.team1Id]} vs ${teamNames[match.team2Id]} • ${dateStr}</div>
          <div class="result">${match.resultDescription}</div>
        </div>
        ${renderInning("First Innings", teamNames[inn1?.battingTeamId], inn1, stats1)}
        ${inn2 ? renderInning("Second Innings", teamNames[inn2?.battingTeamId], inn2, stats2) : ''}
        <div class="footer">Digitally Verified by CricMates Advanced Scoring Engine</div>
      </div>
    </body>
    </html>
  `;
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
