# 🚀 Rizqa AI - Publishing Guide

Complete step-by-step guide to publish your app to the App Store and Google Play Store.

---

## 📋 Prerequisites Checklist

Before you start, make sure you have:

- [ ] **Expo account** (sign up at https://expo.dev if you don't have one)
- [ ] **Apple Developer Account** ($99/year) - for iOS App Store
- [ ] **Google Play Developer Account** ($25 one-time) - for Google Play Store
- [ ] **App Store Connect** access set up
- [ ] **Google Play Console** access set up
- [ ] **App icon** ready (you have: `./design/Untitled design.png`)
- [ ] **Screenshots** for app stores (optional but recommended)

---

## 🔧 Step 1: Install EAS CLI

Open your terminal and run:

```bash
npm install -g eas-cli
```

---

## 🔐 Step 2: Login to EAS

```bash
eas login
```

This will open a browser window. Log in with your Expo account.

---

## ✅ Step 3: Configure Your Project

Run this command to configure EAS for your project:

```bash
eas build:configure
```

This will update your `eas.json` file (already done, but good to verify).

---

## 🤖 Step 4: Build for Android

### Option A: Build APK (for testing/distribution outside Play Store)

```bash
eas build --platform android --profile preview
```

### Option B: Build AAB (for Google Play Store - REQUIRED)

```bash
eas build --platform android --profile production
```

**Copy this command ↑** - This is what you need for Play Store!

---

## 🍎 Step 5: Build for iOS

### Option A: Build for Testing (TestFlight)

```bash
eas build --platform ios --profile preview
```

### Option B: Build for App Store (Production)

```bash
eas build --platform ios --profile production
```

**Copy this command ↑** - This is what you need for App Store!

---

## 📦 Step 6: Submit to App Stores

### For Android (Google Play Store):

After your Android build completes, submit it:

```bash
eas submit --platform android
```

You'll need:
- Google Play Console account
- Service account JSON key (EAS will guide you)

### For iOS (App Store):

After your iOS build completes, submit it:

```bash
eas submit --platform ios
```

You'll need:
- Apple Developer account
- App Store Connect API key (EAS will guide you)

---

## 🎯 Quick Start (All-in-One Commands)

### Build Both Platforms for Production:

```bash
# Build Android for Play Store
eas build --platform android --profile production

# Build iOS for App Store  
eas build --platform ios --profile production
```

### Submit Both to Stores:

```bash
# Submit Android
eas submit --platform android

# Submit iOS
eas submit --platform ios
```

---

## 📱 App Store Requirements

### For Google Play Store:

1. **App Listing:**
   - App name: "Rizqa AI"
   - Short description (80 chars max)
   - Full description
   - Screenshots (at least 2)
   - App icon (1024x1024)
   - Feature graphic (1024x500)

2. **Content Rating:** Complete the questionnaire
3. **Privacy Policy:** You have one at `rizqahelpteam@gmail.com`
4. **Target Audience:** Set age rating

### For Apple App Store:

1. **App Information:**
   - App name: "Rizqa AI"
   - Subtitle
   - Description
   - Keywords
   - Support URL
   - Marketing URL (optional)

2. **Screenshots:** Required for all device sizes
3. **App Icon:** 1024x1024 PNG
4. **Privacy Policy:** Required (you have one)
5. **Age Rating:** Complete questionnaire

---

## 🔍 Check Build Status

To see your build progress:

```bash
eas build:list
```

Or check online at: https://expo.dev/accounts/mufctt/projects/rizqa-ai/builds

---

## ⚙️ Current Configuration

Your app is configured with:
- **Bundle ID (iOS):** `com.rizqaai.app`
- **Package (Android):** `com.rizqaai.app`
- **Version:** `1.0.0`
- **Project ID:** `7eebecfa-d4ee-4b31-ba3f-a2687706c931`
- **Owner:** `mufctt`

---

## 🐛 Troubleshooting

### Build Fails?

1. Check build logs: `eas build:list` then click on the build
2. Verify `app.json` is correct
3. Make sure all dependencies are in `package.json`

### Can't Submit?

1. Make sure build status is "finished"
2. Verify you have the required accounts (Apple/Google)
3. Check that your app listing is complete in the store consoles

---

## 📞 Support

If you encounter issues:
- Check EAS docs: https://docs.expo.dev/build/introduction/
- Expo Discord: https://chat.expo.dev
- Your support email: rizqahelpteam@gmail.com

---

## ✅ Final Checklist Before Publishing

- [ ] App icon is set (`./design/Untitled design.png`)
- [ ] Version number is correct (`1.0.0` in `app.json`)
- [ ] All features tested
- [ ] Privacy Policy accessible
- [ ] Terms of Service accessible
- [ ] Supabase backend is live
- [ ] Whisper server is live (`https://rizqa-ai-production.up.railway.app`)
- [ ] Screenshots prepared for app stores
- [ ] App descriptions written
- [ ] Build commands ready to run

---

**Ready? Start with Step 1 and work your way through! 🚀**

