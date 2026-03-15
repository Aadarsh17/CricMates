
# CricMates Pro League - Security & Deployment

This project is a high-fidelity cricket scoring and analytics engine built with Next.js 15 and Firebase.

## 🛡️ Security Architecture

### 1. Official Access Control (The "Gumrah" Strategy)
To maintain professional integrity, only **Verified Officials** can modify match data. 
- **The Key**: `CRICPRO77`
- **Logic**: During Registration or Login, there is an **"Official Access Key (Optional)"** field. 
- **Verification**: If a user enters the correct key, they are granted `isVerified: true` status. If they leave it blank or enter a wrong key, they stay "Unverified" and can only view data (Read-Only).

### 2. Firebase API Keys
The keys in `src/firebase/config.ts` are **intended to be public**. Real security is enforced via **Firestore Security Rules** which check for the `isVerified` flag on the user's profile.

### 3. Genkit AI Keys
Keys like `GEMINI_API_KEY` are **Secrets**. They are stored in `.env` and must be added manually to Vercel/App Hosting environment variables.

---

## 🚀 Deployment & GitHub Guide

### 1. Initial Push
```bash
git init
git add .
git commit -m "Initial commit: Professional Engine"
git branch -M main
git remote add origin https://github.com/Aadarsh17/CricMates.git
git push -u origin main
```

### 2. Troubleshooting "Authentication Failed"
If you get a credential error during `git push`, follow these steps:
1. Go to GitHub **Settings** > **Developer Settings** > **Personal Access Tokens** > **Tokens (classic)**.
2. Generate a token with the **'repo'** scope and copy it.
3. Run this command in your terminal:
   `git remote set-url origin https://YOUR_TOKEN_HERE@github.com/Aadarsh17/CricMates.git`
4. Try `git push origin main` again.

---

## 🔑 Required Environment Variables (Add to Vercel)
1. **`GEMINI_API_KEY`**: Your Google AI Studio API Key for Match Summaries.
2. **`GOOGLE_GENAI_API_KEY`**: Same as above.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Database**: Firebase Firestore
- **Auth**: Firebase Auth
- **AI**: Genkit (Gemini 2.5 Flash)
- **UI**: ShadCN + Tailwind CSS
