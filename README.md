# CricMates Pro League - Advanced Architecture

This project is a high-fidelity cricket scoring and analytics engine built with Next.js 15 and Firebase.

## 🔑 Environment Variables (Deployment)

To make the AI features work (Match Summaries & Performance Intel), you MUST add these variables in your deployment platform (Vercel/Firebase App Hosting):

1. **`GEMINI_API_KEY`**: Get this from [Google AI Studio](https://aistudio.google.com/).
2. **`GOOGLE_GENAI_API_KEY`**: Same key as above.

---

## 🛡️ Security & GitHub Alerts

If GitHub sends you a "Secret detected" alert for the **Firebase API Key** in `src/firebase/config.ts`:
- **This is a False Positive.**
- Firebase API keys are designed to be public.
- Your data is secured via **Firestore Security Rules**.
- You can safely **Dismiss** the alert on GitHub as a "False Positive".

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
# REPLACE <YOUR_GITHUB_URL> with the URL from your new repo
git remote add origin <YOUR_GITHUB_URL>

# Push the code to GitHub
git push -u origin main
```

### 3. Deploy to Vercel (Fastest)
- Go to [Vercel.com](https://vercel.com).
- Sign in with GitHub.
- Click **"Add New"** > **"Project"**.
- Import your `cricmates-pro` repository.
- **Environment Variables**: In the "Environment Variables" section during setup, add:
  - Key: `GEMINI_API_KEY` | Value: `[Your Key]`
- Click **Deploy**.

---

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Firebase Firestore (Real-time)
- **Authentication:** Firebase Auth (Umpire Security)
- **Styling:** Tailwind CSS + Shadcn UI
- **AI:** Genkit (Performance Summaries)
