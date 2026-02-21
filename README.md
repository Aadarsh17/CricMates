# CricMates - The Ultimate Cricket Scoring Companion 🏏

CricMates is a powerful, mobile-optimized cricket scoring and league management application. Built with Next.js, Firebase, and Tailwind CSS.

## 🚀 Key Features
- **Custom Branding**: Upload league and team logos that sync via Firestore.
- **Advanced Stats**: T4-T20 formats, 30s/50s/100s milestones, and detailed Bowling/Duck tracking.
- **Live Scoring**: Interactive umpire controls with undo and HTML report downloads.

## 🛠 Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: Firebase (Firestore & Anonymous Auth)
- **Styling**: Tailwind CSS & ShadCN UI

## 📤 GitHub & Deployment Guide

### 1. Update GitHub (Badlav Update Karein)
Jab bhi aap app mein naya kaam karein:
```bash
git add .
git commit -m "Description of changes"
git push
```

### 2. Vercel Deployment Tips
Agar Vercel par "No Next.js version detected" error aaye:
1. **Root Directory**: Vercel Dashboard mein 'Settings' > 'General' par jayein. Check karein ki 'Root Directory' sahi folder par set hai (agar aapne files kisi subfolder mein rakhi hain).
2. **Framework Preset**: Ise "Next.js" par set karein.
3. **Build Command**: Ise default (`next build`) par rehne dein.

---
*Generated with ❤️ by Firebase Studio*