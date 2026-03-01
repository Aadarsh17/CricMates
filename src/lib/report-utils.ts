/**
 * @fileOverview Utility functions for calculating match statistics and generating HTML reports.
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
        score: currentScore,
        overs: `${Math.floor(currentBalls / 6)}.${currentBalls % 6}`,
        playerOutId: outPid
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
    <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
          <th style="padding: 10px; text-align: left;">Batter</th>
          <th style="padding: 10px; text-align: right;">R</th>
          <th style="padding: 10px; text-align: right;">B</th>
          <th style="padding: 10px; text-align: right;">4s</th>
          <th style="padding: 10px; text-align: right;">6s</th>
          <th style="padding: 10px; text-align: right;">SR</th>
        </tr>
      </thead>
      <tbody>
        ${batting.map(b => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${getPlayer(b.id)}<br><small style="color: #888;">${b.out ? b.dismissal : 'not out'}</small></td>
            <td style="padding: 10px; text-align: right; font-weight: bold;">${b.runs}</td>
            <td style="padding: 10px; text-align: right;">${b.balls}</td>
            <td style="padding: 10px; text-align: right;">${b.fours}</td>
            <td style="padding: 10px; text-align: right;">${b.sixes}</td>
            <td style="padding: 10px; text-align: right;">${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const renderBowlingTable = (bowling: any[]) => `
    <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
          <th style="padding: 10px; text-align: left;">Bowler</th>
          <th style="padding: 10px; text-align: right;">O</th>
          <th style="padding: 10px; text-align: right;">M</th>
          <th style="padding: 10px; text-align: right;">R</th>
          <th style="padding: 10px; text-align: right;">W</th>
          <th style="padding: 10px; text-align: right;">Econ</th>
        </tr>
      </thead>
      <tbody>
        ${bowling.map(b => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${getPlayer(b.id)}</td>
            <td style="padding: 10px; text-align: right;">${b.oversDisplay}</td>
            <td style="padding: 10px; text-align: right;">${b.maidens || 0}</td>
            <td style="padding: 10px; text-align: right;">${b.runs}</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: #d9534f;">${b.wickets}</td>
            <td style="padding: 10px; text-align: right;">${b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.00'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Match Report - ${getTeam(match.team1Id)} vs ${getTeam(match.team2Id)}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
        .header { text-align: center; border-bottom: 3px solid #0056b3; padding-bottom: 20px; margin-bottom: 30px; }
        h1 { margin: 0; color: #0056b3; text-transform: uppercase; letter-spacing: 2px; }
        .match-info { background: #f4f7f6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .inning-header { background: #0056b3; color: white; padding: 10px 15px; border-radius: 5px; margin-top: 40px; font-weight: bold; text-transform: uppercase; font-size: 0.9em; }
        .result { font-size: 1.4em; font-weight: bold; color: #d9534f; margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px; }
        table { font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CricMates Match Report</h1>
        <p style="margin: 5px 0; font-weight: bold;">${new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p style="margin: 0; color: #666;">${match.totalOvers} Overs Match</p>
      </div>
      
      <div class="match-info">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="text-align: center; flex: 1;">
            <h2 style="margin:0; color: #0056b3;">${getTeam(match.team1Id)}</h2>
            <h3 style="margin:5px 0; font-size: 1.5em;">${inn1?.score || 0}/${inn1?.wickets || 0}</h3>
            <p style="margin:0; font-size: 0.8em; color: #888;">${inn1?.oversCompleted}.${inn1?.ballsInCurrentOver || 0} Overs</p>
          </div>
          <div style="font-weight: bold; font-size: 1.8em; color: #ccc; padding: 0 20px;">VS</div>
          <div style="text-align: center; flex: 1;">
            <h2 style="margin:0; color: #0056b3;">${getTeam(match.team2Id)}</h2>
            <h3 style="margin:5px 0; font-size: 1.5em;">${inn2?.score || 0}/${inn2?.wickets || 0}</h3>
            <p style="margin:0; font-size: 0.8em; color: #888;">${inn2?.oversCompleted}.${inn2?.ballsInCurrentOver || 0} Overs</p>
          </div>
        </div>
        <div class="result" style="text-align: center;">${match.resultDescription}</div>
        <p style="text-align: center; font-size: 0.85em; color: #666; margin-top: 15px;">
          <strong>Toss:</strong> ${getTeam(match.tossWinnerTeamId)} won and elected to ${match.tossDecision}
        </p>
      </div>

      <div class="inning-header">1st Innings Batting: ${getTeam(inn1?.battingTeamId)}</div>
      ${renderBattingTable(stats1.batting)}
      
      <div class="inning-header">1st Innings Bowling: ${getTeam(inn1?.bowlingTeamId)}</div>
      ${renderBowlingTable(stats1.bowling)}

      <div class="inning-header">2nd Innings Batting: ${getTeam(inn2?.battingTeamId)}</div>
      ${renderBattingTable(stats2.batting)}
      
      <div class="inning-header">2nd Innings Bowling: ${getTeam(inn2?.bowlingTeamId)}</div>
      ${renderBowlingTable(stats2.bowling)}

      <footer style="margin-top: 50px; text-align: center; border-top: 1px solid #eee; padding-top: 20px; color: #aaa; font-size: 0.75em;">
        <p>This report was generated automatically by CricMates Professional Scoring Suite.</p>
        <p>&copy; ${new Date().getFullYear()} CricMates. All Rights Reserved.</p>
      </footer>
    </body>
    </html>
  `;
};
