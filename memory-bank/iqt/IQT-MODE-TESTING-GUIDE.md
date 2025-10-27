# IQT Mode - Testing Guide

**Feature:** Impersonation Query Thread (IQT Mode)
**Status:** ✅ Ready for Testing
**Date:** October 25, 2025

---

## 🎯 Overview

IQT Mode allows users to configure an AI persona that automatically monitors incoming messages and generates responses based on:
- User's communication style (personality profile)
- Uploaded documents (knowledge base)
- Pinned key messages (bulletins)

---

## ✅ Pre-Testing Checklist

All prerequisites have been completed:

- ✅ Firebase Functions deployed (`personaAgent`, `embedDoc`)
- ✅ Firestore indexes deployed
- ✅ expo-document-picker installed
- ✅ All frontend components implemented
- ✅ Global listener integrated

---

## 🧪 Test Plan

### Phase 1: Setup & Configuration

#### Test 1.1: Profile Screen - IQT Toggle

1. **Open the app and navigate to Profile tab**
2. **Verify IQT Section is visible**
   - Look for "IQT Mode" section with toggle switch
   - Should show "Let your AI persona handle repetitive questions..."
3. **Toggle IQT Mode ON**
   - Alert should appear: "IQT Mode Enabled"
   - Controls should appear: "Edit Personality" and "Manage Documents"
4. **Toggle IQT Mode OFF**
   - Controls should disappear

**Expected:** Toggle works, UI updates correctly

---

#### Test 1.2: Personality Configuration

1. **Enable IQT Mode**
2. **Tap "Edit Personality"**
3. **Modal should open with PersonalityEditor**

**Test Communication Tone:**
- Tap each tone option (Professional, Casual, Friendly, Formal, Neutral)
- Verify visual feedback (selected state)

**Test Response Length:**
- Tap `-` button (should decrease by 20, minimum 20)
- Tap `+` button (should increase by 20, maximum 300)
- Verify display shows current word count

**Test Common Phrases:**
- Enter: "Sounds good!, Let's dive in, Great point"
- Verify text input works

**Test Auto-Send Toggle:**
- Tap toggle to enable/disable
- Verify visual state changes

**Save Configuration:**
- Tap "Save Personality"
- Alert: "Success - Personality profile saved successfully"
- Close modal
- Reopen modal - settings should persist

**Expected:** All controls work, data saves to Firestore

---

#### Test 1.3: Document Upload

1. **Tap "Manage Documents"**
2. **Modal should open with DocumentUploader**

**Test Upload:**
- Tap "Upload Document"
- Document picker should open
- Select a text file (.txt)
- Progress indicator should show "Uploading..."
- Success alert: "Document embedded successfully! X chunks created"
- Document should appear in list with:
  - File name
  - Chunk count
  - Character count
  - Upload date

**Test Document List:**
- Verify document appears with metadata
- Icon should be document-text (blue)
- Status should show chunk/character info

**Test Delete:**
- Tap trash icon on document
- Confirm deletion dialog
- Document should be removed from list

**Expected:** Upload works, embedDoc function processes file, Firestore updated

---

### Phase 2: Knowledge Base Building

#### Test 2.1: Save Messages to IQT Knowledge

1. **Navigate to a chat with existing messages**
2. **Long-press on any text message**
3. **Context menu should appear with:**
   - "Copy" option (with copy icon)
   - "Save for IQT" option (with bookmark icon) ✨ NEW

**Save a Message:**
- Tap "Save for IQT"
- Alert: "Saved to IQT Knowledge"
- Message shows keywords: "This message will help IQT respond to questions about: [keywords]"
- Keywords are auto-extracted (5 max, >3 chars, no stop words)

**Test Multiple Saves:**
- Save 3-5 different messages with varied, informative content
- Each should show success alert with relevant keywords
- Examples of good messages to save:
  - "Our meeting is Tuesday at 2pm"
  - "Project deadline is March 15"
  - "Budget approved for $50k"

**Expected:** Messages save to `users/{userId}/keyMessages/{messageId}` with:
- text
- tags (auto-extracted keywords)
- sourceMessageId
- sourceChatId
- timestamp
- category: 'manual'

---

### Phase 3: Auto-Response Testing

#### Test 3.1: Question Detection

**Setup:**
- Have IQT Mode enabled
- Personality configured
- At least 1 document uploaded OR 2-3 key messages pinned

**Test Scenarios:**

**Scenario A: Simple Question (High Confidence)**
1. From another account, send a question that matches pinned knowledge:
   - Example: If you pinned "Our meeting is Tuesday at 2pm"
   - Send: "When is our meeting?"

**Expected:**
- useIQTListener detects question (contains "?")
- Calls personaAgent function
- If confidence >= 0.7:
  - Auto-send enabled (confidence >= 0.8) → message sent automatically
  - Auto-send disabled → ResponsePreviewModal appears

**Scenario B: Question Without Match (Low Confidence)**
1. Send a question with no relevant knowledge:
   - Example: "What's the weather like?"

**Expected:**
- personaAgent returns low confidence (<0.7)
- No modal, no response sent
- Console log: "⚠️ IQT: Confidence too low, skipping"

---

#### Test 3.2: Response Preview Modal

**When confidence is 0.7-0.79 (medium confidence):**

1. **Modal should appear with:**

