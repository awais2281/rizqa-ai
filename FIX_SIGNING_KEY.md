# Fix Android Signing Key Mismatch

## Problem
Google Play expects upload key with SHA1: `04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6`
But EAS built with SHA1: `17:C0:79:81:CC:63:CF:D6:72:F0:44:EC:4E:B5:CD:AC:26:28:38:80`

## Solution: Use Existing Upload Key from Google Play

### Step 1: Download Upload Key from Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to **Release** → **Setup** → **App signing**
4. Scroll down to **App signing key certificate** section
5. Find **Upload key certificate** section
6. Click **Download** to get the upload key certificate (`.pem` file)
7. Also download the upload key keystore if available (or you may need to generate it from the certificate)

### Step 2: Configure EAS to Use the Upload Key

You have two options:

#### Option A: Use Keystore File (Recommended)

If you have the keystore file (`.jks` or `.keystore`):

```bash
# Configure EAS to use your existing keystore
eas credentials --platform android
# Select: "Set up a new Android Keystore"
# Choose: "Upload a keystore"
# Provide the keystore file path, alias, and passwords
```

#### Option B: Generate Keystore from Certificate

If you only have the certificate (`.pem`), you'll need to:

1. Convert the certificate to a keystore (requires the private key)
2. Or contact Google Play support to reset the upload key

### Step 3: Alternative - Reset Upload Key in Google Play

If you don't have access to the original upload key:

1. Go to Google Play Console → Your App → **Release** → **Setup** → **App signing**
2. Click **Request upload key reset**
3. Follow Google's process (may take 48 hours)
4. After reset, Google will accept the new key that EAS generates

### Step 4: Rebuild the App

After configuring the correct credentials:

```bash
eas build --platform android --profile production
```

## Quick Fix: Reset Upload Key (If You Don't Have Original)

If you cannot access the original upload key, the fastest solution is to reset it in Google Play:

1. **Google Play Console** → Your App
2. **Release** → **Setup** → **App signing**
3. Click **Request upload key reset**
4. Follow the verification process
5. Once approved (usually 24-48 hours), rebuild with EAS:
   ```bash
   eas build --platform android --profile production
   ```

## Verify the Fix

After rebuilding, check the SHA-1 fingerprint:

```bash
# Extract and check the AAB signature
jarsigner -verify -verbose -certs your-app.aab | grep "SHA1"
```

The SHA-1 should match: `04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6`

