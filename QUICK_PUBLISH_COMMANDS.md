# 🚀 Quick Publish Commands - Copy & Paste

## Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

## Step 2: Login
```bash
eas login
```

## Step 3: Build Android (for Google Play Store)
```bash
eas build --platform android --profile production
```

## Step 4: Build iOS (for App Store)
```bash
eas build --platform ios --profile production
```

## Step 5: Submit Android to Play Store
```bash
eas submit --platform android
```

## Step 6: Submit iOS to App Store
```bash
eas submit --platform ios
```

## Check Build Status
```bash
eas build:list
```

---

## 🎯 Build Both at Once (Optional)
```bash
eas build --platform all --profile production
```

---

## 📋 What You'll Need:

### For Google Play Store:
- Google Play Developer account ($25 one-time)
- App screenshots
- App description
- Privacy Policy URL (you have one)

### For Apple App Store:
- Apple Developer account ($99/year)
- App screenshots (multiple sizes)
- App description
- Privacy Policy URL (you have one)

---

**That's it! Run these commands in order. 🎉**