**Header:**
- Sparkles icon + "AI Response Preview"
- Close button (X)

**Confidence Card:**
- Confidence score badge (percentage)
- Color coding:
  - Green: >=80% (High)
  - Orange: 60-79% (Medium)
  - Red: <60% (Low)
- Confidence label
- Reason text (e.g., "Generated based on 3 sources")

**Response Card:**
- Generated response text
- Pencil icon (Edit button)

**Sources Card (if sources exist):**
- List of sources used:
  - Icon: document-text (RAG) or bookmark (Key Message)
  - Type label
  - Score percentage
  - Content preview (3 lines max)

**Action Buttons:**
- "Ignore" (gray with red border)
- "Send" (blue) or "Send Edited" if edited

**Test Actions:**

**Ignore:**
- Tap "Ignore"
- Modal should close
- No message sent
- Console: "🚫 IQT: User ignored response"

**Edit:**
- Tap pencil icon
- Text input should appear
- Edit the response
- "Cancel Edit" button appears
- Make changes
- Tap "Send Edited"
- Message should send with edited text
- Modal closes

**Send:**
- Tap "Send"
- Message should be sent to chat
- Modal closes
- Console: "✅ IQT: Response sent by user"

**Expected:** All interactions work smoothly

---

#### Test 3.3: Auto-Send Mode

1. **Enable Auto-Send in PersonalityEditor**
2. **Send a high-confidence question**

**Expected:**
- personaAgent returns confidence >= 0.8
- Response sent automatically (no modal)
- Message appears in chat
- Console: "✅ IQT: Auto-sending response"

---

### Phase 4: End-to-End Scenarios

#### Scenario E2E-1: Complete Workflow

**Setup:**
1. User A configures IQT Mode:
   - Tone: Casual
   - Length: 50 words
   - Phrases: "No worries, Sounds good"
   - Auto-send: OFF

2. User A uploads a document:
   - File: project-notes.txt
   - Content: "Project deadline is March 15. Tech stack: React Native + Firebase. Budget: $50k"

3. User A saves a message to IQT:
   - Long-press message: "We're meeting at Starbucks on 5th Ave"
   - Tap "Save for IQT"
   - Alert confirms with keywords: "meeting, starbucks"

**Test:**
1. User B sends: "What's the project deadline?"

**Expected:**
- personaAgent finds "deadline" in document
- Generates response in casual tone, ~50 words
- Modal appears for User A
- Response includes "March 15"
- User A can review and send

---

#### Scenario E2E-2: Multiple Source Combination

**Setup:**
- Saved IQT message: "Budget approved for $50k" (saved via "Save for IQT")
- Uploaded document: "Project phases: Phase 1 (Design), Phase 2 (Development), Phase 3 (Testing)"

**Test:**
- User B asks: "What's our budget and what are the phases?"

**Expected:**
- personaAgent combines both sources
- High confidence (both matched)
- Response mentions both budget AND phases
- Sources section shows 2 sources (1 bulletin, 1 RAG)

---

## 🐛 Debugging Tips

### Check Logs

**Firebase Functions Logs:**
```bash
firebase functions:log --only personaAgent,embedDoc
```

**Console Logs to Look For:**
- `🎧 IQT: Listener started`
- `📨 IQT: Processing question: ...`
- `🤖 IQT: Response generated`
- `✅ IQT: Response sent`
- `⚠️ IQT: Confidence too low`

### Firestore Verification

**Check Personality Profile:**
```
users/{userId}/personality
```
Should have: tone, avgLength, phrases, enabled, autoSend

**Check Key Messages:**
```
users/{userId}/keyMessages/{messageId}
```
Should have: text, tags[], timestamp

**Check Documents:**
```
users/{userId}/documents/{docId}
```
Should have: fileName, chunks, status: 'embedded'

### Common Issues

**Issue: No modal appears**
- Check: IQT enabled in profile?
- Check: Question detected? (look for "?")
- Check: Console logs for confidence score
- Check: Firestore personality doc exists

**Issue: Low confidence every time**
- Check: Documents embedded? (status: 'embedded')
- Check: Key messages have tags?
- Check: Question keywords match document/message content
- Try: More specific questions that match uploaded content

**Issue: Upload fails**
- Check: File size <5MB
- Check: File type is .txt (PDF not yet supported)
- Check: Firebase Storage rules allow uploads
- Check: PINECONE_API_KEY and OPENAI_API_KEY in functions/.env

---

## 📊 Success Criteria

✅ All tests pass
✅ Personality configuration persists
✅ Documents upload and embed successfully
✅ Key messages save with tags
✅ Questions trigger personaAgent
✅ High confidence shows modal
✅ Responses can be sent/edited/ignored
✅ Auto-send works when enabled
✅ Response quality matches personality

---

## 🚀 Next Steps After Testing

1. Gather user feedback on:
   - Response quality
   - Confidence threshold accuracy
   - UI/UX improvements

2. Potential enhancements:
   - KeyMessagesList component (browse/edit/delete pinned messages)
   - PDF support (requires pdf-parse library)
   - Per-chat enable/disable
   - Response templates
   - Learning mode (track approved/edited responses)

3. Performance optimizations:
   - Cache frequently used documents
   - Batch embedding for multiple uploads
   - Optimize Pinecone queries

---

**Happy Testing! 🎉**
