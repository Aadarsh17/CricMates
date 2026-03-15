/**
 * @fileOverview Utility functions for match statistics, professional scorecard generation, and match flow timeline logic.
 */
import { formatTeamName } from './utils';

export const getExtendedInningStats = (deliveries: any[], squadIds: string[] = []) => {
  if (!deliveries || deliveries.length === 0) {
    return { 
      batting: [], 
      bowling: [], 
      fow: [], 
      partnerships: [], 
      extras: { total: 0, w: 0, nb: 0 }, 
      total: 0, 
      wickets: 0,
      overs: '0.0', 
      rr: '0.00', 
      didNotBat: squadIds 
    };
  }
  
  const bat: Record<string, any> = {};
  const bowl: Record<string, any> = {};
  const fow: any[] = [];
  const battingOrder: string[] = [];
  const extras = { total: 0, w: 0, nb: 0 };

  let currentScore = 0;
  let legalBalls = 0;
  let currentWickets = 0;
  
  let currentPartnership: any = {
    runs: 0,
    balls: 0,
    contributions: {} as Record<string, { runs: number, balls: number }>,
    isUnbroken: true
  };
  const rawPartnerships: any[] = [];

  deliveries.sort((a,b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id)).forEach((d) => {
    const sId = d.strikerPlayerId;
    const nsId = d.nonStrikerPlayerId;
    const bId = d.bowlerId || d.bowlerPlayerId;
    
    if (!sId) return;

    if (!battingOrder.includes(sId)) battingOrder.push(sId);
    if (nsId && !battingOrder.includes(nsId)) battingOrder.push(nsId);

    if (!bat[sId]) {
      bat[sId] = { id: sId, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, out: false, dismissal: 'not out', fielderId: 'none' };
    }
    if (nsId && !bat[nsId]) {
      bat[nsId] = { id: nsId, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, out: false, dismissal: 'not out', fielderId: 'none' };
    }
    
    const isRetirement = d.dismissalType === 'retired';

    if (d.extraType !== 'wide' && !isRetirement) {
      bat[sId].balls += 1;
      bat[sId].runs += (d.runsScored || 0);
      if (d.runsScored === 4) bat[sId].fours += 1;
      if (d.runsScored === 6) bat[sId].sixes += 1;
      if (d.runsScored === 0) bat[sId].dots += 1;
    }

    currentScore += (d.totalRunsOnDelivery || 0);
    
    if (d.extraType === 'wide') extras.w += (d.totalRunsOnDelivery || 1);
    else if (d.extraType === 'noball') extras.nb += (d.totalRunsOnDelivery || 1);

    const isLegal = d.extraType === 'none' && !isRetirement;
    if (isLegal) legalBalls += 1;

    // Partnership Logic
    currentPartnership.runs += (d.totalRunsOnDelivery || 0);
    if (d.extraType !== 'wide' && !isRetirement) currentPartnership.balls += 1;
    
    if (!currentPartnership.contributions[sId]) currentPartnership.contributions[sId] = { runs: 0, balls: 0 };
    if (d.extraType !== 'wide' && !isRetirement) {
      currentPartnership.contributions[sId].runs += (d.runsScored || 0);
      currentPartnership.contributions[sId].balls += 1;
    }
    
    if (nsId && !currentPartnership.contributions[nsId]) {
      currentPartnership.contributions[nsId] = { runs: 0, balls: 0 };
    }

    if (d.isWicket) {
      if (!isRetirement) currentWickets += 1;
      const outPid = d.batsmanOutPlayerId || sId;
      if (bat[outPid]) {
        bat[outPid].out = !isRetirement; // Stay available if retired
        bat[outPid].fielderId = d.fielderPlayerId || 'none';
        let discStr = d.dismissalType || 'out';
        if (d.fielderPlayerId && d.fielderPlayerId !== 'none') {
          if (discStr === 'caught') discStr = `c Fielder b Bowler`; 
          else if (discStr === 'runout') discStr = `run out (Fielder)`;
          else if (discStr === 'stumped') discStr = `st Fielder b Bowler`;
        }
        bat[outPid].dismissal = isRetirement ? 'retired hurt' : discStr;
      }
      
      if (!isRetirement) {
        const overLabel = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
        fow.push({ wicketNum: currentWickets, scoreAtWicket: currentScore, playerOutId: outPid, over: overLabel, runsOut: bat[outPid]?.runs || 0 });
      }
      
      rawPartnerships.push({ ...currentPartnership, batters: Object.keys(currentPartnership.contributions), isUnbroken: false });
      currentPartnership = { runs: 0, balls: 0, contributions: {}, isUnbroken: true };
    }

    if (bId) {
      if (!bowl[bId]) bowl[bId] = { id: bId, balls: 0, runs: 0, wickets: 0, maidens: 0, dots: 0 };
      bowl[bId].runs += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) {
        bowl[bId].wickets += 1;
      }
      if (isLegal) {
        bowl[bId].balls += 1;
        if (d.totalRunsOnDelivery === 0) bowl[bId].dots += 1;
      }
    }
  });

  if (currentPartnership.runs > 0 || currentPartnership.balls > 0 || Object.keys(currentPartnership.contributions).length > 0) {
    rawPartnerships.push({ ...currentPartnership, batters: Object.keys(currentPartnership.contributions) });
  }

  extras.total = extras.w + extras.nb;
  const oversCompleted = Math.floor(legalBalls / 6);
  const ballsInOver = legalBalls % 6;
  const totalOversDec = oversCompleted + (ballsInOver / 6);
  const rr = totalOversDec > 0 ? (currentScore / totalOversDec).toFixed(2) : '0.00';

  const didNotBat = squadIds.filter(id => !battingOrder.includes(id));

  const sortedPartnerships = rawPartnerships.sort((a, b) => b.runs - a.runs);

  return {
    batting: battingOrder.map(id => bat[id]).filter(Boolean),
    bowling: Object.values(bowl).map((b: any) => ({ 
      ...b, 
      oversDisplay: `${Math.floor(b.balls / 6)}.${b.balls % 6}`,
      economy: b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'
    })),
    fow,
    partnerships: sortedPartnerships,
    extras,
    total: currentScore,
    wickets: currentWickets,
    overs: `${oversCompleted}.${ballsInOver}`,
    rr,
    didNotBat
  };
};

