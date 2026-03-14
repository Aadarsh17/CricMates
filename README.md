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

### 1. Create a GitHub Repository
- Go to [github.com](https://github.com) and log in.
- Click the **"+"** icon in the top-right corner and select **"New repository"**.
- Name it (e.g., `cricmates-pro`).
- Set it to **Public** or **Private**.
- **Important:** Do not check "Initialize this repository with a README, .gitignore, or license" (since you already have them).
- Click **"Create repository"**.

### 2. Push Code to GitHub
Open your terminal (Command Prompt, PowerShell, or Terminal) in this project's root folder and run these commands one by one:

```bash
# Initialize git
git init

# Add all files to the staging area
git add .

# Commit the files
git commit -m "Initial commit: Professional Cricket Engine"

# Rename branch to main
git branch -M main

# Link to your GitHub repository
# REPLACE <YOUR_GITHUB_URL> with the URL from your new repo (e.g. https://github.com/username/cricmates-pro.git)
git remote add origin <YOUR_GITHUB_URL>

# Push the code to GitHub
git push -u origin main
```

### 3. Deploy to Vercel (Fastest)
- Go to [Vercel.com](https://vercel.com).
- Sign in with GitHub.
- Click **"Add New"** > **"Project"**.
- Import your `cricmates-pro` repository.
- Vercel will auto-detect Next.js settings. 
- **Add Environment Variables**: If you have `GEMINI_API_KEY` or other keys, add them in the project settings on Vercel.
- Click **Deploy**.

---

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Firebase Firestore (Real-time)
- **Authentication:** Firebase Auth (Umpire Security)
- **Styling:** Tailwind CSS + Shadcn UI
- **AI:** Genkit (Performance Summaries)
