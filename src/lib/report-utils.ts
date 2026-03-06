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
  const sortedBatting = battingOrder.map(id => bat[id]);

  return {
    batting: sortedBatting,
    bowling: Object.values(bowl).map(b => ({ ...b, oversDisplay: `${Math.floor(b.balls / 6)}.${b.balls % 6}` })),
    fow,
    partnerships
  };
};

export const getMatchFlow = (deliveries: any[], teamName: string, players: any[]) => {
  if (!deliveries || deliveries.length === 0) return [];
  const events: any[] = [];
  
  const getPName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';
  const getPShort = (id: string) => {
    const name = getPName(id);
    return name === 'Unknown' ? '---' : name.split(' ')[0];
  };

  events.push({ type: 'header', title: `${teamName} innings` });

  let totalRuns = 0;
  let totalWickets = 0;
  let totalBalls = 0;
  let extras = 0;
  
  const batterStats: Record<string, { runs: number, balls: number, milestones: Set<number>, fours: number, sixes: number }> = {};
  const scoreMilestones = new Set<number>();

  deliveries.forEach((d, idx) => {
    const isLegal = d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye';
    totalRuns += (d.totalRunsOnDelivery || 0);
    if (isLegal) totalBalls += 1;
    extras += (d.extraRuns || 0);

    const sId = d.strikerPlayerId;
    const nsId = d.nonStrikerPlayerId;

    if (sId && !batterStats[sId]) batterStats[sId] = { runs: 0, balls: 0, milestones: new Set(), fours: 0, sixes: 0 };
    if (nsId && nsId !== 'none' && !batterStats[nsId]) batterStats[nsId] = { runs: 0, balls: 0, milestones: new Set(), fours: 0, sixes: 0 };
    
    if (isLegal && sId && batterStats[sId]) batterStats[sId].balls += 1;
    if (sId && batterStats[sId]) {
      batterStats[sId].runs += (d.runsScored || 0);
      if (d.runsScored === 4) batterStats[sId].fours += 1;
      if (d.runsScored === 6) batterStats[sId].sixes += 1;
    }

    const overVal = Math.floor(totalBalls / 6);
    const ballVal = totalBalls % 6;
    const overStr = `${overVal}.${ballVal}`;

    // Milestones
    [50, 100, 150, 200, 250, 300].forEach(m => {
      if (totalRuns >= m && !scoreMilestones.has(m)) {
        scoreMilestones.add(m);
        events.push({ type: 'normal', title: `${teamName}: ${m} runs in ${overStr} overs (${totalBalls} balls), Extras ${extras}` });
      }
    });

    if (sId && batterStats[sId]) {
      [50, 100].forEach(m => {
        const b = batterStats[sId];
        if (b.runs >= m && !b.milestones.has(m)) {
          b.milestones.add(m);
          events.push({ type: 'milestone', title: `${getPName(sId)}: ${m} off ${b.balls} balls (${b.fours} x 4, ${b.sixes} x 6)` });
        }
      });
    }

    if (d.isWicket) {
      totalWickets += 1;
    }

    if (idx === deliveries.length - 1) {
      const sId = d.strikerPlayerId;
      const nsId = d.nonStrikerPlayerId;
      
      const sRuns = (sId && batterStats[sId]) ? batterStats[sId].runs : 0;
      const nsRuns = (nsId && nsId !== 'none' && batterStats[nsId]) ? batterStats[nsId].runs : 0;
      
      const sName = sId ? getPShort(sId) : '---';
      const nsName = nsId && nsId !== 'none' ? getPShort(nsId) : '---';

      events.push({ 
        type: 'normal', 
        title: `Innings Break: ${teamName} - ${totalRuns}/${totalWickets} in ${overStr} overs`, 
        detail: `(${sName} ${sRuns}, ${nsName} ${nsRuns})` 
      });
    }
  });

  return events;
};

