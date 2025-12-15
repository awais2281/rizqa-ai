# GitHub Setup Instructions

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `rizqa-ai` (or any name you prefer)
3. Choose **Private** (recommended) or **Public**
4. **DO NOT** check "Initialize with README"
5. Click **"Create repository"**

## Step 2: Connect Your Local Repo

After creating the repo, GitHub will show you commands. Use these:

```bash
# Replace YOUR_USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR_USERNAME/rizqa-ai.git
git branch -M main
git push -u origin main
```

**Or if you prefer SSH:**
```bash
git remote add origin git@github.com:YOUR_USERNAME/rizqa-ai.git
git branch -M main
git push -u origin main
```

## Step 3: Push Your Code

Run these commands in your project folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/rizqa-ai.git
git branch -M main
git push -u origin main
```

**Note:** You'll be prompted for your GitHub username and password (or token).

## Step 4: Deploy to Railway

Once your code is on GitHub:

1. Go to Railway: https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway (if first time)
5. Select your repository: `rizqa-ai`
6. Click **"Deploy Now"**

Done! 🎉

