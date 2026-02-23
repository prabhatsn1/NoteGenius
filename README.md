# NoteGenius

**Offline-first Voice Notes + AI Summarizer + Flashcards** – a React Native (Expo) app built with TypeScript.

Record voice notes, get automatic transcription, generate meeting-style summaries with the local NLP pipeline, and study auto-generated flashcards using spaced repetition.

---

## Features

| Feature                  | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| **Voice Recording**      | Record with pause/resume, waveform visualization, metering  |
| **Live Transcription**   | On-device speech-to-text via `@react-native-voice/voice`    |
| **Type While Recording** | Add typed segments alongside voice segments                 |
| **AI Summarization**     | TL;DR, key points, decisions, action items, open questions  |
| **Einstein Panel**       | Highlights, topics, follow-ups, sentiment timeline          |
| **Flashcards**           | Auto-generated Q&A, cloze, term-def cards from summaries    |
| **Spaced Repetition**    | SM-2 algorithm with Again / Hard / Good / Easy ratings      |
| **Offline-First**        | All data in SQLite + MMKV – no internet required            |
| **Export / Import**      | JSON export with share sheet, schema-validated import       |
| **Multi-Language**       | 8 language options for STT (en, hi, es, fr, de, ja, zh, ar) |
| **Dark Mode**            | Automatic light/dark theme based on system preference       |

---

## Tech Stack

- **Expo SDK 54** / React Native 0.81 / React 19
- **expo-router v6** – file-based navigation
- **Zustand v5** – state management (5 stores)
- **expo-sqlite** – structured offline storage (WAL mode)
- **react-native-mmkv** – key-value settings storage
- **expo-audio** – audio recording & playback
- **@react-native-voice/voice** – speech-to-text
- **expo-notifications** – flashcard review reminders
- **Custom NLP pipeline** – TextRank, lexicon sentiment, rule-based extraction
- **TypeScript strict mode**

---

## Project Structure

```
app/                         # expo-router file-based routes
  _layout.tsx                # Root layout (DB init, setup gate)
  (tabs)/
    _layout.tsx              # Tab bar (Record, Notes, Flashcards, Settings)
    index.tsx                # → RecordScreen
    notes.tsx                # → NotesScreen
    flashcards.tsx           # → FlashcardsScreen
    settings.tsx             # → SettingsScreen
  note/
    [id].tsx                 # → NoteDetailScreen (dynamic route)
src/
  types/models.ts            # All TypeScript interfaces & types
  constants/theme.ts         # Colors, spacing, font sizes
  utils/                     # uuid, time formatting, permissions
  data/
    database.ts              # SQLite initialization & schema
    repos/                   # Repository pattern (Notes, Segments, Summaries, Flashcards, Settings)
  store/                     # Zustand stores (user, settings, notes, recording, flashcards)
  services/
    ai/                      # AI provider architecture
      AiProvider.ts          # IAiProvider interface
      index.ts               # Factory: makeAiProvider(which, apiKey)
      useAi.ts               # React hook for components
      offline/OfflineProvider.ts  # On-device NLP provider
      gemini/GeminiProvider.ts    # Google Gemini API provider
    audio/recorder.ts        # AudioRecorder & AudioPlayer
    stt/sttProvider.ts       # Speech-to-text provider interface
    nlp/                     # TextRank, sentiment, summarizer, SRS, flashcard generator
    export/exportService.ts  # JSON export/import
    notifications/scheduler.ts
  components/                # WaveformView, SegmentsList, SummaryView, EinsteinPanel, FlashcardCard
  screens/                   # All screen components
  __tests__/                 # Unit tests (SRS, TextRank, sentiment, flashcards, time utils)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- iOS Simulator (Xcode) or Android Emulator (Android Studio)

### Install

```bash
# Install dependencies (use --legacy-peer-deps if React 19 peer conflicts arise)
npm install
# or
npm install --legacy-peer-deps
```

### Run

```bash
# Start Expo dev server
npx expo start

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android
```

### Prebuild (native projects)

```bash
npx expo prebuild
```

### Run Tests

```bash
npm test
# or watch mode
npm run test:watch
```

---

## Permissions

The app requests these permissions at runtime with user-friendly prompts:

| Permission         | Platform      | Purpose                    |
| ------------------ | ------------- | -------------------------- |
| Microphone         | iOS & Android | Voice recording            |
| Speech Recognition | iOS           | On-device transcription    |
| Notifications      | iOS & Android | Flashcard review reminders |

**iOS** – configured in `app.json` → `expo.ios.infoPlist`:

- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`

**Android** – configured in `app.json` → `expo.android.permissions`:

- `RECORD_AUDIO`

---

## AI Provider Switching

NoteGenius supports two AI providers for summarization and flashcard generation, selectable in **Settings → AI Provider**:

### 1. Offline (default)

Pure JS NLP pipeline. Works **fully offline** with zero network access.

- **TextRank** extractive summarization (TL;DR, key points, highlights)
- **Rule-based extraction** (decisions, action items, open questions, follow-ups)
- **Keyword clustering** for topics
- **Lexicon-based sentiment** per segment
- **Flashcards**: Q&A, cloze, term-def, def-term auto-generated from summary

### 2. Gemini (cloud)

Abstractive summarization and flashcard generation powered by **Google Gemini 2.0 Flash**.

- Requires the user's own Gemini API key (obtained from [Google AI Studio](https://aistudio.google.com/apikey))
- API key is stored **encrypted on-device** using `expo-secure-store` (system keychain) — never in MMKV or plain text
- Only the **transcript text** and user name are sent to Google's API — no audio, phone number, or profile data
- Automatic **chunking** for long transcripts (> 12 000 chars) with multi-chunk merge
- If Gemini fails (network error, bad key, quota), the app **automatically falls back to Offline** with a user-visible alert
- A one-time **privacy consent modal** is shown when first selecting Gemini

### Privacy

A permanent privacy notice is displayed on the Settings screen. When Gemini is selected:

> _Only the transcript text is sent to Google's Gemini API. No audio files, profile data, or phone numbers are ever transmitted. Your API key is encrypted on-device and never synced to any server._

All summaries and flashcards (regardless of provider) are stored **locally in SQLite**.

---

## Spaced Repetition (SM-2)

Flashcards use a simplified SM-2 algorithm:

- **Again (0)** – Reset repetitions, review immediately
- **Hard (3)** – Short interval increase
- **Good (4)** – Standard interval increase
- **Easy (5)** – Large interval increase, boost easiness factor

Cards are auto-generated from note summaries in 4 types:

- **Q&A** – Key points as question/answer pairs
- **Cloze** – Important terms masked in context sentences
- **Term → Definition** – Topic matched to relevant key point
- **Definition → Term** – Reverse of above

---

## Data Storage

| Store                                  | Technology                 | Content                                 |
| -------------------------------------- | -------------------------- | --------------------------------------- |
| Notes, Segments, Summaries, Flashcards | **expo-sqlite** (WAL mode) | Structured records with indices         |
| User Profile, App Settings             | **react-native-mmkv**      | Key-value preferences                   |
| Gemini API Key                         | **expo-secure-store**      | Encrypted in system keychain            |
| Audio Files                            | **expo-file-system**       | `.m4a` recordings in document directory |

All data is local. Nothing is sent to any server unless the user explicitly enables the Gemini provider and enters their own API key.

---

## License

Private project – not licensed for redistribution.
