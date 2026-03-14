
# CricMates Pro League - Security & Deployment

This project is a high-fidelity cricket scoring and analytics engine built with Next.js 15 and Firebase.

## 🛡️ Security Architecture (How keys are secured)

### 1. Firebase API Keys (Public)
The keys in `src/firebase/config.ts` are **intended to be public**. They only identify your project. Real security is handled via **Firestore Security Rules** (located in `firestore.rules`), which ensure only authenticated **Verified Umpires** can modify data.

**Recommendation:** Go to [Google Cloud Console](https://console.cloud.google.com/), edit your API Key, and add **Website Restrictions** to allow only your production domain (e.g., `*.vercel.app`).

### 2. Official Access Control
To prevent unauthorized scoring, new Umpires must provide the **Official League Key** during registration. 
- **Default Key:** `CRICPRO77`
- Users without this key will remain "Unverified" and cannot modify match data.

### 3. Genkit AI Keys (Secret)
Keys like `GEMINI_API_KEY` are **Secrets**. They must NEVER be pushed to GitHub.
- They are stored in `.env` (which is ignored by git).
- You must manually add them to your deployment platform (Vercel/Firebase App Hosting) Environment Variables section.

---

## 🔑 Required Environment Variables

Add these to Vercel/App Hosting:
1. **`GEMINI_API_KEY`**: Your Google AI Studio API Key.
2. **`GOOGLE_GENAI_API_KEY`**: Same as above.

---

## 🚀 Deployment Guide

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: Professional Engine"
git branch -M main
git remote add origin <YOUR_GITHUB_URL>
git push -u origin main
```

### 2. Link to Vercel
- Import repo.
- Add `GEMINI_API_KEY`.
- Deploy.

### 3. Firebase Setup
- Enable **Firestore** in Production Mode.
- Enable **Authentication** (Email/Password).
- Deploy rules: `firebase deploy --only firestore:rules`.