export const generateHTMLReport = (match: any, inn1: any, inn2: any, stats1: any, stats2: any, teams: any[], players: any[]) => {
  const getTeam = (id: string) => teams.find(t => t.id === id)?.name || 'UNK';
  const getPlayer = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';
  const getPlayerShort = (id: string) => getPlayer(id).split(' ')[0];

  const potm = match.potmPlayerId ? players.find(p => p.id === match.potmPlayerId) : null;

  const renderBattingTable = (batting: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 2px;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 1px 2px; text-align: left; font-size: 6px; text-transform: uppercase; color: #475569;">Batter</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">R</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">B</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">4s</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">6s</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">SR</th>
        </tr>
      </thead>
      <tbody>
        ${batting.map(b => `
          <tr style="border-bottom: 1px solid #f8fafc;">
            <td style="padding: 1px 2px; font-size: 7px; font-weight: 700;">
              ${getPlayer(b.id)} 
              <span style="font-size: 5px; color: #94a3b8; font-weight: normal;">${b.out ? `(${b.dismissal})` : '(not out)'}</span>
            </td>
            <td style="padding: 1px 2px; text-align: right; font-weight: 800; font-size: 7px;">${b.runs}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 7px; color: #64748b;">${b.balls}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 7px; color: #64748b;">${b.fours}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 7px; color: #64748b;">${b.sixes}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 6px; color: #94a3b8; font-weight: 700;">${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderBowlingTable = (bowling: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 2px;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 1px 2px; text-align: left; font-size: 6px; text-transform: uppercase; color: #475569;">Bowler</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">O</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">M</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">R</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">W</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 6px; text-transform: uppercase; color: #475569;">Eco</th>
        </tr>
      </thead>
      <tbody>
        ${bowling.map(b => `
          <tr style="border-bottom: 1px solid #f8fafc;">
            <td style="padding: 1px 2px; font-size: 7px; font-weight: 700;">${getPlayer(b.id)}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 7px;">${b.oversDisplay}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 7px;">${b.maidens || 0}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 7px; font-weight: 700;">${b.runs}</td>
            <td style="padding: 1px 2px; text-align: right; font-weight: 800; color: #1e40af; font-size: 7px;">${b.wickets}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 6px; color: #94a3b8;">${b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CricMates Report</title>
      <style>
        body { font-family: -apple-system, sans-serif; line-height: 1.1; color: #1e293b; max-width: 500px; margin: 0 auto; padding: 4px; background-color: #fff; font-size: 7px; }
        .header { text-align: center; border-bottom: 1.5px solid #1e40af; padding-bottom: 2px; margin-bottom: 4px; }
        h1 { margin: 0; color: #1e40af; text-transform: uppercase; font-size: 10px; font-weight: 900; }
        .match-card { background: #f8fafc; padding: 4px; border-radius: 2px; border: 1px solid #e2e8f0; margin-bottom: 6px; }
        .potm-banner { background: linear-gradient(to right, #fbbf24, #f59e0b); color: #78350f; font-size: 8px; font-weight: 900; padding: 4px; border-radius: 2px; text-transform: uppercase; margin-bottom: 6px; text-align: center; border: 1px solid #d97706; }
        .inning-title { background: #1e40af; color: white; padding: 1px 4px; font-weight: 900; text-transform: uppercase; font-size: 7px; display: flex; justify-content: space-between; margin-top: 6px; }
        .inning-subtitle { background: #475569; color: white; padding: 1px 4px; font-weight: 800; text-transform: uppercase; font-size: 6px; margin-top: 4px; }
        .result { font-size: 9px; font-weight: 900; color: #1e40af; text-align: center; text-transform: uppercase; margin: 3px 0; border-top: 1px solid #e2e8f0; padding-top: 3px; }
        .dual-col { display: flex; gap: 4px; margin: 4px 0; }
        .dual-col > div { flex: 1; border: 1px solid #f1f5f9; padding: 2px; border-radius: 1px; }
        .col-title { font-size: 6px; font-weight: 900; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; margin-bottom: 2px; padding-bottom: 1px; }
        .stats-item { font-size: 6px; color: #334155; margin-bottom: 1px; }
        footer { margin-top: 8px; text-align: center; border-top: 1.5px solid #f1f5f9; padding-top: 2px; color: #cbd5e1; font-size: 5px; font-weight: 800; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>OFFICIAL MATCH SCORECARD</h1>
        <div style="font-weight: 700; color: #94a3b8; font-size: 6px; text-transform: uppercase;">
          ${match.matchDate ? new Date(match.matchDate).toLocaleDateString('en-GB') : '---'} | ${match.totalOvers} OV MATCH
        </div>
      </div>

      ${potm ? `<div class="potm-banner">🏆 PLAYER OF THE MATCH: ${potm.name} (${match.potmCvpScore?.toFixed(1)} CVP)</div>` : ''}
      
      <div class="match-card">
        <div style="display: flex; justify-content: space-between; align-items: center; text-align: center;">
          <div style="flex: 1;">
            <div style="font-weight: 800; font-size: 7px; color: #475569;">${getTeam(match.team1Id)}</div>
            <div style="font-size: 12px; font-weight: 900; color: #1e40af;">${inn1?.score}/${inn1?.wickets}</div>
            <div style="font-size: 6px; color: #94a3b8;">${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver} OV</div>
          </div>
          <div style="font-weight: 900; font-size: 7px; color: #cbd5e1; width: 30px;">VS</div>
          <div style="flex: 1;">
            <div style="font-weight: 800; font-size: 7px; color: #475569;">${getTeam(match.team2Id)}</div>
            <div style="font-size: 12px; font-weight: 900; color: #1e40af;">${inn2?.score}/${inn2?.wickets}</div>
            <div style="font-size: 6px; color: #94a3b8;">${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver} OV</div>
          </div>
        </div>
        <div class="result">${match.resultDescription}</div>
      </div>

      <div class="inning-title">
        <span>1st Inn: ${getTeam(inn1?.battingTeamId)}</span>
        <span>${inn1?.score}/${inn1?.wickets} (${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver})</span>
      </div>
      ${renderBattingTable(stats1.batting)}
      <div class="dual-col">
        <div>
          <div class="col-title">Fall of Wickets</div>
          ${stats1.fow.map(f => `<div class="stats-item"><strong>${f.wicketNum}-${f.scoreAtWicket}</strong> (${getPlayerShort(f.playerOutId)} ${f.playerRuns}, ${f.overs})</div>`).join('')}
        </div>
        <div>
          <div class="col-title">Partnerships</div>
          ${stats1.partnerships.slice(0, 5).map(p => `<div class="stats-item">${getPlayerShort(p.batter1Id)}-${getPlayerShort(p.batter2Id)}: <strong>${p.runs}</strong>(${p.balls})</div>`).join('')}
        </div>
      </div>
      <div class="inning-subtitle">Bowling: ${getTeam(inn1?.bowlingTeamId)}</div>
      ${renderBowlingTable(stats1.bowling)}

      <div class="inning-title">
        <span>2nd Inn: ${getTeam(inn2?.battingTeamId)}</span>
        <span>${inn2?.score}/${inn2?.wickets} (${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver})</span>
      </div>
      ${renderBattingTable(stats2.batting)}
      <div class="dual-col">
        <div>
          <div class="col-title">Fall of Wickets</div>
          ${stats2.fow.map(f => `<div class="stats-item"><strong>${f.wicketNum}-${f.scoreAtWicket}</strong> (${getPlayerShort(f.playerOutId)} ${f.playerRuns}, ${f.overs})</div>`).join('')}
        </div>
        <div>
          <div class="col-title">Partnerships</div>
          ${stats2.partnerships.slice(0, 5).map(p => `<div class="stats-item">${getPlayerShort(p.batter1Id)}-${getPlayerShort(p.batter2Id)}: <strong>${p.runs}</strong>(${p.balls})</div>`).join('')}
        </div>
      </div>
      <div class="inning-subtitle">Bowling: ${getTeam(inn2?.bowlingTeamId)}</div>
      ${renderBowlingTable(stats2.bowling)}

      <footer>GENERATED BY CRICMATES | ONE-PAGE PRO SCORECARD</footer>
    </body>
    </html>
  `;
};