export const generateMatchReport = (match: any, allTeams: any[], playerNames: Record<string, string>, inn1: any, inn2: any, stats1: any, stats2: any) => {
  return `Scorecard generated via official interface.`;
};

export const generateStreetReport = (players: any[], dateStr: string) => {
  return `
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CricMates Street Pro - Session ${dateStr}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; background: #f8fafc; }
        .container { max-width: 600px; margin: auto; background: #fff; border: 4px solid #3f51b5; padding: 20px; border-radius: 12px; }
        h1 { text-align: center; color: #3f51b5; margin: 0; font-weight: 900; text-transform: uppercase; }
        .date { text-align: center; font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 20px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; padding: 10px; background: #3f51b5; color: white; font-size: 10px; text-transform: uppercase; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 700; }
        .highlight { color: #3f51b5; font-weight: 900; }
        .dim { color: #94a3b8; }
        .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #cbd5e1; font-weight: 800; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>STREET PRO SESSION</h1>
        <div class="date">${dateStr}</div>
        <table>
          <thead>
            <tr><th>PLAYER</th><th>RUNS</th><th>WKTS</th><th>B.S.</th></tr>
          </thead>
          <tbody>
            ${players.sort((a,b) => b.batting.runs - a.batting.runs).map(p => `
              <tr>
                <td>${p.name.toUpperCase()}</td>
                <td class="highlight">${p.batting.runs} <span class="dim">(${p.batting.balls})</span></td>
                <td class="highlight">${p.bowling.wickets}</td>
                <td class="dim">${p.batting.highScore}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">POWERED BY CRICMATES LEAGUE ENGINE</div>
      </div>
    </body>
    </html>
  `;
};
