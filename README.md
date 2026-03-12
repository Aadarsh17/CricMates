# CricMates Pro League - Advanced Architecture

This project is a high-fidelity cricket scoring and analytics engine built with Next.js 15 and Firebase.

## Core Architectural Pillars

### 1. Atomic Data Integrity
The system treats every delivery (ball) as the primary unit of data. All statistics, including Runs, Wickets, NRR, and Player CVP, are derived directly from the ball-by-ball delivery logs. This ensures that deleting or undoing a ball correctly recalculates the entire match state.

### 2. Unified Statistical Engine
- **Net Run Rate (NRR):** Calculated using the official formula: `(Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)`.
- **Cricket Value Points (CVP) v1.2.5:** A comprehensive impact scoring system that rewards batting strike rates, bowling economy, and fielding dismissals.
- **Milestone Detection:** An automated scanner that identifies achievements by traversing historical delivery records.

### 3. Professional Umpire Controls
- **Over Enforcement:** Strictly follows the 0.1 to 0.6 notation.
- **Validation:** Prevents active batters from being assigned as bowlers.
- **Mid-Match Registration:** Allows adding players directly from the scoreboard.

## Deployment & Future Updates (Vercel)

If you have deployed this project on **Vercel**, follow these steps to update features in the future:

1. **Ask for Changes:** Talk to this AI to generate new features or fixes.
2. **Apply Code:** Once the AI provides the `<changes>` XML block, the code is updated in your workspace.
3. **Push to Git:** Commit and Push these changes to your linked GitHub/GitLab repository.
4. **Auto-Deploy:** Vercel will automatically detect the changes and trigger a new build. Your live site will be updated in minutes.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Firebase Firestore (Real-time)
- **Authentication:** Firebase Auth (Umpire Security)
- **Styling:** Tailwind CSS + Shadcn UI
- **AI:** Genkit (Performance Summaries)
