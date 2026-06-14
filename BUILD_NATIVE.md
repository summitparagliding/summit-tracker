# Building Summit Paragliding as a Native App

The native app gives true background GPS (screen off) on both Android and iOS.
The web app code is UNCHANGED — Capacitor wraps it with native APIs.

## Prerequisites

- Node.js installed
- For Android: Android Studio
- For iOS: Mac + Xcode + Apple Developer account ($99/yr)

## One-time setup

```bash
# From the paragliding-tracker directory:
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm install @capacitor-community/background-geolocation

npx cap add android
npx cap add ios
```

## Every time you deploy a new web version

```bash
npm run build          # Build the web app
npx cap sync           # Copy build to native projects
```

## Build Android APK

```bash
npx cap open android   # Opens Android Studio
# In Android Studio: Build → Generate Signed Bundle/APK
```

## Build iOS IPA (Mac only)

```bash
npx cap open ios       # Opens Xcode
# In Xcode: Product → Archive
```

## Required native permissions

**Android** (`android/app/src/main/AndroidManifest.xml` — added by cap sync):
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

**iOS** (`ios/App/App/Info.plist` — added by cap sync):
```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Summit Paragliding suit votre position GPS pendant le vol.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Summit Paragliding a besoin de votre position GPS pour le carnet de vol.</string>
<key>UIBackgroundModes</key>
<array><string>location</string></array>
```

## How background GPS works in the native app

When running inside Capacitor (`window.Capacitor.isNativePlatform() === true`),
the active flight page automatically uses `window.Capacitor.Plugins.BackgroundGeolocation`
instead of `navigator.geolocation`. This keeps GPS running when the screen is off.
