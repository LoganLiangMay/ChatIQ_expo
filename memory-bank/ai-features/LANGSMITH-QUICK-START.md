# LangSmith Quick Start - Debug Your RAG System

## What Just Happened

✅ Created `functions/.env` with your LangSmith API keys
✅ Deploying `knowledgeAgent` with LangSmith tracing enabled
✅ Fixed `textKey` and `namespace` mismatch (should fix "0 documents" issue)

## View Your Traces

### Step 1: Open LangSmith
Go to: **https://smith.langchain.com**

### Step 2: Select Your Project
Click on: **"pr-gripping-semiconductor-66"**

### Step 3: Wait for Traces
After deployment completes and you test a query, you'll see traces appear!

## Test Query (After Deployment)

### In the AI Assistant Tab:
Ask: **"Any mention of rest api in the chats"**

### Expected Trace in LangSmith:

```
📊 Run: knowledgeAgent
├─ 🔢 Embedding Generation
│  └─ Input: "Any mention of rest api in the chats"
│  └─ Output: [0.123, 0.456, ...] (1536 dimensions)
│  └─ Duration: 500ms
│
├─ 🔍 Pinecone Vector Search
│  ├─ Index: chatiq-messages
│  ├─ Namespace: (default)
│  ├─ Top K: 5
│  └─ Results: [
│      {
│        id: "019a175b-155b-433f-a8f4-6bf300006944",
│        content: "Agreed on Rest APi",
│        score: 0.89
│      },
│      {
│        id: "summary_019a171a-09a8-4e6f-8e33-485b0000bec4_2025-10-25",
│        content: "Daily Summary: ...REST API...",
│        score: 0.85
│      }
│    ]
│  └─ Duration: 200ms
│
└─ 💬 OpenAI LLM Call
   ├─ Model: gpt-4o-mini
   ├─ Prompt: "You are an AI assistant... Context: [retrieved docs]..."
   ├─ Response: "Yes, in your chat 'API Redesign'..."
   ├─ Tokens: 350 (250 input + 100 output)
   └─ Duration: 2000ms

Total Duration: 2700ms
Status: ✅ Success
```

## What to Look For

### ✅ Success Indicators:
1. **Embedding generated** successfully
2. **Pinecone returns results** (not empty array!)
3. **LLM receives context** with your messages
4. **Response mentions** specific content from your chats

### ❌ Failure Indicators:
1. **Pinecone returns empty array** `[]`
   - Still a namespace/index issue
2. **LLM gets "No relevant context found"**
   - Vector search failed
3. **Error in trace**
   - API key or configuration issue

## Current Fixes Applied

### Fix 1: TextKey Mismatch (Deployed)
**Before:**
```typescript
vectorStore = new PineconeStore(embeddings, {
  textKey: 'text',  // ❌ Wrong! Embeddings use 'content'
```

**After:**
```typescript
vectorStore = new PineconeStore(embeddings, {
  textKey: 'content',  // ✅ Matches embeddings.ts
```

### Fix 2: Namespace Mismatch (Deployed)
**Before:**
```typescript
  namespace: 'messages',  // ❌ Wrong! Embeddings use default
```

**After:**
```typescript
  // No namespace  // ✅ Uses default like embeddings.ts
```

### Fix 3: LangSmith Enabled (Deploying Now)
**Added to functions/.env:**
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_api_key_here
LANGCHAIN_PROJECT=pr-gripping-semiconductor-66
```

## Troubleshooting with LangSmith

### Problem: Still Getting 0 Documents

**Check in LangSmith Trace:**
1. Click on the "Pinecone Query" step
2. Look at "Results" field
3. If empty `[]`:
   - Check if index name is correct
   - Check if namespace matches
   - Verify embeddings were actually stored

### Problem: No Traces Appearing

**Possible Causes:**
1. Deployment not complete yet (wait 1-2 minutes)
2. Environment variables not loaded
3. LangSmith API key incorrect

**Debug:**
Check Firebase logs for LangSmith initialization:
```bash
firebase functions:log | grep -i "langchain\|langsmith"
```

### Problem: Traces Show Error

**Click on the failed step** to see exact error message and fix accordingly.

## Quick Reference

| What | Where |
|------|-------|
| **LangSmith Dashboard** | https://smith.langchain.com |
| **Your Project** | pr-gripping-semiconductor-66 |
| **Firebase Logs** | `firebase functions:log` |
| **Test Query** | "Any mention of rest api in the chats" |

## Next Steps

1. **Wait for deployment to complete** (~1-2 minutes)
2. **Test a query** in the AI Assistant
3. **Open LangSmith** to view the trace
4. **Verify** Pinecone is returning results
5. **Debug** any remaining issues using trace details

**LangSmith will show you EXACTLY what's happening!** 🔍
