/**
 * @fileOverview Utility functions for calculating match statistics and generating professional, ultra-compact HTML reports.
 * Optimized for high-density information display and single-page screenshots.
 */

export const getExtendedInningStats = (deliveries: any[]) => {
  if (!deliveries) return { batting: [], bowling: [], fow: [], partnerships: [] };
  const bat: Record<string, any> = {};
  const bowl: Record<string, any> = {};
  const fow: any[] = [];
  const partnerships: any[] = [];

  let currentScore = 0;
  let currentBalls = 0;
  let currentWickets = 0;

  let currentPartnership = {
    batter1Id: '',
    batter2Id: '',
    runs: 0,
    balls: 0,
    batter1Runs: 0,
    batter2Runs: 0
  };

  deliveries.forEach((d, idx) => {
    const sId = d.strikerPlayerId;
    const nsId = d.nonStrikerPlayerId;
    
    if (!bat[sId]) bat[sId] = { id: sId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '' };
    if (nsId && !bat[nsId]) bat[nsId] = { id: nsId, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '' };
    
    if (d.extraType !== 'wide') {
      bat[sId].balls += 1;
      bat[sId].runs += d.runsScored;
      if (d.runsScored === 4) bat[sId].fours += 1;
      if (d.runsScored === 6) bat[sId].sixes += 1;
    }

    currentScore += d.totalRunsOnDelivery;
    if (d.extraType !== 'wide' && d.extraType !== 'noball') currentBalls += 1;

    if (!currentPartnership.batter1Id) {
      currentPartnership.batter1Id = sId;
      currentPartnership.batter2Id = nsId;
    }

    currentPartnership.runs += d.totalRunsOnDelivery;
    if (d.extraType !== 'wide' && d.extraType !== 'noball') currentPartnership.balls += 1;
    if (sId === currentPartnership.batter1Id) {
      currentPartnership.batter1Runs += d.runsScored;
    } else {
      currentPartnership.batter2Runs += d.runsScored;
    }

    if (d.isWicket) {
      currentWickets += 1;
      const outPid = d.batsmanOutPlayerId || sId;
      if (bat[outPid]) {
        bat[outPid].out = true;
        bat[outPid].dismissal = d.dismissalType || 'out';
      }
      
      fow.push({
        wicketNum: currentWickets,
        scoreAtWicket: currentScore,
        overs: `${Math.floor(currentBalls / 6)}.${currentBalls % 6}`,
        playerOutId: outPid,
        playerRuns: bat[outPid]?.runs || 0
      });

      partnerships.push({...currentPartnership});
      currentPartnership = {
        batter1Id: d.batsmanOutPlayerId === currentPartnership.batter1Id ? '' : currentPartnership.batter1Id,
        batter2Id: d.batsmanOutPlayerId === currentPartnership.batter2Id ? '' : currentPartnership.batter2Id,
        runs: 0,
        balls: 0,
        batter1Runs: 0,
        batter2Runs: 0
      };
    }

    if (idx === deliveries.length - 1 && currentPartnership.balls > 0) {
      partnerships.push({...currentPartnership});
    }

    if (!bowl[d.bowlerPlayerId]) bowl[d.bowlerPlayerId] = { id: d.bowlerPlayerId, overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 };
    bowl[d.bowlerPlayerId].runs += d.totalRunsOnDelivery;
    if (d.isWicket && d.dismissalType !== 'runout') bowl[d.bowlerPlayerId].wickets += 1;
    if (d.extraType !== 'wide' && d.extraType !== 'noball') bowl[d.bowlerPlayerId].balls += 1;
  });

  return {
    batting: Object.values(bat),
    bowling: Object.values(bowl).map(b => ({ ...b, oversDisplay: `${Math.floor(b.balls / 6)}.${b.balls % 6}` })),
    fow,
    partnerships
  };
};

