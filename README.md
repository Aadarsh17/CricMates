# CricMates Pro League - Advanced Architecture

This project is a high-fidelity cricket scoring and analytics engine built with Next.js 15 and Firebase.

## Core Architectural Pillars

### 1. Atomic Data Integrity
The system treats every delivery (ball) as the primary unit of data. All statistics, including Runs, Wickets, NRR, and Player CVP, are derived directly from the ball-by-ball delivery logs. This ensures that deleting or undoing a ball correctly recalculates the entire match state.

### 2. Unified Statistical Engine
- **Net Run Rate (NRR):** Calculated using the official formula: `(Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)`.
- **Cricket Value Points (CVP) v1.2.5:** A comprehensive impact scoring system that rewards batting strike rates, bowling economy, and fielding dismissals.
- **Milestone Detection:** An automated scanner that identifies Fastest 30s, Hat-tricks, and Match-Winning Knocks by traversing historical delivery records.

### 3. Professional Umpire Controls
- **Over Enforcement:** Strictly follows the 0.1 to 0.6 notation.
- **Validation:** Prevents active batters from being assigned as bowlers.
- **Forced Over Changes:** Clears the current bowler after 6 legal deliveries, ensuring valid league officiating.

### 4. High-Fidelity UI
- **Broadcast Aesthetics:** Uses a specialized color palette (#3f51b5 Indigo / #009688 Teal) to mirror professional sports interfaces.
- **Mobile-First Design:** High-density data tables optimized for mobile screens with `pt-20` layout padding to prevent navbar overlap.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Firebase Firestore (Real-time)
- **Authentication:** Firebase Auth (Umpire Security)
- **Styling:** Tailwind CSS + Shadcn UI
- **AI:** Genkit (Performance Summaries)
