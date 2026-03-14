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

---

## 🚀 How to Upload to GitHub & Deploy

Follow these steps to host your code on GitHub and get it live:

1. **Create a GitHub Repository:**
   - Go to [github.com](https://github.com) and create a new repository (e.g., `cricmates-pro`).
   - **Do not** initialize with a README, license, or gitignore (you already have them).

2. **Push Code to GitHub:**
   Open your terminal in this project folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: CricMates Pro League Complete"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

3. **Deploy to Vercel (Recommended):**
   - Go to [Vercel.com](https://vercel.com).
   - Click **"Add New"** > **"Project"**.
   - Import your GitHub repository.
   - Vercel will auto-detect Next.js. Click **Deploy**.
   - Once deployed, your site will be live!

4. **Firebase Configuration:**
   - Ensure your Firebase project has **Authentication** (Email/Password) and **Cloud Firestore** enabled in the [Firebase Console](https://console.firebase.google.com).

---

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Firebase Firestore (Real-time)
- **Authentication:** Firebase Auth (Umpire Security)
- **Styling:** Tailwind CSS + Shadcn UI
- **AI:** Genkit (Performance Summaries)
