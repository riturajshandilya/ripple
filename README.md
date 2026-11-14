# Ripple

Offline-first macOS menu-bar voice dictation app with local Whisper transcription, optional cloud/local text formatting, and Accessibility-guarded insertion.

## Architecture

- **Native macOS Host (`native/macos/`):** Menu-bar app using `AVFoundation` for push-to-talk recording, a 3-tier SwiftUI/AppKit interface (Ambient Liquid Droplet v2, Whisper Toast, Ripple Hub), and Accessibility APIs (`FocusedTarget.swift`) for safe focus-checked Command-V delivery and selected-text transformation.
- **Local Transcription (`src/speech/`):** Runs `/opt/homebrew/bin/whisper-cli` against `.voice-models/ggml-small.bin` with auto-detect or 32 manual languages and an optional English-only guard.
- **Dictation Worker & History (`src/dictation/`):** Processes audio, applies Raw / Plain / Email / Code modes and script/translation options via `DICTATION_FORMATTER_ORDER` (Groq, OpenRouter, or local Ollama fallback), and persists text-only history in `data/dictations.sqlite` (`better-sqlite3`).

## Prerequisites

- macOS 14+ with Xcode Command Line Tools
- Homebrew `whisper-cpp` (`whisper-cli`) and `.voice-models/ggml-small.bin`
- Node.js 20+ (nvm recommended)

## Setup & Build

```sh
npm ci
cp .env.example .env
chmod 600 .env
npm run app:build
```

Open `dist/Ripple.app` and grant **Input Monitoring**, **Accessibility**, and **Microphone** permissions in System Settings → Privacy & Security.

## Usage

- Hold **Control + Option**, speak, and release to transcribe and paste into the focused field.
- Select text and dictate an explicit transformation command (e.g., _"transform this into a structured email"_) to rewrite or copy-only transform read-only selections.
- Click the menu-bar droplet to open the **Ripple Hub** (Transcripts, Style & Language, System & Access).

## Testing

```sh
npm test
npm run test:mac-focus
npm run test:mac-browser
```
