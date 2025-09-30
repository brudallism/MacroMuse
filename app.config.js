const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const BUNDLE_IDENTIFIER = 'com.macromuse.nutrition'

export default {
  expo: {
    name: 'MacroMuse',
    slug: 'macromuse-nutrition',
    version: '1.0.0',
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1F2937'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      bundleIdentifier: BUNDLE_IDENTIFIER,
      buildNumber: '1',
      supportsTablet: true,
      requireFullScreen: false,
      userInterfaceStyle: 'automatic',
      infoPlist: {
        NSCameraUsageDescription: 'MacroMuse uses the camera to scan barcodes for easy food logging.',
        NSPhotoLibraryUsageDescription: 'MacroMuse accesses your photo library to let you select images for custom foods and recipes.',
        CFBundleAllowMixedLocalizations: true,
        ITSAppUsesNonExemptEncryption: false
      },
      config: {
        usesNonExemptEncryption: false
      },
      associatedDomains: [
        'applinks:macromuse.app'
      ]
    },
    android: {
      package: BUNDLE_IDENTIFIER,
      versionCode: 1,
      compileSdkVersion: 34,
      targetSdkVersion: 34,
      buildToolsVersion: '34.0.0',
      userInterfaceStyle: 'automatic',
      permissions: [
        'CAMERA',
        'INTERNET',
        'ACCESS_NETWORK_STATE'
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'macromuse.app'
            }
          ],
          category: ['BROWSABLE', 'DEFAULT']
        }
      ]
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro'
    },
    plugins: [
      'expo-camera',
      [
        '@sentry/react-native',
        {
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          url: 'https://sentry.io/',
          authToken: process.env.SENTRY_AUTH_TOKEN,
          debug: !IS_PRODUCTION
        }
      ],
      [
        'expo-build-properties',
        {
          ios: {
            newArchEnabled: false,
            flipper: !IS_PRODUCTION
          },
          android: {
            newArchEnabled: false,
            enableProguardInReleaseBuilds: IS_PRODUCTION,
            enableShrinkResourcesInReleaseBuilds: IS_PRODUCTION
          }
        }
      ]
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      usdaApiKey: process.env.USDA_API_KEY,
      spoonacularApiKey: process.env.SPOONACULAR_API_KEY,
      sentryDsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      eas: {
        projectId: process.env.EXPO_PROJECT_ID || 'your-expo-project-id'
      }
    },
    scheme: 'macromuse',
    privacy: 'public',
    runtimeVersion: {
      policy: 'sdkVersion'
    },
    updates: {
      url: `https://u.expo.dev/${process.env.EXPO_PROJECT_ID || 'your-expo-project-id'}`
    }
  }
}