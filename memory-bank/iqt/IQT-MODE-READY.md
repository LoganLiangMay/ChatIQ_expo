# 🎉 IQT Mode - Ready for Testing!

**Date:** October 25, 2025
**Branch:** `iqt`
**Status:** ✅ All Setup Complete

---

## ✅ Deployment Summary

### Firebase Functions Deployed
```
✔ functions[personaAgent(us-central1)] - Deployed successfully
✔ functions[embedDoc(us-central1)] - Deployed successfully
```

### Firestore Indexes Deployed
```
✔ firestore: keyMessages collection index (tags + timestamp)
```

### Dependencies Installed
```
✔ expo-document-picker - Installed successfully
```

---

## 📱 How to Start Testing

### 1. Start the Expo Development Server

```bash
npm start
# or
npx expo start
```

### 2. Open the App

- **iOS Simulator:** Press `i`
- **Android Emulator:** Press `a`
- **Physical Device:** Scan QR code with Expo Go

### 3. Navigate to Profile Tab

Look for the new **IQT Mode** section with:
- ✨ Sparkles icon
- Toggle switch
- "Let your AI persona handle repetitive questions based on your knowledge bank"

### 4. Follow the Testing Guide

See `IQT-MODE-TESTING-GUIDE.md` for comprehensive test scenarios

---

## 🎯 Quick Start: 5-Minute Test

### Step 1: Configure Personality (2 min)
1. Open Profile tab
2. Toggle IQT Mode ON
3. Tap "Edit Personality"
4. Select tone: **Casual**
5. Set length: **50 words**
6. Add phrase: **"Sounds good!"**
7. Keep Auto-send OFF
8. Tap "Save Personality"

### Step 2: Create Knowledge Base (2 min)

**Option A: Upload a Document**
1. Tap "Manage Documents"
2. Tap "Upload Document"
3. Create a test file: `echo "Our meeting is Tuesday at 2pm. Location: Starbucks on 5th Ave." > ~/test-knowledge.txt`
4. Select the file
5. Wait for "Document embedded successfully!"

**Option B: Pin a Message**
1. Go to any chat with messages
2. Long-press a message
3. Tap "Pin as Key Message"
4. Repeat with 2-3 informative messages

### Step 3: Test Auto-Response (1 min)
1. Have someone send you a question (or use another account)
2. Question should relate to your knowledge:
   - "When is our meeting?"
   - "Where are we meeting?"
3. Watch for the Response Preview Modal!

**Expected Result:**
- Modal appears with AI-generated response
- Confidence score shown
- Sources displayed
- You can Send, Edit, or Ignore

---

## 🔍 Verify Everything is Working

### Check 1: Firebase Console

**Visit:** https://console.firebase.google.com/project/messageai-mvp-e0b2b/functions

**Verify:**
- `personaAgent` function exists
- `embedDoc` function exists
- Both show "Active" status

### Check 2: Firestore Data

**After configuring personality, check:**
```
Firestore > users > {your-uid} > personality
```
Should contain: tone, avgLength, phrases, enabled, autoSend

**After uploading document, check:**
```
Firestore > users > {your-uid} > documents
```
Should show document with chunks count

**After pinning message, check:**
```
Firestore > users > {your-uid} > keyMessages
```
Should show message with tags array

### Check 3: Console Logs

**Look for these logs in your terminal:**
```
🎧 IQT: Listener started
📨 IQT: Processing question: ...
🤖 IQT: Response generated
```

---

## 📚 Documentation Files

- **IQT-MODE-TESTING-GUIDE.md** - Comprehensive testing scenarios
- **IQT-MODE-IMPLEMENTATION.md** - Technical implementation details
- **This file** - Quick start guide

---

## 🐛 Troubleshooting

### Modal doesn't appear?

**Check:**
1. Is IQT Mode enabled in Profile?
2. Did you configure personality?
3. Is the incoming message a question (contains "?")?
4. Check console for confidence scores

**Try:**
- Ask a more specific question that matches your uploaded content
- Add more documents or pin more messages to increase knowledge base

### Upload fails?

**Check:**
1. File is .txt (PDF not supported yet)
2. File size <5MB
3. Check terminal for errors

**Environment variables set?**
```bash
# In functions/.env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=...
```

### Response quality issues?

**Tips:**
- Use more specific personality phrases
- Upload documents with more relevant content
- Pin messages that directly answer common questions
- Try different tone settings

---

## 🎨 UI Features to Look For

### Profile Tab
- **IQT Section** with toggle
- **Sparkles icon** next to "IQT Mode"
- **Edit Personality** button (when enabled)
- **Manage Documents** button (when enabled)

### PersonalityEditor Modal
- **5 tone chips** (professional, casual, friendly, formal, neutral)
- **Word count adjuster** with +/- buttons
- **Phrases input** (comma-separated)
- **Auto-send toggle**
- **Save button** (blue)

### DocumentUploader Modal
- **Upload button** (blue with cloud icon)
- **Info box** about file types/size
- **Document list** with metadata
- **Delete buttons** (trash icons)

### MessageBubble Long-Press Menu
- **Copy** option (existing)
- **Pin as Key Message** option (NEW with bookmark icon)

### ResponsePreviewModal
- **Confidence badge** (color-coded %)
- **Generated response** text
- **Edit button** (pencil icon)
- **Sources list** (with icons and scores)
- **Ignore** button (gray/red)
- **Send** button (blue)

---

## 🚀 You're All Set!

Everything is deployed and ready. Start the app and try it out!

**Questions or Issues?**
- Check `IQT-MODE-TESTING-GUIDE.md` for detailed test scenarios
- Review console logs for debugging info
- Check Firestore data to verify storage

**Good luck testing! 🎉**
