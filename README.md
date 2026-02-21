# CricMates - The Ultimate Cricket Scoring Companion 🏏

CricMates is a powerful, mobile-optimized cricket scoring and league management application. Built with Next.js, Firebase, and Tailwind CSS, it provides a seamless experience for local tournaments and variations like the "Number Game".

## 🚀 Key Features

- **Custom League Branding**: Upload and adjust your own league logo that syncs across all devices via Firestore.
- **Advanced Player Statistics**: Detailed batting and bowling metrics including 30s, 50s, 100s, and a full breakdown of Ducks (Regular, Golden, Diamond).
- **Comprehensive Team Management**: Manage squads with player photos, historical match participation tracking, and dynamic form guides.
- **Live Scoring & Full Scorecards**: Interactive scorer for umpires with undo functionality and downloadable HTML match reports.
- **Performance Optimized**: Smooth page transitions and GPU-accelerated UI for a lag-free experience on both Desktop and Mobile.
- **Number Game Mode**: A specialized digital scorer for local cricket variations with aggregated career statistics.

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database & Auth**: Firebase (Firestore & Anonymous Auth)
- **Styling**: Tailwind CSS & ShadCN UI
- **Icons**: Lucide React
- **Charts**: Recharts

## 📈 Stats Calculation (CVP)
The app uses a proprietary **Cricket Value Points (CVP)** system to determine the Player of the Match, rewarding consistency, strike rate, and fielding impact.

## 📤 GitHub Guide

### 1. First Time Setup (Pehli Baar)
Agar aapne abhi tak repo connect nahi kiya hai:
1. GitHub par naya repository banayein.
2. Terminal mein ye commands chalayein:
```bash
git init
git add .
git commit -m "Initial commit - Final Version"
git branch -M main
git remote add origin <APKA_GITHUB_REPO_URL>
git push -u origin main
```

### 2. How to Update Changes (Badlav Update Karein)
Jab bhi aap app mein naya kaam karein aur GitHub par bhejna ho:
1. **Stage**: `git add .`
2. **Commit**: `git commit -m "Update ka message yahan likhein"`
3. **Push**: `git push`

---
*Generated with ❤️ by Firebase Studio*