export const generateHTMLReport = (match: any, inn1: any, inn2: any, stats1: any, stats2: any, teams: any[], players: any[]) => {
  const getTeam = (id: string) => teams.find(t => t.id === id)?.name || 'Unknown Team';
  const getPlayer = (id: string) => players.find(p => p.id === id)?.name || 'Unknown Player';

  const renderBattingTable = (batting: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 2px;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 1px 2px; text-align: left; font-size: 7px; text-transform: uppercase; color: #475569;">Batter</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">R</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">B</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">4s</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">6s</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">SR</th>
        </tr>
      </thead>
      <tbody>
        ${batting.map(b => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 1px 2px; font-size: 8px; font-weight: 500;">
              ${getPlayer(b.id)} 
              <span style="font-size: 6px; color: #94a3b8; font-weight: normal;">(${b.out ? b.dismissal : 'not out'})</span>
            </td>
            <td style="padding: 1px 2px; text-align: right; font-weight: 700; font-size: 8px;">${b.runs}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 8px; color: #64748b;">${b.balls}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 8px; color: #64748b;">${b.fours}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 8px; color: #64748b;">${b.sixes}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 7px; color: #94a3b8; font-weight: 600;">${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderBowlingTable = (bowling: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 2px;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 1px 2px; text-align: left; font-size: 7px; text-transform: uppercase; color: #475569;">Bowler</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">O</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">M</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">R</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">W</th>
          <th style="padding: 1px 2px; text-align: right; font-size: 7px; text-transform: uppercase; color: #475569;">Econ</th>
        </tr>
      </thead>
      <tbody>
        ${bowling.map(b => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 1px 2px; font-size: 8px; font-weight: 500;">${getPlayer(b.id)}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 8px;">${b.oversDisplay}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 8px;">${b.maidens || 0}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 8px; font-weight: 600;">${b.runs}</td>
            <td style="padding: 1px 2px; text-align: right; font-weight: 700; color: #1e40af; font-size: 8px;">${b.wickets}</td>
            <td style="padding: 1px 2px; text-align: right; font-size: 7px; color: #94a3b8;">${b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderFowSummary = (fow: any[]) => `
    <div style="padding: 3px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 2px; height: 100%;">
      <div style="font-size: 7px; font-weight: 900; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; margin-bottom: 2px; padding-bottom: 1px;">Fall of Wickets</div>
      <div style="font-size: 7px; color: #334155; display: flex; flex-wrap: wrap; gap: 4px;">
        ${fow.map(f => `<span style="white-space: nowrap;"><strong>${f.wicketNum}-${f.scoreAtWicket}</strong> <span style="font-size: 6px; color: #64748b;">(${getPlayer(f.playerOutId).split(' ')[0]} ${f.playerRuns}, ${f.overs})</span></span>`).join('')}
        ${fow.length === 0 ? '<span style="color: #cbd5e1; font-style: italic; font-size: 7px;">None</span>' : ''}
      </div>
    </div>
  `;

  const renderPartnershipsCompact = (partnerships: any[]) => `
    <div style="padding: 3px; border: 1px solid #f1f5f9; border-radius: 2px; height: 100%;">
      <div style="font-size: 7px; font-weight: 900; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; margin-bottom: 2px; padding-bottom: 1px;">Top Partnerships</div>
      <table style="width:100%; border-collapse: collapse;">
        ${partnerships.slice(0, 4).map(p => `
          <tr style="border-bottom: 1px dashed #f1f5f9;">
            <td style="padding: 1px 0; font-size: 7px; color: #475569; width: 35%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${getPlayer(p.batter1Id).split(' ')[0]}</td>
            <td style="padding: 1px 0; text-align: center; font-weight: 800; color: #1e40af; font-size: 8px;">${p.runs}<span style="font-size: 6px; font-weight: 400; color: #94a3b8;">(${p.balls})</span></td>
            <td style="padding: 1px 0; text-align: right; font-size: 7px; color: #475569; width: 35%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${getPlayer(p.batter2Id).split(' ')[0]}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Report - ${getTeam(match.team1Id)} vs ${getTeam(match.team2Id)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; line-height: 1.1; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 4px; background-color: #fff; font-size: 8px; }
        .header { text-align: center; border-bottom: 1.5px solid #1e40af; padding-bottom: 2px; margin-bottom: 4px; }
        h1 { margin: 0; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; font-weight: 900; }
        .match-summary { background: #f8fafc; padding: 4px; border-radius: 3px; border: 1px solid #e2e8f0; margin-bottom: 4px; }
        .inning-bar { background: #1e40af; color: white; padding: 1.5px 4px; font-weight: 900; text-transform: uppercase; font-size: 7px; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
        .inning-sub-bar { background: #475569; color: white; padding: 1.5px 4px; font-weight: 800; text-transform: uppercase; font-size: 7px; margin-top: 1px; }
        .result-text { font-size: 9px; font-weight: 900; color: #1e40af; text-align: center; text-transform: uppercase; margin-top: 2px; border-top: 1px solid #e2e8f0; padding-top: 2px; }
        .toss-small { font-size: 7px; color: #94a3b8; font-weight: 600; text-align: center; margin-top: 1px; }
        .side-by-side { display: flex; gap: 4px; margin: 3px 0; }
        .side-by-side > div { flex: 1; }
        footer { margin-top: 6px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 2px; color: #cbd5e1; font-size: 6px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CRICMATES OFFICIAL SCORECARD</h1>
        <div style="font-weight: 700; color: #94a3b8; font-size: 7px; text-transform: uppercase;">
          ${new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} | ${match.totalOvers} OVERS
        </div>
      </div>
      
      <div class="match-summary">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="text-align: center; flex: 1;">
            <div style="font-weight: 800; font-size: 8px;">${getTeam(match.team1Id)}</div>
            <div style="font-size: 13px; font-weight: 900; color: #1e40af;">${inn1?.score || 0}/${inn1?.wickets || 0}</div>
            <div style="font-size: 7px; color: #64748b; font-weight: 700;">${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver || 0} OV</div>
          </div>
          <div style="font-weight: 900; font-size: 9px; color: #cbd5e1; padding: 0 4px;">VS</div>
          <div style="text-align: center; flex: 1;">
            <div style="font-weight: 800; font-size: 8px;">${getTeam(match.team2Id)}</div>
            <div style="font-size: 13px; font-weight: 900; color: #1e40af;">${inn2?.score || 0}/${inn2?.wickets || 0}</div>
            <div style="font-size: 7px; color: #64748b; font-weight: 700;">${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver || 0} OV</div>
          </div>
        </div>
        <div class="result-text">${match.resultDescription}</div>
        <div class="toss-small">Toss: ${getTeam(match.tossWinnerTeamId)} chose to ${match.tossDecision}</div>
      </div>

      <div class="inning-section">
        <div class="inning-bar">
          <span>1ST INN: ${getTeam(inn1?.battingTeamId)}</span>
          <span>${inn1?.score}/${inn1?.wickets} (${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver})</span>
        </div>
        ${renderBattingTable(stats1.batting)}
        
        <div class="side-by-side">
          <div>${renderFowSummary(stats1.fow)}</div>
          <div>${renderPartnershipsCompact(stats1.partnerships)}</div>
        </div>
        
        <div class="inning-sub-bar">1ST INN BOWLING: ${getTeam(inn1?.bowlingTeamId)}</div>
        ${renderBowlingTable(stats1.bowling)}
      </div>

      <div class="inning-section">
        <div class="inning-bar">
          <span>2ND INN: ${getTeam(inn2?.battingTeamId)}</span>
          <span>${inn2?.score}/${inn2?.wickets} (${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver})</span>
        </div>
        ${renderBattingTable(stats2.batting)}
        
        <div class="side-by-side">
          <div>${renderFowSummary(stats2.fow)}</div>
          <div>${renderPartnershipsCompact(stats2.partnerships)}</div>
        </div>
        
        <div class="inning-sub-bar">2ND INN BOWLING: ${getTeam(inn2?.bowlingTeamId)}</div>
        ${renderBowlingTable(stats2.bowling)}
      </div>

      <footer>
        GENERATED BY CRICMATES SUITE | &copy; ${new Date().getFullYear()}
      </footer>
    </body>
    </html>
  `;
};
