# Rizqa AI - Daily Quranic Verses App

A React Native app built with Expo that provides users with daily Quranic verses.

## Features

- User authentication (Register/Login) using Supabase
- Secure session management
- Beautiful and modern UI
- First-time users see the Register screen
- Logged-in users are automatically taken to the Home page

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:

**IMPORTANT: To avoid "failed to download remote update" error, use tunnel mode:**
```bash
npm run tunnel
```

Or for regular start:
```bash
npm start
```

For development with cache clearing:
```bash
npm run dev
```

**If you still get the update error:**
1. Use tunnel mode: `npm run tunnel` (this routes through Expo's servers and avoids local network issues)
2. Make sure your phone and computer are on the same Wi-Fi network
3. Try restarting Expo Go app on your phone
4. Clear Expo cache: `npm run dev`

## Windows PowerShell Commands

If you need to delete node_modules on Windows PowerShell:
```powershell
Remove-Item -Recurse -Force node_modules
```

Or use the shorter alias:
```powershell
rm -r -fo node_modules
```

3. Run on your preferred platform:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your device
- Make sure your phone and computer are on the same Wi-Fi network

## Troubleshooting

If you see "failed to download remote update" error:
1. Make sure both devices are on the same network
2. Try using tunnel mode: `npx expo start --tunnel`
3. Clear cache: `npx expo start --clear`
4. Check firewall settings - allow port 8081

## Project Structure

```
├── App.tsx                 # Main app entry point with navigation
├── src/
│   ├── lib/
│   │   └── supabase.ts     # Supabase client configuration
│   └── screens/
│       ├── RegisterScreen.tsx
│       ├── LoginScreen.tsx
│       └── HomeScreen.tsx
└── package.json
```

## Authentication Flow

- First-time users: Register screen is shown
- Users can navigate to Login screen from Register
- After successful login/registration, users are taken to Home screen
- Session is persisted using AsyncStorage
- Logged-in users are automatically authenticated on app restart

