# Fix Android Signing Key Mismatch - Step by Step

## Current Status
- **Expected SHA1:** `04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6`
- **Current SHA1:** `17:C0:79:81:CC:63:CF:D6:72:F0:44:EC:4E:B5:CD:AC:26:28:38:80`
- **Package:** `com.rizqaai.app` ✅ (matches Play Console)

---

## Step 1: Check Current EAS Credentials

Run this command to see what keystore EAS is currently using:

```bash
eas credentials --platform android
```

This will show you:
- Current keystore status
- Keystore alias (if any)
- Whether credentials exist

---

## Step 2: Configure EAS to Use Correct Keystore

You have two options:

### Option A: Upload Your Existing Upload Keystore (Recommended)

If you have the original `.jks` or `.keystore` file that matches the expected SHA1:

```bash
eas credentials --platform android
```

When prompted:
1. Select: **"Set up a new Android Keystore"** or **"Update existing credentials"**
2. Choose: **"Upload a keystore"**
3. Provide:
   - **Keystore file path:** (path to your `.jks` or `.keystore` file)
   - **Keystore alias:** (the alias name, e.g., `upload` or `key0`)
   - **Keystore password:** (password for the keystore)
   - **Key password:** (password for the specific key, may be same as keystore password)

EAS will upload and store this securely.

### Option B: Download Upload Key from Google Play Console

If you don't have the keystore file locally:

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app → **Release** → **Setup** → **App signing**
3. Scroll to **"Upload key certificate"** section
4. Click **"Download"** to get the certificate (`.pem` file)

**Note:** You'll need the private key (`.pem` or `.key` file) to create a keystore. If you only have the certificate, you'll need to:
- Contact your team to get the original keystore, OR
- Request an upload key reset in Google Play Console

---

## Step 3: Verify Package Name Matches

✅ Already verified: `app.json` has `"package": "com.rizqaai.app"` which matches your Play Console app.

---

## Step 4: Rebuild with Correct Credentials

After configuring the correct keystore:

```bash
eas build --platform android --profile production
```

---

## Step 5: Verify AAB Signing Certificate Before Upload

### Method 1: Using `apksigner` (Recommended)

First, extract the APK from the AAB (if needed), or use `bundletool`:

```bash
# Install bundletool if you don't have it
# Download from: https://github.com/google/bundletool/releases

# Extract APKs from AAB
java -jar bundletool.jar build-apks \
  --bundle=your-app.aab \
  --output=app.apks \
  --mode=universal

# Extract the universal APK
unzip app.apks universal.apk

# Verify signing certificate
apksigner verify --print-certs universal.apk
```

Look for the SHA-1 fingerprint in the output. It should match:
```
04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6
```

### Method 2: Using `keytool` (If you have the keystore)

```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

Enter the keystore password when prompted. Look for the SHA1 fingerprint.

### Method 3: Using `jarsigner` (Quick check)

```bash
jarsigner -verify -verbose -certs your-app.aab | grep -A 5 "SHA1"
```

### Method 4: Extract and Check AAB Directly

```bash
# AAB files are ZIP archives
unzip -l your-app.aab | grep META-INF

# Extract the signing certificate
unzip -p your-app.aab META-INF/*.RSA | openssl pkcs7 -inform DER -text -noout | grep -A 2 "SHA1"
```

---

## Quick Verification Script

Create a file `verify-aab.sh`:

```bash
#!/bin/bash

AAB_FILE=$1

if [ -z "$AAB_FILE" ]; then
    echo "Usage: ./verify-aab.sh your-app.aab"
    exit 1
fi

echo "Verifying AAB: $AAB_FILE"
echo ""

# Extract universal APK if bundletool is available
if command -v bundletool &> /dev/null; then
    echo "Extracting APK from AAB..."
    java -jar bundletool.jar build-apks \
      --bundle="$AAB_FILE" \
      --output=temp.apks \
      --mode=universal 2>/dev/null
    
    unzip -q temp.apks universal.apk 2>/dev/null
    
    if [ -f "universal.apk" ]; then
        echo "Checking certificate with apksigner..."
        apksigner verify --print-certs universal.apk | grep -A 2 "SHA-1"
        rm -f universal.apk temp.apks
    fi
else
    echo "Using jarsigner..."
    jarsigner -verify -verbose -certs "$AAB_FILE" 2>&1 | grep -A 5 "SHA1"
fi

echo ""
echo "Expected SHA1: 04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6"
```

Make it executable and run:
```bash
chmod +x verify-aab.sh
./verify-aab.sh your-app.aab
```

---

## Troubleshooting

### If EAS credentials command fails:
- Make sure you're logged in: `eas whoami`
- Try: `eas login` if needed

### If you don't have the original keystore:
- Request upload key reset in Google Play Console
- This takes 24-48 hours but is the safest option

### If the SHA1 still doesn't match after rebuild:
- Double-check you uploaded the correct keystore
- Verify the keystore alias and passwords are correct
- Check that EAS is using the production profile

---

## Summary Checklist

- [ ] Checked current EAS credentials: `eas credentials --platform android`
- [ ] Uploaded correct keystore to EAS (or requested reset)
- [ ] Verified package name: `com.rizqaai.app`
- [ ] Rebuilt: `eas build --platform android --profile production`
- [ ] Verified SHA1 before upload matches expected: `04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6`
- [ ] Uploaded to Play Console

