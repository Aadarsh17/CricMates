/**
 * @fileOverview Utility functions for calculating match statistics and generating professional HTML reports.
 * Refined for high-density information display and minimal whitespace.
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

    if (!bowl[d.bowlerPlayerId]) bowl[d.bowlerPlayerId] = { id: d.bowlerPlayerId, overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 };
    bowl[d.bowlerPlayerId].runs += d.totalRunsOnDelivery;
    if (d.isWicket && d.dismissalType !== 'runout') bowl[d.bowlerPlayerId].wickets += 1;
    if (d.extraType !== 'wide' && d.extraType !== 'noball') bowl[d.bowlerPlayerId].balls += 1;

    if (idx === deliveries.length - 1 && currentPartnership.balls > 0) {
      partnerships.push({...currentPartnership});
    }
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
    <table style="width:100%; border-collapse: collapse; margin-bottom: 6px;">
      <thead>
        <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 4px 6px; text-align: left; font-size: 9px; text-transform: uppercase; color: #64748b;">Batter</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">R</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">B</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">4s</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">6s</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">SR</th>
        </tr>
      </thead>
      <tbody>
        ${batting.map(b => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 4px 6px; font-size: 11px; font-weight: 500;">
              ${getPlayer(b.id)} 
              <span style="font-size: 8px; color: #94a3b8; font-weight: normal; margin-left: 2px;">(${b.out ? b.dismissal : 'not out'})</span>
            </td>
            <td style="padding: 4px 6px; text-align: right; font-weight: 700; font-size: 11px;">${b.runs}</td>
            <td style="padding: 4px 6px; text-align: right; font-size: 11px; color: #64748b;">${b.balls}</td>
            <td style="padding: 4px 6px; text-align: right; font-size: 11px; color: #64748b;">${b.fours}</td>
            <td style="padding: 4px 6px; text-align: right; font-size: 11px; color: #64748b;">${b.sixes}</td>
            <td style="padding: 4px 6px; text-align: right; font-size: 10px; color: #94a3b8; font-weight: 600;">${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderBowlingTable = (bowling: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 6px;">
      <thead>
        <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <th style="padding: 4px 6px; text-align: left; font-size: 9px; text-transform: uppercase; color: #64748b;">Bowler</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">O</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">M</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">R</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">W</th>
          <th style="padding: 4px 6px; text-align: right; font-size: 9px; text-transform: uppercase; color: #64748b;">Econ</th>
        </tr>
      </thead>
      <tbody>
        ${bowling.map(b => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 4px 6px; font-size: 11px; font-weight: 500;">${getPlayer(b.id)}</td>
            <td style="padding: 4px 6px; text-align: right; font-size: 11px;">${b.oversDisplay}</td>
            <td style="padding: 4px 6px; text-align: right; font-size: 11px;">${b.maidens || 0}</td>
            <td style="padding: 4px 6px; text-align: right; font-size: 11px; font-weight: 600;">${b.runs}</td>
            <td style="padding: 4px 6px; text-align: right; font-weight: 700; color: #1e40af; font-size: 11px;">${b.wickets}</td>
            <td style="padding: 4px 6px; text-align: right; font-size: 10px; color: #94a3b8;">${b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderFowTable = (fow: any[]) => `
    <div style="margin-bottom: 6px; padding: 6px; background: #fdfdfd; border-radius: 4px; border: 1px solid #f1f5f9;">
      <h4 style="font-size: 8px; text-transform: uppercase; color: #94a3b8; margin: 0 0 4px 0; letter-spacing: 0.5px; font-weight: 800;">Fall of Wickets</h4>
      <div style="font-size: 10px; color: #334155; line-height: 1.4;">
        ${fow.map(f => `<span style="display: inline-block; margin-right: 8px;"><strong>${f.wicketNum}-${f.scoreAtWicket}</strong> (${getPlayer(f.playerOutId)} ${f.playerRuns}, ${f.overs} ov)</span>`).join('')}
        ${fow.length === 0 ? '<span style="color: #cbd5e1; font-style: italic;">No wickets fallen</span>' : ''}
      </div>
    </div>
  `;

  const renderPartnershipsTable = (partnerships: any[]) => `
    <div style="margin-bottom: 10px; padding: 6px; border: 1px solid #f1f5f9; border-radius: 4px;">
      <h4 style="font-size: 8px; text-transform: uppercase; color: #94a3b8; margin: 0 0 4px 0; letter-spacing: 0.5px; font-weight: 800;">Top Partnerships</h4>
      <table style="width:100%; border-collapse: collapse;">
        ${partnerships.map(p => `
          <tr style="border-bottom: 1px dashed #f1f5f9;">
            <td style="padding: 2px 0; font-size: 10px; width: 35%; color: #475569;">${getPlayer(p.batter1Id)} <span style="font-weight: 700; color: #1e293b;">${p.batter1Runs}</span></td>
            <td style="padding: 2px 0; text-align: center; font-weight: 800; color: #1e40af; font-size: 11px;">${p.runs} <span style="font-weight: 400; font-size: 8px; color: #94a3b8;">(${p.balls}b)</span></td>
            <td style="padding: 2px 0; text-align: right; font-size: 10px; width: 35%; color: #475569;"><span style="font-weight: 700; color: #1e293b;">${p.batter2Runs}</span> ${getPlayer(p.batter2Id)}</td>
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
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.2; color: #1e293b; max-width: 650px; margin: 0 auto; padding: 10px; background-color: #fff; font-size: 11px; }
        .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 6px; margin-bottom: 10px; }
        h1 { margin: 0; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; font-size: 16px; font-weight: 900; }
        .match-card { background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e2e8f0; }
        .inning-header { background: #1e40af; color: white; padding: 4px 8px; border-radius: 3px; margin: 12px 0 6px 0; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center; }
        .result-bar { font-size: 13px; font-weight: 900; color: #1e40af; margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px; text-transform: uppercase; text-align: center; }
        .team-score-title { font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 2px; }
        .team-score-value { font-size: 20px; font-weight: 900; color: #1e40af; }
        .toss-info { font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-top: 4px; text-align: center; }
        footer { margin-top: 20px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 8px; color: #cbd5e1; font-size: 8px; }
        @media print { body { padding: 0; margin: 0; } .match-card { border: 1px solid #e2e8f0; } .inning-section { page-break-inside: avoid; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CRICMATES OFFICIAL SCORECARD</h1>
        <div style="font-weight: 700; color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-top: 2px;">
          ${new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} | ${match.totalOvers} OVERS MATCH
        </div>
      </div>
      
      <div class="match-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="text-align: center; flex: 1;">
            <div class="team-score-title">${getTeam(match.team1Id)}</div>
            <div class="team-score-value">${inn1?.score || 0}/${inn1?.wickets || 0}</div>
            <div style="font-size: 9px; color: #64748b; font-weight: 700;">${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver || 0} OV</div>
          </div>
          <div style="font-weight: 900; font-size: 12px; color: #e2e8f0; padding: 0 10px;">VS</div>
          <div style="text-align: center; flex: 1;">
            <div class="team-score-title">${getTeam(match.team2Id)}</div>
            <div class="team-score-value">${inn2?.score || 0}/${inn2?.wickets || 0}</div>
            <div style="font-size: 9px; color: #64748b; font-weight: 700;">${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver || 0} OV</div>
          </div>
        </div>
        <div class="result-bar">${match.resultDescription}</div>
        <div class="toss-info">Toss: ${getTeam(match.tossWinnerTeamId)} chose to ${match.tossDecision}</div>
      </div>

      <div class="inning-section">
        <div class="inning-header">
          <span>1ST INN: ${getTeam(inn1?.battingTeamId)}</span>
          <span>${inn1?.score}/${inn1?.wickets} (${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver})</span>
        </div>
        ${renderBattingTable(stats1.batting)}
        ${renderFowTable(stats1.fow)}
        
        <div class="inning-header" style="background: #334155;">1ST INN BOWLING: ${getTeam(inn1?.bowlingTeamId)}</div>
        ${renderBowlingTable(stats1.bowling)}
      </div>

      <div class="inning-section" style="margin-top: 10px;">
        <div class="inning-header">
          <span>2ND INN: ${getTeam(inn2?.battingTeamId)}</span>
          <span>${inn2?.score}/${inn2?.wickets} (${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver})</span>
        </div>
        ${renderBattingTable(stats2.batting)}
        ${renderFowTable(stats2.fow)}
        ${renderPartnershipsTable(stats2.partnerships)}
        
        <div class="inning-header" style="background: #334155;">2ND INN BOWLING: ${getTeam(inn2?.bowlingTeamId)}</div>
        ${renderBowlingTable(stats2.bowling)}
      </div>

      <footer>
        <p style="font-weight: 700; margin: 0;">Generated by CricMates Suite | &copy; ${new Date().getFullYear()}</p>
      </footer>
    </body>
    </html>
  `;
};
