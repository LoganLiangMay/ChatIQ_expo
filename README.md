# MessageAI - WhatsApp-like Messaging App

A production-quality messaging application built with React Native, Expo, and Firebase.

## 🚧 Project Status

**⚠️ ARCHIVED PROJECT - MODERNIZATION IN PROGRESS**

This project was originally built with Expo SDK 49 and has been modernized to SDK 57. The codebase requires additional work before it's production-ready:

### ✅ Completed
- Upgraded to Expo SDK 57 (React Native 0.86, React 19.2.3)
- Fixed TypeScript compilation errors
- Added basic test infrastructure
- Modernized dependencies

### ⚠️ Known Issues & Technical Debt
1. **SQLite Integration**: The legacy WebSQL-like API (`openDatabase`) was removed in expo-sqlite@16+. The current implementation includes stubs and will **not work at runtime**. Full migration to the new `openDatabaseAsync` API is required.
   - See: https://docs.expo.dev/versions/latest/sdk/sqlite/

2. **Firebase Functions**: Cloud functions are included but not configured in the main app dependencies.

3. **Incomplete Features**: Some features have placeholder implementations:
   - Direct chat creation
   - Image message sending
   - Notification handlers require API compatibility fixes

4. **Type Safety**: Several files use `@ts-nocheck` to bypass type errors. These need proper typing.

## 🚀 Quick Start

### Prerequisites
- Node.js 22.13+
- npm or yarn
- Expo Go app (for testing)
- Firebase project with Firestore enabled

### Installation

1. **Clone and install dependencies**:
```bash
git clone <repo-url>
cd ChatIQ_expo
npm install
```

2. **Configure Firebase**:
```bash
cp .env.example .env
# Edit .env with your Firebase credentials from:
# https://console.firebase.google.com/ -> Project Settings -> General
```

3. **Run the app**:
```bash
npm start
# Scan QR code with Expo Go (iOS/Android)
```

### Running Tests
```bash
npm test        # Run unit tests
npm run lint    # TypeScript type checking
```

## 📂 Project Structure

```
ChatIQ_expo/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication
│   ├── (tabs)/            # Main tabs (chats, search, profile)
│   └── groups/            # Group management
├── components/            # Reusable React components
├── contexts/              # React Context providers
├── hooks/                 # Custom React hooks
├── services/              # Business logic
│   ├── database/          # SQLite (⚠️ requires migration)
│   ├── firebase/          # Firebase operations
│   ├── messages/          # Message queue & sync
│   └── network/           # Network monitoring
├── types/                 # TypeScript definitions
├── utils/                 # Utility functions
├── __tests__/             # Unit tests
└── memory-bank/           # Project documentation
```

## 🛠 Tech Stack

- **Frontend**: React Native 0.86 + Expo SDK 57
- **Router**: Expo Router ~57.0
- **Database**: Expo SQLite (⚠️ requires migration to new API)
- **Backend**: Firebase (Firestore, Auth, Storage, Functions)
- **Notifications**: Expo Notifications + FCM
- **Language**: TypeScript 5.7
- **Testing**: Jest + ts-jest

## 📋 Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

## 🎯 Core Features (Original Design)

- ✅ Real-time messaging (one-on-one and groups)
- ⚠️ Offline support with message queue (requires SQLite migration)
- ⚠️ Message persistence (requires SQLite migration)
- ✅ Delivery states and read receipts
- ✅ Online/offline indicators
- ⚠️ Push notifications (API compatibility fixes needed)
- ✅ User authentication
- ✅ Group chat with admin controls
- ⚠️ Image sharing (placeholder implementation)

## 🔧 Development

### Key Commands
```bash
npm start          # Start Expo dev server
npm test           # Run Jest tests
npm run lint       # Type check with TypeScript
npm run android    # Open Android app
npm run ios        # Open iOS app
npm run web        # Open web preview
```

### Firebase Setup
1. Create a Firebase project
2. Enable Firestore, Authentication, and Storage
3. Set up Firestore security rules (see `firestore.rules`)
4. (Optional) Deploy Cloud Functions from `functions/` directory

## 📚 Documentation

- **Product Requirements**: `memory-bank/product-requirements.md`
- **Implementation Guide**: `memory-bank/implementation-guide.md`
- **Code Architecture**: `memory-bank/code-architecture.md`
- **Development Roadmap**: `memory-bank/DEVELOPMENT-ROADMAP.md`

## ⚠️ Important Notes

1. **This is a modernization-in-progress project**: It compiles and tests pass, but runtime functionality is incomplete due to SQLite API changes.

2. **Not production-ready**: Requires SQLite migration and feature completion before deployment.

3. **Testing limitations**: Current tests are basic smoke tests. E2E tests are documented but not implemented.

## 📄 License

Gauntlet AI Project - MessageAI MVP

---

**Last Updated**: September 2026  
**Status**: Archived / Under Modernization  
**Expo SDK**: 57.0 (React Native 0.86)
