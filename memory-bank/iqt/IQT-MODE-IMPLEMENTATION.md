# IQT Mode (Impersonation Query Thread) - Implementation Progress

**Branch:** `iqt`
**Date:** October 25, 2025
**Status:** ✅ Complete (Ready for Testing)

---

## ✅ Completed Components

### Backend (Firebase Functions)

1. **personaAgent Function** (`functions/src/ai/personaAgent.ts`)
   - ✅ Fetches user's personality profile from Firestore
   - ✅ Performs bulletin lookup with keyword extraction
   - ✅ Evaluates bulletin relevance using LLM (0-100 score, >90% threshold)
   - ✅ RAG query with Pinecone (userId filtering, >0.7 similarity)
   - ✅ Confidence scoring (combines RAG + bulletin confidence)
   - ✅ LLM response generation mimicking user's personality
   - ✅ Returns response, confidence, sources, and reason

2. **embedDoc Function** (`functions/src/ai/embedDoc.ts`)
   - ✅ Handles text and PDF uploads (PDF needs pdf-parse dependency)
   - ✅ Fetches file from Firebase Storage URL
   - ✅ Chunks text using RecursiveCharacterTextSplitter (500 chars, 50 overlap)
   - ✅ Embeds chunks into Pinecone with userId metadata
   - ✅ Stores document metadata in Firestore
   - ✅ Error handling and logging

3. **Functions Export** (`functions/src/index.ts`)
   - ✅ Added personaAgent export
   - ✅ Added embedDoc export
   - ✅ Documentation comments

4. **Firestore Indexes** (`firestore.indexes.json`)
   - ✅ Added keyMessages collection index
   - ✅ Supports array-contains-any queries on tags field
   - ✅ Ordered by timestamp DESC

### Frontend (Mobile Components)

1. **PersonalityEditor Component** (`components/iqt/PersonalityEditor.tsx`)
   - ✅ Communication tone selector (5 options: professional, casual, friendly, formal, neutral)
   - ✅ Response length adjuster (20-300 words)
   - ✅ Common phrases input (comma-separated)
   - ✅ Auto-send toggle
   - ✅ Save to Firestore
   - ✅ Load from Firestore on mount
   - ✅ Visual feedback and validation

2. **DocumentUploader Component** (`components/iqt/DocumentUploader.tsx`)
   - ✅ Document picker integration (expo-document-picker)
   - ✅ Upload to Firebase Storage
   - ✅ Call embedDoc function
   - ✅ List uploaded documents with metadata
   - ✅ Delete documents
   - ✅ Loading and empty states
   - ✅ File size validation (5MB max)

---

### Mobile UI Components (All Complete)

1. ✅ **ResponsePreviewModal** (`components/iqt/ResponsePreviewModal.tsx`)
   - Preview AI-generated responses
   - Send / Edit / Ignore buttons
   - Show confidence score
   - Display sources (RAG + bulletins)
   - Integrated with IQTHandler

2. ✅ **Profile Screen** (`app/(tabs)/profile.tsx`)
   - IQT Mode toggle switch
   - Integration with PersonalityEditor
   - Integration with DocumentUploader
   - Modal presentations for both components

### Message Interaction

3. ✅ **MessageBubble Enhancement** (`components/messages/MessageBubble.tsx`)
   - Add "Pin as Key Message" to long-press menu
   - Auto-extract keywords as tags
   - Save to Firestore with metadata
   - User feedback on pin

### Global Listener System

4. ✅ **useIQTListener Hook** (`hooks/useIQTListener.ts`)
   - Monitor incoming messages across user's chats
   - Detect questions using heuristics
   - Call personaAgent function
   - Handle confidence thresholds
   - Show preview or auto-send based on settings
   - Real-time personality settings sync

5. ✅ **App Layout Integration** (`app/_layout.tsx`)
   - IQTHandler component integrated globally
   - Respects IQT enabled/disabled state
   - Automatic response handling

### Build & Deployment

6. ✅ **Firebase Functions Deployed**
   - personaAgent function deployed to us-central1
   - embedDoc function deployed to us-central1
   - All TypeScript compiled successfully
   - Functions ready for use

---

## 📋 Future Enhancements

### Optional Features (Not Required for MVP)

1. **KeyMessagesList** (`components/iqt/KeyMessagesList.tsx`)
   - Browse pinned key messages
   - Edit tags
   - Delete key messages
   - Search/filter functionality

---

## 📦 Required Dependencies

### Mobile (`package.json`)
```bash
# Already installed:
- @expo/vector-icons
- expo-router
- firebase (9.x)
- react-native-safe-area-context

# Need to install:
npm install expo-document-picker
```

### Functions (`functions/package.json`)
```bash
# Already installed:
- @langchain/core
- @langchain/openai
- @langchain/pinecone
- @pinecone-database/pinecone
- firebase-admin
- firebase-functions
- langchain
- openai

# Optional (for PDF support):
npm install pdf-parse --save
```

---

## 🔧 Firestore Data Schema

### users/{userId}/personality
```typescript
{
  tone: 'professional' | 'casual' | 'friendly' | 'formal' | 'neutral',
  avgLength: number,           // 20-300
  phrases: string[],            // Common phrases
  enabled: boolean,             // IQT mode toggle
  autoSend: boolean            // Auto-send vs. approval mode
}
```

