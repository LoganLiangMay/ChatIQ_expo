# 🚀 IQT Mode - Ready to Test!

Everything is deployed and configured. You can now start testing!

---

## ✅ What's Been Completed

### 1. Firebase Backend ✅
- ✅ `personaAgent` function deployed to us-central1
- ✅ `embedDoc` function deployed to us-central1
- ✅ Firestore indexes deployed for keyMessages

### 2. Mobile App ✅
- ✅ expo-document-picker installed
- ✅ TypeScript compilation successful
- ✅ All IQT components integrated

---

## 🏁 Start Testing Now

### Step 1: Start the App (1 min)

```bash
npm start
```

Then press:
- `i` for iOS Simulator
- `a` for Android Emulator
- Or scan QR code with Expo Go

### Step 2: Configure IQT Mode (2 min)

1. **Navigate to Profile tab** (bottom navigation)
2. **Find "IQT Mode" section** (with sparkles ✨ icon)
3. **Toggle IQT Mode ON**
4. **Tap "Edit Personality"**
5. **Configure:**
   - Tone: Casual
   - Length: 50 words
   - Phrases: "Sounds good!, No worries"
   - Auto-send: OFF (so you can preview responses)
6. **Tap "Save Personality"**

### Step 3: Build Knowledge Base (3 min)

**Option A - Upload a Document:**

```bash
# Create a test document
echo "Our team meeting is every Tuesday at 2pm.
We meet at the Starbucks on 5th Avenue.
The project deadline is March 15, 2026.
Budget approved: $50,000" > ~/Desktop/team-info.txt
```

Then in the app:
1. Tap "Manage Documents"
2. Tap "Upload Document"
3. Select `team-info.txt`
4. Wait for success message

**Option B - Save Messages to IQT:**
1. Go to any chat with existing messages
2. Long-press a message (any informative message)
3. Context menu appears with "Copy" and "Save for IQT"
4. Tap **"Save for IQT"**
5. Alert shows: "Saved to IQT Knowledge" with extracted keywords
6. Repeat 2-3 times with different informative messages

### Step 4: Test Auto-Response (2 min)

From another account (or ask someone to):
1. Send you a question matching your knowledge:
   - "When is the team meeting?"
   - "Where do we meet?"
   - "What's the project deadline?"

**Expected Result:**
- Response Preview Modal appears
- Shows AI-generated response
- Displays confidence score
- Lists sources used
- You can Send, Edit, or Ignore

---

## 📖 Full Testing Guide

For comprehensive testing scenarios, see:
**`IQT-MODE-TESTING-GUIDE.md`**

---

## 🔍 What to Look For

### ✅ Success Indicators

1. **Profile Screen:**
   - IQT toggle works
   - Modals open for Personality and Documents
   - Settings save and persist

2. **Document Upload:**
   - File picker opens
   - Upload shows progress
   - Success alert with chunk count
   - Document appears in list

3. **Save Messages to IQT:**
   - Long-press shows context menu
   - "Save for IQT" option visible (with bookmark icon)
   - Success alert: "Saved to IQT Knowledge" with extracted keywords
   - Keywords help IQT understand what topics this message covers

4. **Auto-Response:**
   - Question triggers modal (if confidence >= 0.7)
   - Response matches your personality style
   - Sources are displayed
   - Actions work (Send/Edit/Ignore)

### ⚠️ Things to Watch

- **Low Confidence:** If confidence < 0.7, no modal appears (expected behavior)
- **Console Logs:** Check for "🎧 IQT: Listener started" and "📨 IQT: Processing question"
- **Response Quality:** Should match your configured tone and length

---

## 🐛 If Something Doesn't Work

### Check Console for Logs

Look for:
```
🎧 IQT: Listener started
📨 IQT: Processing question: ...
🤖 IQT: Response generated
```

### Verify Firestore Data

**Check personality exists:**
```
Firestore > users > {your-uid} > personality
```

**Check documents uploaded:**
```
Firestore > users > {your-uid} > documents
```

**Check pinned messages:**
```
Firestore > users > {your-uid} > keyMessages
```

### Common Issues

**"No modal appears"**
- Is IQT Mode enabled?
- Is the message a question (contains "?")?
- Check console for confidence scores

**"Confidence always low"**
- Upload more documents
- Pin more relevant messages
- Ask more specific questions

**"Upload fails"**
- File must be .txt (not PDF yet)
- File size must be < 5MB
- Check environment variables in functions/.env

---

## 📊 Test Checklist

Use this to track your testing:

- [ ] IQT Mode toggle works
- [ ] Personality saves and loads correctly
- [ ] Document uploads successfully
- [ ] "Save for IQT" appears in long-press menu
- [ ] Messages save with auto-extracted keywords
- [ ] Question detection works (messages with "?")
- [ ] Modal appears for high confidence responses
- [ ] Response quality matches personality settings
- [ ] Send button sends the response
- [ ] Edit button allows modifying response
- [ ] Ignore button dismisses without sending
- [ ] Auto-send mode works (if enabled)

---

## 🎯 Next Steps After Testing

1. **Try different personality configurations:**
   - Professional vs. Casual tone
   - Short vs. Long responses
   - Different phrases

2. **Test edge cases:**
   - Questions with no matching knowledge
   - Multiple sources for one question
   - Very long documents

3. **Provide feedback:**
   - What worked well?
   - What needs improvement?
   - Any bugs or unexpected behavior?

---

## 📚 Documentation

- **Quick Start:** This file
- **Detailed Testing:** `IQT-MODE-TESTING-GUIDE.md`
- **Implementation Details:** `IQT-MODE-IMPLEMENTATION.md`
- **Ready Guide:** `IQT-MODE-READY.md`

---

**Ready to test! 🎉**

Questions? Check the documentation files or review the console logs for debugging info.
