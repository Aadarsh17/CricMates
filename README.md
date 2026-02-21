# CricMates - The Ultimate Cricket Scoring Companion 🏏

CricMates is a powerful, mobile-optimized cricket scoring and league management application. Built with Next.js, Firebase, and Tailwind CSS.

## 📤 GitHub & Deployment Guide

### 1. First Time Setup (Pehli Baar Push Karein)
Terminal mein ye commands chalayein:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 2. Update GitHub (Badlav Update Karein)
Jab bhi aap app mein naya kaam karein:
```bash
git add .
git commit -m "Description of changes"
git push
```

### 3. Vercel Deployment Tips
Agar Vercel par "No Next.js version detected" error aaye:
1. **Root Directory**: Vercel Dashboard mein 'Settings' > 'General' par jayein. Check karein ki 'Root Directory' sahi folder par set hai (agar aapne files kisi subfolder mein rakhi hain).
2. **Framework Preset**: Ise "Next.js" par set karein.
3. **Build Command**: Ise default (`next build`) par rehne dein.
4. **Node.js**: Vercel settings mein Node.js version 20 ya 22 select karein.

---
*Generated with ❤️ by Firebase Studio*