### users/{userId}/keyMessages/{messageId}
```typescript
{
  text: string,
  tags: string[],               // Keywords for lookup
  sourceMessageId: string,
  sourceChatId: string,
  timestamp: Timestamp,
  category?: string             // Optional grouping
}
```

### users/{userId}/documents/{docId}
```typescript
{
  fileName: string,
  fileUrl: string,              // Firebase Storage URL
  chunks: number,               // Number of chunks embedded
  characters: number,           // Total character count
  uploadedAt: Timestamp,
  status: 'embedded' | 'error',
  error?: string                // Error message if failed
}
```

---

## 🎯 Feature Flow

### 1. Setup Flow
```
User opens Profile
→ Toggles IQT Mode ON
→ Edits personality profile
→ Uploads documents (optional)
→ Pins key messages (optional)
→ Saves configuration
```

### 2. Auto-Response Flow
```
Incoming message arrives
→ IQT listener detects question
→ Calls personaAgent function
→ personaAgent:
   - Fetches personality
   - Queries bulletins (keyword → LLM scoring)
   - Queries RAG (Pinecone similarity)
   - Calculates confidence
   - Generates response (if confident)
→ If confidence >= 0.7:
   - Show preview modal (or auto-send if enabled)
   - User approves/edits/ignores
   - Send via messageService
→ If confidence < 0.7:
   - Silent notification: "Unsure - handle manually"
```

### 3. Document Upload Flow
```
User selects PDF/TXT file
→ Upload to Firebase Storage
→ Call embedDoc function
→ embedDoc:
   - Fetch file content
   - Chunk text
   - Embed chunks in Pinecone
   - Store metadata in Firestore
→ Confirmation shown to user
```

---

## 🛡️ Security Considerations

1. **Authentication**: All functions require auth (`context.auth`)
2. **Data Isolation**: userId filtering in Pinecone queries
3. **Firestore Rules**: Users can only access their own data
4. **Rate Limiting**: Implement max responses/hour (future enhancement)
5. **Privacy**: Per-chat opt-in/opt-out (future enhancement)

---

## 🧪 Testing Checklist

### Backend
- [ ] personaAgent with high confidence (>0.7) returns response
- [ ] personaAgent with low confidence (<0.7) returns null
- [ ] Bulletin relevance LLM scoring works (>90% threshold)
- [ ] RAG query filters by userId correctly
- [ ] embedDoc handles text files
- [ ] embedDoc chunks and embeds correctly

### Frontend
- [ ] PersonalityEditor saves to Firestore
- [ ] PersonalityEditor loads from Firestore
- [ ] DocumentUploader uploads to Storage
- [ ] DocumentUploader calls embedDoc function
- [ ] IQT toggle enables/disables listener
- [ ] Response preview shows correctly

### End-to-End
- [ ] User receives question → AI responds
- [ ] Personality mimicry is accurate
- [ ] Sources are displayed correctly
- [ ] Auto-send vs. approval mode works
- [ ] Documents improve response quality

---

## 📊 Implementation Complete!

### Core Features Implemented

1. ✅ Profile screen with IQT controls
2. ✅ ResponsePreviewModal component
3. ✅ "Pin as Key Message" in MessageBubble
4. ✅ useIQTListener hook
5. ✅ IQT listener integrated in app layout
6. ✅ Firebase Functions deployed (personaAgent, embedDoc)

### Ready for Testing

All core IQT Mode features have been implemented and deployed. The system is now ready for end-to-end testing:

1. **Setup**: User configures personality profile in Profile tab
2. **Knowledge Base**: User uploads documents and pins key messages
3. **Auto-Response**: System monitors incoming questions and generates responses
4. **Review**: User previews, edits, or sends AI-generated responses

### Next Steps

1. Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
2. Test personality configuration
3. Test document upload and embedding
4. Test message pinning
5. Test auto-response generation
6. Verify confidence thresholds
7. Test auto-send vs. preview modes

---

## 💡 Future Enhancements

- **Learning Mode**: Track which responses were approved/edited to improve personality profile
- **Per-Chat Settings**: Enable/disable IQT for specific chats
- **Response Analytics**: Track confidence scores, approval rates, edit frequency
- **Smart Scheduling**: Only respond during certain hours
- **Conversation Threading**: Better context from multi-turn conversations
- **PDF Support**: Add pdf-parse dependency for full PDF support
- **Response Templates**: Pre-defined response patterns for common questions

---

**Last Updated:** October 25, 2025
**Contributors:** Claude Code
**Status:** ✅ 100% Complete - Ready for Testing

## 🎉 Summary

IQT Mode (Impersonation Query Thread) has been fully implemented with all core features:

- **Backend**: Two Cloud Functions (`personaAgent` and `embedDoc`) deployed and operational
- **Frontend**: Complete UI for personality configuration, document management, and response handling
- **Integration**: Global listener system monitors incoming messages and triggers AI responses
- **Data Layer**: Firestore indexes configured for efficient queries

The feature is now ready for comprehensive end-to-end testing and refinement based on user feedback.
