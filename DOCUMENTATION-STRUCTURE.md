# Documentation Structure

## Project Documentation Organization

This document describes the organization of all documentation files in the ChatIQ project.

## Directory Structure

```
/
├── README.md                    # Main project README
├── CLAUDE.md                    # AI assistant guidance
├── DOCUMENTATION-STRUCTURE.md   # This file
│
├── docs/                        # Primary documentation
│   ├── INDEX.md                 # Documentation index
│   ├── ai-features/            # AI feature documentation
│   ├── bug-fixes/              # Bug fix records
│   ├── deployment/             # Deployment guides
│   ├── error-fixes/            # Error resolution guides
│   ├── features/               # Feature documentation
│   ├── pr-summaries/           # Pull request summaries
│   ├── progress/               # Progress tracking
│   ├── reference-cards/        # Quick reference guides
│   ├── setup-guides/           # Setup instructions
│   ├── testing/                # Testing guides
│   └── troubleshooting/        # Troubleshooting guides
│
├── memory-bank/                 # Development memory/context
│   ├── README.md               # Memory bank overview
│   ├── MessageAI.md            # Product overview
│   ├── MessageAI Rubric.md    # Grading rubric
│   ├── RUBRIC-TASK-LIST.md    # Task checklist
│   ├── code-architecture.md   # Architecture overview
│   ├── product-requirements.md # Product requirements
│   ├── task-list-prs.md       # PR task list
│   ├── testing-checklist.md   # Testing checklist
│   │
│   ├── ai-features/            # AI feature implementations
│   │   ├── MVP-AI-FEATURES-COMPLETE.md
│   │   ├── AI-SDK-IMPLEMENTATION-COMPLETE.md
│   │   ├── LANGCHAIN-MODEL-ANALYSIS.md
│   │   └── ...
│   │
│   ├── iqt/                    # IQT Mode documentation
│   │   ├── IQT-MODE-IMPLEMENTATION.md
│   │   ├── IQT-MODE-READY.md
│   │   ├── IQT-MODE-TESTING-GUIDE.md
│   │   └── ...
│   │
│   ├── search/                 # Search feature documentation
│   │   └── SEARCH-BAR-REMOVAL.md
│   │
│   ├── ui-improvements/        # UI/UX improvements
│   │   ├── CHAT-SCROLL-FIX.md
│   │   ├── CHAT-UX-IMPROVEMENTS.md
│   │   ├── TAB-BAR-VISIBILITY-FIX.md
│   │   └── ...
│   │
│   ├── fixes/                  # Various fixes
│   │   ├── FIRESTORE-PATH-FIX.md
│   │   ├── PDF-UPLOAD-FIX.md
│   │   └── ...
│   │
│   ├── sessions/               # Development session records
│   │   ├── CONVERSATION-HISTORY-FEATURE.md
│   │   ├── PROJECT-TOOLS-REORGANIZATION.md
│   │   └── ...
│   │
│   ├── testing/                # Testing documentation
│   │   ├── QUICK-TEST-GUIDE.md
│   │   ├── AI-FEATURE-TESTING-GUIDE.md
│   │   └── ...
│   │
│   ├── archive/                # Archived documentation
│   ├── bug-fixes/              # Bug fix records
│   ├── deployment/             # Deployment records
│   ├── implementation-notes/   # Implementation details
│   └── setup-guides/           # Setup guides
│
└── aws/lambda/README.md         # AWS Lambda documentation

```

## Documentation Categories

### Root Level
- **README.md** - Main project README with setup instructions
- **CLAUDE.md** - Instructions and context for Claude AI assistant
- **DOCUMENTATION-STRUCTURE.md** - This file, explaining the organization

### /docs - Primary Documentation
Organized, current documentation for all aspects of the project:
- **ai-features/** - AI feature implementation guides
- **bug-fixes/** - Records of bug fixes
- **deployment/** - Deployment instructions and checklists
- **error-fixes/** - Solutions to common errors
- **features/** - Feature documentation and plans
- **pr-summaries/** - Pull request summaries (PR1-PR10)
- **progress/** - Project progress tracking
- **reference-cards/** - Quick reference guides
- **setup-guides/** - Environment setup instructions
- **testing/** - Testing guides and plans
- **troubleshooting/** - Problem-solving guides

### /memory-bank - Development Context
Historical context and reference materials for development:
- **Core Files** - Architecture, requirements, task lists
- **ai-features/** - AI implementation records
- **iqt/** - IQT Mode (Intelligent Quick Type) documentation
- **search/** - Search feature development
- **ui-improvements/** - UI/UX improvement records
- **fixes/** - Various fix documentation
- **sessions/** - Development session summaries
- **testing/** - Testing guides and results
- **archive/** - Archived/historical documentation

## Quick Access

### For New Developers
1. Start with `/README.md`
2. Read `/CLAUDE.md` for AI context
3. Check `/docs/setup-guides/` for environment setup
4. Review `/memory-bank/code-architecture.md`

### For Testing
1. `/memory-bank/testing/QUICK-TEST-GUIDE.md`
2. `/docs/testing/` for specific test scenarios
3. `/memory-bank/iqt/IQT-MODE-TESTING-GUIDE.md` for IQT testing

### For AI Features
1. `/memory-bank/ai-features/MVP-AI-FEATURES-COMPLETE.md`
2. `/docs/ai-features/` for implementation details
3. `/memory-bank/iqt/` for IQT Mode specifics

### For Deployment
1. `/docs/deployment/PRODUCTION-CHECKLIST.md`
2. `/docs/deployment/` for Firebase deployment
3. `/memory-bank/deployment/` for deployment history

## Naming Conventions

- **UPPERCASE-WITH-DASHES.md** - Important documents, guides, summaries
- **lowercase-with-dashes.md** - Regular documentation files
- **PR#-*.md** - Pull request related documents
- **INDEX.md** - Directory index files
- **README.md** - Standard readme files

## Last Updated
- Date: 2025-10-26
- Organization includes search feature implementation documentation
- IQT Mode fully documented in memory-bank/iqt/