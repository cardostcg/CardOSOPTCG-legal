# Digital Asset Links Setup for com.cardos.optcg

## Current Status
- Package name: `com.cardos.optcg`
- Domain: `cardostcg.com`
- File location: `/.well-known/assetlinks.json`

## Required: Get SHA-256 Fingerprint from Play Console

### Option 1: Via Play Console (App Signing Page)
1. Go to https://play.google.com/console
2. Select your app (CardOS OP TCG)
3. Navigate to: **Release** > **Setup** > **App signing**
4. Look for "App signing key certificate"
5. Copy the **SHA-256 certificate fingerprint** (format: `AA:BB:CC:...`)
6. Remove the colons to get: `AABBCC...`

### Option 2: Via Play Console (App Links Section)  
1. Go to https://play.google.com/console
2. Select your app (CardOS OP TCG)
3. Navigate to: **Grow** > **Deep links** (or **App links**)
4. Click "Add website association"
5. Enter domain: `cardostcg.com`
6. The console will generate the `assetlinks.json` content with the correct SHA-256
7. Copy the entire JSON

### Option 3: From Keystore (if you have the password)
```bash
# Decode the keystore
base64 -d scripts/keystore.b64 > /tmp/keystore.jks

# Extract SHA-256 (replace PASSWORD with actual keystore password)
keytool -list -v -keystore /tmp/keystore.jks -storepass PASSWORD | \
  grep "SHA256:" | \
  awk '{print $2}' | \
  tr -d ':'
```

## Update assetlinks.json
Replace `PLACEHOLDER_SHA256_FINGERPRINT_FROM_PLAY_CONSOLE` in assetlinks.json with the actual SHA-256 fingerprint.

## Deploy
After updating the file:
1. Commit and push to GitHub
2. Verify deployment: `curl https://cardostcg.com/.well-known/assetlinks.json`
3. Test in Play Console: **Grow** > **Deep links** > **Verify**

## Testing
```bash
# Check file is accessible
curl -I https://cardostcg.com/.well-known/assetlinks.json
# Should return: HTTP/2 200

# Validate JSON format
curl https://cardostcg.com/.well-known/assetlinks.json | jq .
# Should parse without errors
```
