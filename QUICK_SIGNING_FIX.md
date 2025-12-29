# Quick Fix: Android Signing Key - Action Items

## ✅ Already Fixed
- Package name: `com.rizqaai.app` (matches Play Console)

## 🎯 What You Need to Do

### Step 1: Check Current EAS Credentials

**Run this command in your terminal:**
```bash
eas credentials --platform android
```

This will show you what keystore EAS is currently using. You'll see options like:
- View existing credentials
- Set up a new Android Keystore
- Update existing credentials

### Step 2: Upload Correct Keystore to EAS

**If you have the original `.jks` or `.keystore` file:**

1. Run: `eas credentials --platform android`
2. Select: **"Set up a new Android Keystore"** or **"Update existing credentials"**
3. Choose: **"Upload a keystore"**
4. Provide:
   - Keystore file path (e.g., `C:\path\to\your-keystore.jks`)
   - Keystore alias (usually `upload` or `key0`)
   - Keystore password
   - Key password (may be same as keystore password)

**If you DON'T have the keystore file:**

1. Go to [Google Play Console](https://play.google.com/console)
2. Your App → **Release** → **Setup** → **App signing**
3. Scroll to **"Upload key certificate"**
4. Download the certificate (`.pem` file)
5. **Note:** You'll need the private key to create a keystore. If you only have the certificate:
   - Contact your team for the original keystore, OR
   - Request **"Upload key reset"** in Play Console (takes 24-48 hours)

### Step 3: Rebuild

After configuring the correct keystore:

```bash
eas build --platform android --profile production
```

### Step 4: Verify Before Upload

**Download the AAB from EAS build page, then verify:**

**Option A: Using PowerShell script (Windows)**
```powershell
.\verify-aab.ps1 your-app.aab
```

**Option B: Using keytool (if you have the keystore)**
```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```
Look for SHA1: `04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6`

**Option C: Using bundletool + apksigner**
```bash
# Extract APK from AAB
java -jar bundletool.jar build-apks --bundle=your-app.aab --output=app.apks --mode=universal
unzip app.apks universal.apk

# Verify
apksigner verify --print-certs universal.apk
```

## 📋 Expected Values

- **SHA1:** `04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6`
- **Package:** `com.rizqaai.app`
- **Version Code:** 3

## 🔍 Current Issue

Your last build had SHA1: `17:C0:79:81:CC:63:CF:D6:72:F0:44:EC:4E:B5:CD:AC:26:28:38:80`

This means EAS generated a new keystore instead of using the one Google Play expects.

## 💡 Quick Decision Tree

```
Do you have the original .jks/.keystore file?
├─ YES → Upload it to EAS using: eas credentials --platform android
└─ NO → Do you have access to Google Play Console?
    ├─ YES → Request "Upload key reset" (24-48 hours)
    └─ NO → Contact your team for the keystore file
```

## 📚 Full Documentation

See `FIX_SIGNING_KEY_STEP_BY_STEP.md` for detailed instructions and troubleshooting.

