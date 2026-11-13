# Progress

## Reconstructed baseline on macOS

The Ubuntu source was unavailable; this is a new implementation based on the user's description, not a transfer of the original code. The user reported that the earlier Ubuntu Groq-to-Echo flow worked; its exact utterance and model state were not independently verified.

A clean cached `npm ci --offline --ignore-scripts`, local TypeScript build and three mocked tests passed: local health, rejection of an unsigned Alexa request, escaped answer and session closure, and generic provider failure. These do not establish live Alexa signature validation, Groq connectivity, latency, or physical Echo behavior. The reconstructed model has not been built in the Alexa console. The server ends the session after an answer; multi-turn state, persistence, memory and tools are not implemented.

Remaining: configure the skill ID and provider key locally, confirm provider cost, install and start cloudflared, update the existing skill endpoint, test simulator and physical Echo, and record actual outcomes before starting multi-turn work.

## Live Mac checks

User provided the existing skill ID and authorized using a clipboard key; local `.env` was created with mode 600. A direct Groq request answered 4 in 834 ms. The running server returned 200 for local health and 400 for an unsigned Alexa request. cloudflared was installed with Homebrew. A Quick Tunnel was created but could not connect to Cloudflare's edge; its pre-check reported UDP/QUIC and TCP/HTTP2 connectivity failures and public requests returned 530. The failed tunnel was stopped. No public endpoint, simulator, or physical Echo test has succeeded yet. Check network access to Cloudflare Tunnel port 7844 and retry; do not use the failed temporary URL.

After the user disconnected the VPN, a new Quick Tunnel connected successfully. Public `/health` returned 200 and an unsigned public `/alexa` POST returned 400. The temporary URL and server are process-dependent; simulator and Echo tests still await updating the Alexa endpoint and testing by the user.

## Multi-turn implementation

User reported that the baseline worked in the simulator and on Alexa. Multi-turn context is now implemented in memory: up to five turns per session, 100 sessions, and a 10-minute idle TTL with cleanup on access. Stop and session-ended requests clear state; failed turns do not enter history. The server restart clears all state. Eight local tests and the TypeScript build passed; public health and unsigned-request rejection passed after restart. Multi-turn simulator and physical Echo verification remain pending. No persistent history, personal memory, or tools have been added.

The user reported that the multi-turn interaction worked well on Alexa. The exact utterances and response were not independently inspected.

## SQLite history

Successful turns now persist to a private, Git-ignored SQLite file with 30-day default inactivity retention. Inspection and deletion are local CLI commands; active model context remains in memory and history is not automatically retrieved. FileVault was on and macOS reported no configured Time Machine destinations when checked. Automated tests cover reopen persistence, session isolation, transaction rollback, retention and cascading deletion; twelve tests and the build passed. A live Echo-to-history test remains pending.

After the server restart, a live database check found one conversation with ten messages; public health returned 200. The check did not inspect message contents or independently identify the Alexa device that generated them.

## Local history text search

Added SQLite FTS5 search, transactional schema migration and indexing for existing and new messages. Deletion, updates and retention synchronize the index. Search is currently a local CLI command and is not connected to Alexa or an LLM. The build and 15 automated tests passed, including migration, ranking and deletion. The user's existing database was migrated to schema version 2, retained 14 messages, and a search using a word from existing data returned matches without printing conversation contents. Retrieval quality and Alexa integration are not yet evaluated.

## Explicit history questions

Rule-based routing and keyword extraction now search history for supported explicit past-conversation phrases; ordinary questions use the normal path. Matching messages and adjacent context are bounded and sent to the provider as untrusted evidence. No match receives a local response. Nineteen local tests passed. A live Groq test with synthetic evidence returned the expected topic in 1,010 ms. A local check confirmed the original India population question appears in retrieved evidence, without printing its text. Alexa simulator and Echo verification are pending; rule routing, exact-word retrieval, and generated answers can fail.

## LLM routing experiment

Added structured-output LLM routing with application-side validation, a shared six-second handler deadline, a 2.5-second router cap, clarification, and an optional rules baseline. Routing sends bounded recent context to the configured provider. In one six-case synthetic live Groq run after prompt refinement, the LLM matched all six expected routes; the earlier prompt made a follow-up routing error, demonstrating variability. These cases are a small development set, not a production accuracy estimate. Device testing remains pending.

## Voice interaction refinements

Voice-specific answer instructions now apply to both direct and retrieved answers, even with a custom system prompt. A synthetic live Groq response was speech-oriented; model formatting is not guaranteed. A candidate model adds five natural carrier intents and the backend restores their words; 25 local tests passed. Alexa documentation supports wake-word interruption. The candidate model has not yet been built in the developer console, and interruption, recognition and spoken output remain unverified on the Echo. The backend stores the complete generated answer and cannot infer what part was heard.

Added a candidate RememberIntent for “do you remember …” and backend phrase restoration. A mocked test verifies that the reconstructed utterance reaches the router and clarification can keep the session open. The build and 26 tests passed. The console model build and simulator/Echo recognition remain unverified; the cause of the user's earlier failed utterance has not been independently established.

Expanded the candidate Alexa model with 20 additional natural carrier openings, including “can you,” “could you,” and “would you like.” Backend handler tests cover reconstructing these openings across multiple turns; the build and 28 local tests passed. These are simulated Alexa requests, not speech-recognition tests. The model has not been rebuilt or tested in the Alexa console for this change, and similar phrases may overlap or resolve unpredictably.

At the user's request, expanded the candidate model to 200 distinct carrier samples (202 total intents), with 170 new carriers generated from a maintained JSON list. The backend has a matching generated mapping. Local tests exercised all 170 new intent handlers with mock Alexa requests; 29 tests and the build passed. This does not establish Alexa model acceptance, intent selection, or physical recognition. A console model build, utterance profiling and Echo tests remain pending; overlapping samples are an explicit risk.

## Reduced model

Removed 62 generated longer carrier phrases that begin with another existing carrier. The current candidate has 138 carrier samples, 140 intents and 135 slot declarations (275 if counted together), plus no custom slot types. The shorter sample may capture the remaining words as the slot, but Alexa recognition is unverified. Stable intent names are retained and legacy handlers cover the previous candidate. The generator enforces a conservative limit under 350 declarations; 29 local tests and the build passed. Console build and device tests remain pending.

## Personal memory foundation

Added an explicit local-only memory table and separate FTS index in schema version 3, with CLI add, list, search, correction, and delete. Memories are retained until explicitly deleted, independently of conversation retention. They are not automatically created from conversations, retrieved during Alexa requests, or sent to the model. Version 2 migration and persistence, update, deletion and index behavior passed local tests. The live database migrated to version 3; it contained six conversations afterward and no personal memories were created. Preservation was verified in an isolated migration test.

A separate model-based memory decision prototype and four synthetic cases were added; a live Groq run got 2 of 4 expected actions, incorrectly requesting clarification for two cases that should search. It is not connected to Alexa and needs improvement and broader evaluation. The build and 33 local tests passed.

## Extraction-only prototype

Added a separate structured-output memory extractor and synthetic-only `npm run eval:extraction` command. It has no database access and is not connected to Alexa. Validation checks bounded fields, schema values and an exact current-user-message source substring, but does not establish semantic correctness. Build and 36 automated tests passed. In one live Groq run the candidate-versus-empty count matched 7 of 8 cases: a hypothetical about someone else was incorrectly extracted as the user's preference. The correction produced a candidate marked `new` instead of `correction`; some content was too terse to be standalone. Results vary and this small fixture is not a reliability estimate. Automatic memory insertion remains disabled.

## Automatic extraction and local semantic retrieval

Added schema version 4, durable background extraction jobs for newly saved turns, automatic unverified memories with source-message IDs, and local Ollama embeddings cached in SQLite. Auto extraction is enabled by default and sends each new turn plus bounded context to the provider; it is not a backfill. Corrections do not overwrite older memories. Keyword matching uses SQLite FTS; vector retrieval uses a linear cosine scan over at most 500 recent records. A synthetic local semantic fixture ranked workout preference first for exercise (0.721), but a separate live extraction-to-search run produced 0.59 and missed the experimental 0.65 threshold; model output varies and the score is not calibrated. First model load was about 9.5 seconds, exceeding the per-turn lookup timeout. 44 automated tests and build passed. Live Alexa extraction and recall still need a user device test.

The version 4 migration was applied to the live database; it started with zero memories and zero extraction jobs. The new backend is running. The previous Quick Tunnel had expired; a fresh tunnel passed public health (200) and unsigned-request rejection (400). No real Alexa extraction or memory recall has yet been verified for this milestone.

## Semantic conversation history

Added SQLite schema version 5 with cached conversation-message vectors, a local Ollama background indexer, and hybrid keyword plus semantic history retrieval. Semantic search covers at most 500 recent messages and uses an experimental 0.65 cosine threshold; FTS can search older messages. Reciprocal rank fusion combines rankings and neighboring turns are returned. Search falls back to keyword matches if vectors are unavailable and reports incomplete search if no evidence is found while indexing is incomplete. A synthetic Ollama run found a workout conversation for “exercise,” found a coffee conversation, and returned no result for “saturn.” The build and 51 automated tests passed. Real Alexa testing and broader semantic quality evaluation remain pending. Added docs/ripple-flow.mmd with the end-to-end flow.

The live database migrated to schema version 5. At the time of verification, all 120 existing messages had cached history vectors; a local hybrid query returned matching conversations without printing their contents. The public endpoint returned health 200 and rejected an unsigned request with 400. The Mermaid source was created but has not been rendered in a Mermaid viewer.

## Always retrieve and SQLite vector search

Implemented default `ANSWER_FLOW=always_retrieve`: one local query embedding, thresholded history and memory retrieval plus FTS history, then one answer-model call. The older classifier-first flow remains available with `ANSWER_FLOW=routed`. Added SQLite `sqlite-vec` v0.1.7 virtual tables and schema version 6; distance <= 0.35 filters vector hits inside SQLite, with bounded top-k. The installed implementation is a native exact scan, not an ANN index; FTS hits are independent of the threshold. Local tests cover thresholding, deletion, update invalidation, backfill, one embedding and bypassing the classifier. One synthetic Ollama retrieval run found exercise and coffee and returned no context for Node deployment or Saturn. The fixture is small and does not establish production accuracy; real Echo testing is pending. Updated the Mermaid source to reflect this flow.

The live database migrated to schema version 6: 120 existing JSON history vectors were backfilled to 120 sqlite-vec rows; there were no memory vectors at migration. The backend is running in always-retrieve mode; public health returned 200 and an unsigned request returned 400. A synthetic SDK-to-Groq flow used a retrieved workout preference and responded in 337 ms. This was not an Echo test. All 56 automated tests passed.

## Live memory verification

After a user-reported Alexa conversation, checked the latest saved turn metadata and confirmed two automatically extracted, unverified memories were stored with source-message IDs and local vector entries. All three extraction jobs for that conversation completed. The saved India-history response was present, but no per-request retrieval trace exists to prove which records the answer model received. The workout-related response said the detail was not stored even though the background job saved it afterward; extraction runs asynchronously after the turn.

## Mac-first direction and shared core

The goal is a Mac voice assistant with Alexa as an additional adapter. Extracted the existing conversation, retrieval, provider and persistence orchestration from the Alexa handler to `src/core/assistant.ts`; Alexa still handles its own request and speech formatting. The existing six-second Alexa deadline remains in the shared core pending per-adapter configuration. No Mac microphone, speech recognition, speech synthesis, cancellation, or computer-control tools have been implemented. The build and 58 automated tests passed, including new direct core tests and mocked Alexa handler tests. No live Alexa or Mac audio test was performed after this refactor, and an already-running server must be restarted to use it.

Outstanding issues for the next milestones: the assistant has previously given an impression that a spoken memory correction was applied when the old preference remained; memory changes need explicit, verifiable update behavior. Automatic extracted memories remain unverified, may conflict, and are saved asynchronously, so immediate recall can miss them. Spoken answers can still contain unsuitable formatting or ignore requested constraints. There is no per-request retrieval trace to establish which records were used. Preserve these concerns when adding a Mac adapter, and measure recognition, playback latency, and interruption behavior on the actual Mac before claiming they work.

## Mac push-to-talk prototype

Added a terminal push-to-talk adapter using local Whisper.cpp multilingual `small` and Mithi CPU speech synthesis, with the existing assistant core, retrieval and SQLite history. The model runtime is installed in a project-local Python virtual environment and model directory; Homebrew installed whisper.cpp and its dependencies. The installed Xcode command-line tools could not compile a Swift recorder because its compiler and SDK were mismatched, so capture uses Python sounddevice and the already-installed PortAudio. The Alexa backend and tunnel were not restarted or changed.

A synthetic English sample transcribed correctly in approximately 6.35 seconds. Mithi generated English, Hindi and mixed-script WAVs in approximately 13.42, 5.03 and 5.86 seconds respectively in separate cold-start runs; output quality and real-world latency were not assessed. No microphone, human voice, Groq call, full live Mac conversation or Echo regression was tested for this milestone. Devanagari selects Hindi output and all other scripts select English; Hinglish detection and pronunciation are not verified. The client does not provide emotion control or playback interruption. The speech-ready prompt now avoids identifying Alexa and tells the model not to claim unconfirmed actions, but prompt compliance is not guaranteed. The core retains its six-second answer budget. Audio temporary files can remain after a forced exit or crash. Existing background workers are needed for automatic extraction and embedding jobs.

## Global hold-to-talk shortcut

Replaced the Return-key recording interaction with a passive macOS modifier event tap: holding Control and Option begins recording, and releasing either ends it. It observes modifier changes only, does not consume keystrokes, requires a fresh release before another hold, and ignores holds while the client processes a turn. Recordings under 0.25 seconds are discarded and recording stops at 45 seconds. Input Monitoring and microphone permission may be required; Control + Option can overlap other applications' shortcuts.

Two Python tests verified key-state transitions, including both press orders, release and repeat prevention. The 59 Node tests and build passed. In this session, the local Python process reported Input Monitoring authorization and the global listener started and shut down cleanly without recording. No physical key hold, microphone recording, live Groq call, or full spoken conversation was tested.

## Hold-to-talk live diagnosis

The user reported that the shortcut initially did nothing. No voice client was running at the time; an earlier listener smoke test had been stopped. After starting the client, process output showed Control + Option triggered recording, release triggered transcription, and the pipeline reached answer and local speech preparation. It returned to waiting for a new hold, showing at least one playback process exited successfully. This does not establish what was spoken or that the user heard it; no conversation content was inspected. The listener is process-dependent and must be running for the shortcut to work.

## Explicit memory corrections

The user reported that Mac voice interaction works. The earlier automatic extractor still stores correction candidates separately, so it can leave conflicting facts and cannot confirm an update during the same answer. Added a deterministic shared-core command, “update memory for <exact topic> to <new value>,” for Mac and Alexa requests that reach the backend. It updates exactly one matching memory transactionally, confirms only after the update, reports missing or ambiguous topics, records the prior value in a revision table, and skips background extraction for the command. Existing pending extraction cannot add another automatic value for an exactly matching manually corrected topic. The policy does not resolve differently named topics or make free-form corrections reliable. Source transcripts can be misrecognized, and a spoken confirmation is not proof the user intended the recognized text.

Schema version 7 adds revisions; updating or deleting a memory invalidates old embeddings or deletes revisions respectively. Literal memory search can return a corrected value while vector indexing catches up; FTS matches do not use the vector threshold. The build, 64 Node tests including a mocked Alexa request, and two Python hotkey tests passed. The actual database migrated from version 6 to 7, retaining two memories; no real correction was applied during verification. Local health returned 200 and both the backend and Mac listener were started. No live voice correction, physical Echo regression, public tunnel, or Groq provider call was verified for this change. Alexa recognition, speech formatting, retrieval observability, and interruption remain open.

Added privacy-conscious diagnostics for the default always-retrieve path: elapsed retrieval time, history and memory result counts, and completeness flags, with no question, answer, identifiers, or record content. The Mac client prints the summary and the server uses structured logs. Tests cover the metadata shape and verify private fixture text is absent. Routed mode has no equivalent trace, and the summary does not prove the model used a record. The build and 65 Node tests passed. Existing running processes loaded the previous build and require a restart to enable this diagnostic change; live correction testing is still pending.

## Confirmed memory tool proposals

Added one local `propose_memory_update` tool to Groq's default always-retrieve answer call. Retrieved memories now include IDs; application validation requires the proposed ID to be among the retrieved records, checks the exact-topic group in SQLite, and constructs a review of its current values and the requested replacement. The in-memory proposal is tied to the session, expires after two minutes, and is cleared by cancellation, an unrelated reply, session end, or restart. An explicit confirmation executes a synchronous SQLite transaction only after rechecking the entire reviewed group. Same-topic records are merged, previous values and prior revisions are retained, stale proposals are rejected, and success is reported only after commit. The prior deterministic exact-topic command now uses the same review and confirmation. The ordinary automatic extraction flow can still add unverified records when an utterance is not recognized as a tool proposal; differently named topics can also conflict.

The local Alexa model adds built-in Yes and No intents and the handler forwards them to the shared core. The developer-console model has not been updated or rebuilt, and a real Echo confirmation is not verified. Natural language tool calling is currently enabled for Groq and always-retrieve only; optional OpenAI and routed mode remain answer-only. No vector tool registry or MCP has been added. The build and 72 Node tests passed, including a mocked Groq HTTP response, conflict merging, no write before confirmation, cancellation, expiry, replay, session isolation and end, malformed proposals, stale state, and mocked Alexa Yes. The backend and Mac listener were restarted; local health returned 200. No live Groq tool call or spoken confirmation has been verified for this milestone, and no real memory was changed by the implementation tests.

## Follow-up retrieval failure

The user asked to inspect a failed Mac voice test. The saved transcript showed a favorite-drink question followed by an update request transcribed as “mount and view”; whether the user intended a different drink name was not independently established. The assistant asked for clarification and made no confirmed update. Retrieval diagnostics showed two memories on the first turn but zero on the pronoun follow-up. The prior implementation searched the follow-up without the earlier question, so the model did not receive a usable memory ID.

Retrieval now includes up to two prior user questions for short or referential follow-ups in local embedding and memory lexical search. This heuristic may include unrelated context and is not a general coreference solution. Tests reproduce the two-turn favorite-drink scenario with a mocked tool proposal, confirmation and in-memory database; the build and 75 Node tests passed. The backend and Mac listener were restarted, but the change and speech recognition have not yet been reverified on a real spoken retry.

## Voice-flow diagnosis, timing, and Groq model trial

The user requested review of the latest conversation. The transcript included a non-speech music caption that the model treated as a real command and falsely claimed to stop music. A later unspecific request to update a favorite drink caused the model to propose an older misrecognized value, and a subsequent request specifying a different value was discarded while a proposal was pending. No confirmed memory update occurred in that exchange.

Added a backend guard requiring a model-proposed replacement value to occur in the current transcript, and updated the prompt to request an exact phrase. Unrecognized replies cancel the previous proposal and are processed as a new request. Known bracketed non-speech captions are skipped, and the system prompt states that music and Mac control are unavailable; this does not guarantee that speech transcription or model claims are correct. Added content-free, owner-only rotating Mac timing logs in `data/performance.jsonl` for recording, STT, retrieval, provider call, overall assistant, synthesis and playback; assistant time overlaps retrieval and provider time. Tests cover the reported cases and timing privacy. The build and 80 Node tests passed.

The user confirmed the Groq account is free. A small live synthetic comparison sent four cases each to the existing 20B model and 120B: 20B passed two checks and 120B passed four according to the comparison's simple criteria. This is not a general quality benchmark. A separate live synthetic 120B-to-tool smoke test in an in-memory SQLite database proposed a change in 714 ms, left it unchanged before confirmation, and updated it after confirmation. No real personal memory was altered by that smoke test. Changed `GROQ_MODEL` to `openai/gpt-oss-120b` for a trial and restarted the backend and Mac listener; background extraction uses the same configured model. A short synthetic local run measured Whisper transcription at 0.85 seconds and cold-start Mithi generation at 6.05 seconds; these are single samples, not real-turn latency measurements. The restart interrupted an in-progress recording. Real spoken behavior with the new model and per-stage timing remain to be verified.

## Offline-first dictation direction

The user requested a Mac-first dictation app with raw and polished modes, context-appropriate formatting, local history and notes, optional Google Drive incremental sync, a future iOS app, and reusable speech adapters. The last assistant conversation contained a repeated clarification despite the user stating a new preference. Recorded per-turn metrics showed STT of 570–766 ms, retrieval of 60–89 ms, provider calls of 639–1,096 ms, and local speech generation of 5,384–8,200 ms; spoken playback took additional time. These are a few observations, not a benchmark. The user changed priority to dictation; the assistant correction issue remains open.

Created `docs/dictation-design.md` covering Mac permissions/focus safety, raw/offline/online boundaries, data models, Google Drive OAuth and proposed incremental sync/conflict handling, and iOS keyboard restrictions. Extracted shared Whisper and Mithi speech adapters and a local process runner. Added a dictation processing service supporting raw and polish modes, preserving raw recognizer output and falling back without implicit cloud access; the experimental formatter calls loopback Ollama with `qwen3:1.7b` only. No dictation app, field insertion, personal dictation storage, notes, OAuth, sync or iOS client is implemented.

Installed the local `qwen3:1.7b` model (about 1.4 GB). Three synthetic local formatter prompts took 2.34 seconds cold and 0.27/0.26 seconds warm; basic English cleanup succeeded, but the spoken variable description was not turned into code. This is not a quality benchmark. The build and 87 Node tests passed; standalone synthetic checks exercised the extracted Whisper and Mithi adapters, and a separate local synthetic test passed through Whisper plus raw and local-polish dictation modes. The running assistant has not been restarted for live regression of the refactor; no microphone, focused-field insertion, new personal-data storage, cloud API or sync was tested in this milestone.

## Dictation feasibility checks

Per the user's request, tested uncertain Mac and offline foundations before the next app milestone. The installed Xcode toolchain compiled and ran AppKit/AVFoundation when selected via `DEVELOPER_DIR`, without changing the global Command Line Tools selection. Accessibility and Input Monitoring were allowed for the test processes. A synthetic AppKit target accepted a caret insertion through `AXSelectedText`; its secure field exposed `AXSecureTextField`, and a focus switch was detected. An isolated Chrome test with forced renderer accessibility reported success for the AX setter but did not change the synthetic textarea. After checking that the same Chrome process was frontmost and the target was still focused, a targeted Unicode keyboard event did insert the test string. This establishes only controlled examples, not universal behavior or safe verification without reading user content.

With external network outbound blocked for the client and a separate Ollama server, a synthetic Whisper plus local Qwen dictation pipeline returned `polished`; loopback was allowed and a separate probe confirmed external outbound was denied. An initial test restricted loopback to the server port only and returned raw fallback because the server could not use its internal loopback runner; allowing loopback while blocking external connections fixed the isolated test. No physical microphone, complete app, real user field, Drive OAuth/sync, iOS device, or iOS simulator behavior was tested. Xcode reports the iOS SDK installed. Google OAuth and sync require the user's later account consent. A four-case local formatter check showed one code example formatted as code, but the email example remained an informal sentence; this is not a benchmark. See `docs/dictation-feasibility.md`.

Started the native implementation with `native/macos/FocusedTarget.swift`, which captures and revalidates the frontmost app, focused editable element and selection without reading field text or inserting. It rejects an identified secure field and fails closed on unsupported or changed targets. `npm run test:mac-focus` compiles using the installed Xcode toolchain and opens a disposable AppKit window; it passed initial capture, unchanged target, moved caret, changed focus and synthetic secure-field cases. This guard is not connected to an app and cannot guarantee detection of all third-party secure fields or eliminate a race between revalidation and insertion. Browser event insertion remains an isolated feasibility experiment, not production behavior.

## Mac dictation development app

Built an ad-hoc signed local development `dist/Ripple.app` using the Xcode toolchain and an explicit macOS 14 deployment target. It offers a menu-bar raw/local-polish selector, a floating bubble with real-time recording-level waveform and a post-release transcript, local AVAudioRecorder capture, the shared Node Whisper/Qwen worker, privacy-conscious timing events, focus and caret revalidation, single-line Unicode event delivery, and a copy-only fallback for unknown/changed focus, multiline text or uncertain delivery. There is no streaming speech recognition, personal dictation history, notes, Google OAuth, sync, iOS client or cloud formatter. Temporary private files are normally removed, but crashes can leave them. The assistant's Control + Option listener was stopped to avoid a shortcut collision.

Synthetic tests exercised raw and local-polish workers, and separate native and disposable Chrome fixtures verified multi-chunk English/Hindi key delivery. A direct preview of the app's bubble rendered, the `.app` passed `codesign --verify`, and the app launched. The initial bundle defaulted to macOS 28 and Launch Services refused it; rebuilding with explicit deployment target 14 fixed launch. The app's event tap was not active because its own Input Monitoring permission had not yet been granted. The user could not find the menu-bar permission option, so a direct bubble button was added and the Input Monitoring settings page opened; the user must still grant required permissions. No real microphone or end-to-end app insertion has been verified yet.

## Dictation history and compact controls

After the user reported dictation working but insertion failing, added privacy-safe capture/delivery status categories. The original native app ended recording at 45 seconds or on release of either shortcut key; the new limit is five minutes. Added a compact waveform that expands on click, and a local SQLite dictation history with a menu toggle and a window showing the latest 200 entries and a delete-all action. New records include raw and final text, timestamp and formatting metadata; audio is not stored in that database. The database is owner-only, without separate application-level encryption; backups can retain deleted data. Earlier dictations were not persisted.

The Node build and 90 automated tests passed; a controlled native focus fixture verified insertion of synthetic English/Hindi text and focus guards. The rebuilt app was launched, but the system event-tap query reported the shortcut listener disabled after the ad-hoc rebuild. Real microphone, history display and insertion in the user's field remain to be retested after macOS permissions; the reported insertion issue is not yet resolved or diagnosed. This is an incremental local app, not a completed notes, sync or iOS implementation.

## Single paste insertion

After user-reported partial, character-by-character insertion in a terminal, inspected the installed Wispr Flow bundle. Its JavaScript checks editability and delegates to a native helper's paste operation. Ripple now puts the transcript on the clipboard and sends one Command-V to the captured target process; it does not send Enter. The clipboard therefore contains the latest transcript after insertion. A controlled synthetic AppKit fixture did not verify this process-targeted paste, so it is not recorded as passing. The user subsequently reported that pasting worked in their active field; privacy-safe app metadata shows three recent delivery events marked sent. This is a user-reported real-app success plus an event-send status, not proof that every destination accepted all characters.

## Formatting mode clarification

The user reported Plain Polish producing email-style text. The native app passes its selected mode/style directly to the local worker; there is no focused-field/email auto-detection in the current app. The local Qwen formatter can still infer email style from email-like dictated content, so its prompt now makes the selected style authoritative and forbids adding email greeting/subject/signature in Plain mode unless dictated. Email mode requests explicit paragraph spacing. Newlines are allowed by paste validation for formatted output. Automated test coverage was run separately for the formatter contract; actual output quality still needs user testing.

## Configurable dictation formatter failover

The user approved cloud polishing and local fallback. Added OpenAI-compatible formatter adapters for Groq and OpenRouter, ordered failover across configured providers, and a local Qwen 14B fallback. Defaults are Groq, OpenRouter free routing through two separate keys, then local. The chain advances on failure rather than broadcasting each transcript. Raw mode bypasses all formatters. Two OpenRouter keys were obtained directly from clipboard into `.env` without displaying them; `.env` permissions are 0600. No live cloud API calls were made, so credentials, account limits, and provider reachability remain unverified. OpenRouter model is `openrouter/free`; free-tier quotas and availability can change. The local 14B formatter has a 45-second timeout. Automated tests cover provider payloads and failover; update README and evaluate the running app before claiming live cloud success.

## OpenRouter credential smoke test

Tested each OpenRouter key directly with synthetic text and did not reveal keys or output content. Key 1 returned HTTP 200 with usable text using `openrouter/free`; a later request returned HTTP 429. Key 2 returned HTTP 200 but the random free router selected a reasoning-only response with no usable text. Pinning `google/gemma-4-26b-a4b-it:free` with key 2 returned HTTP 200, usable text, and reported cost $0. Updated local `.env` and `.env.example` to pin that free model. Because both keys may share account-level quotas, key rotation does not guarantee more quota. Key 1 has not yet been verified against the pinned model due the 429. Synthetic tests only; no personal dictation text was sent.

## Second Groq key

The user provided the second Groq key via clipboard; it was detected and written directly to owner-only `.env` without displaying it. Added explicit ordered providers Groq key 1, Groq key 2, OpenRouter key 1, OpenRouter key 2, local Qwen. Both Groq entries use the configured model; both OpenRouter entries use their separately pinned free Gemma model. No API call was made during setup.

## Floating dictation orb UI

Replaced the rectangular waveform bubble with a bottom-center orb inspired by the official ElevenLabs UI Orb and Voice Button state patterns. The idle orb is 56 px and expands to 104 px while recording, with mic-level reactive glow/rings. Transcribing and polishing emit privacy-safe stage events over worker stderr and show an animated spinner with distinct status copy. Clicking the orb opens a transcript card with selectable formatted text, copy icon, raw-transcript toggle, and close control. Added synthetic UI preview modes and inspected both the orb and expanded card screenshots. Rebuilt the app successfully. These previews are synthetic; actual microphone/progress timing and user-device usability still need a live dictation test.

## Native Liquid Glass and compact permission prompt

Applied AppKit `NSGlassEffectView` on macOS 26+, with an `NSVisualEffectView` fallback for older macOS, across the orb and transcript/permission panels. Kept the Input Monitoring permission prompt and reduced it from the generic 400×250 card to a compact 330×142 layout with its explanation and Enable Access button. Verified a synthetic permission-state screenshot; the local Mac is macOS 27.2. App bundle builds successfully. Live TCC permission flow remains unchanged.

## Siri Sheet-style native orb

Replaced the previous flat gradient/ring orb with a native AppKit rendering modeled on the supplied Siri Sheet implementation. The orb uses the requested cyan/violet palette (`#82f4ff` / `#8e6cff`), a shaded spherical surface, four moving sheet bands, a soft glass highlight, and microphone-reactive energy while listening. Thinking animates more slowly; idle/ready continues a subtle ambient motion. Kept Ripple's compact 56 px idle and 104 px listening sizes because this is a floating macOS control, not a 168 px web demo. This is a native visual port rather than embedding React/WebGL into the Swift app, so it adds no runtime dependency and stays compatible with the existing AppKit glass panel.

`npm run app:build` completed with the project's Node 20 runtime and rebuilt `dist/Ripple.app`. The first attempt using Homebrew Node 26 could not launch because its `libsimdjson.33.dylib` dependency is missing; no files were changed to work around that unrelated runtime install issue. The new bundle compiles and signs locally. The orb has not yet been re-opened and tested in a live dictation session; this build verification does not establish microphone-level or real-use animation behavior.

## Dictation restart investigation

The latest privacy-safe diagnostics show that Ripple is receiving the shortcut and starting `AVAudioRecorder`, but Accessibility trust is denied (`target_capture/accessibility_denied`), so it cannot capture or paste into the focused field. One very short attempt was recorded as `too_short`. `security find-identity` found no stable local code-signing identity; the app uses an ad-hoc signature, which can cause macOS to require Accessibility authorization again after rebuilding. Opened the rebuilt app after the change below; Accessibility must be re-enabled for this app bundle before automatic insertion can work.

A process sample also showed the previous orb doing continuous CoreGraphics redraws while idle, consuming about 12% CPU. Changed the orb to remain static at idle/ready and create its 24 fps animation timer only during transcription/polishing; listening remains driven by microphone meter updates. The app rebuilt successfully with Node 20 and was relaunched. This compile/relaunch is verified; a fresh user dictation after reauthorizing Accessibility is still needed to verify capture and insertion end to end.

## Liquid Glass dictation status pill

Replaced the Siri Sheet orb with a native capsule control. It rests at 32 × 12 px and animates to 64 × 24 px (2× each dimension) while listening. The enlarged glass pill shows microphone-level audio bars; release transitions those bars into a colored indeterminate progress fill through transcription and polishing, with a cyan-to-violet sweep and a purple Liquid Glass tint for polishing. Raw mode displays the progress fill only during transcription. Resizing and the waveform-to-loader change use short ease-in/ease-out transitions. Idle is static to avoid the prior continuous-redraw CPU use. Updated README accordingly.

`npm run app:build` succeeded using Node 20 and recreated the ad-hoc signed macOS app. The app has not been exercised with a live microphone since this UI change. Because rebuilding the ad-hoc binary may invalidate macOS Accessibility authorization, the user may need to re-enable Ripple in Privacy & Security → Accessibility before text insertion.

## Explicit spoken-correction guidance

Expanded the Plain and Email formatter prompt to describe corrections as revisions to a spoken draft, with examples for changing a meeting date and correcting a time. It now directs the model to remove the superseded option when the correction is clear, while making only a minimal edit and preserving meaning when scope is ambiguous. The formatter is still probabilistic; the prompt cannot guarantee every correction is resolved correctly. TypeScript build completed with Node 20. No provider call or live dictation was made for this prompt change.

## Self-correction guidance and language/script output

Expanded the formatter policy to cover punctuation errors from ASR, multiple revisions, local and whole-proposal replacement, names/numbers/dates, explicit negation, genuine alternatives, code identifiers, and ambiguous correction scope. It tells the model to keep the latest clear correction, change only the relevant span, and preserve uncertainty instead of guessing. Added representative synthetic prompt regression cases. This cannot guarantee interpretation of every utterance; provider output still needs evaluation.

Added a separate persistent output selector in the Mac menu: preserve spoken language/native script, romanize to Latin letters without translation, translate to English, or select another translation language. Whisper's raw transcript remains unchanged and is stored beside the final result. Romanization/translation are explicit operations and can call the configured provider chain even with Raw selected; raw wording is not polished in that case. Added target-language validation, propagated options through the service/worker/formatter, and added a v1-to-v2 SQLite migration for output metadata and result status. New history records distinguish output mode and translation target. The TypeScript build, native macOS app build, and 100 automated tests passed, including prompt-contract, raw Romanization, translation-target validation, and SQLite v1 migration coverage. The app was restarted. No live provider call or real Hindi recording has been made, so transliteration quality still needs a spoken device test.

## Spoken transformation of selected text

Added a conservative explicit-command route for requests such as “transform this into a structured email.” At shortcut start, the native app captures only the focused field's selected range through macOS Accessibility, using `AXSelectedText` or the range-specific `AXStringForRange` API. Before paste, it verifies the same app, field, selection range, and selected text are still present. The worker sends the speech instruction and selection as separate provider fields; the prompt treats the selected content as untrusted data and asks the formatter to follow only the spoken instruction. This uses the existing provider chain and its local fallback. A missing selection or total formatter failure stops before paste, so the command itself is never pasted over the source. The source selection is not added to history; the spoken instruction and formatted result follow the existing history setting. Selected text is capped at 12,000 UTF-16 code units.

The build and 105 Node tests passed. The synthetic macOS focus test verified selected-range capture, revalidation, and rejection of changed selection, focus, and secure fields. A rebuilt app was reopened. The command-line GUI harness could not reliably verify Command-V replacement of a non-empty selection, so this interaction still needs a real-app test; no live provider request was made.

## Input language controls and read-only selection transform

Whisper's existing default was already automatic language detection (`-l auto`), but there was no UI to choose or verify input language. Added a persistent macOS menu for multilingual auto-detect, 32 common manually forced recognition languages, and optional English verification. English verification runs Whisper's detect-only pass first and fails closed (no formatting or insertion) on a non-English or unknown result; it adds a second model pass and is probabilistic, not a perfect language guarantee. Output script/translation remains a separate setting.

For selected-text transforms, macOS Accessibility previously accepted only editable fields. The target capture now supports explicitly selected readable text in supported read-only fields. Such results use a copy-only preview; Ripple never pastes to Terminal scrollback or sends Enter. Some Terminal contexts may not expose selection text through Accessibility, so the feature remains conditional on a real Terminal test. The command detector also recognizes direct transformation requests in English, Hindi/Hinglish, Spanish, French and German; it is deliberately a finite set of explicit phrases rather than general multilingual intent understanding.

Verification: 108 TypeScript tests passed, including manual/strict language handling and command patterns; `npm run test:mac-focus` passed synthetic editable, stale-target, secure-field and read-only selection cases. The installed Whisper CLI detected synthetic English audio as `en` with reported probability 0.984, and the strict-English TypeScript adapter completed transcription locally. No provider call or personal audio was used. The Node/Swift app rebuild succeeded and `open dist/Ripple.app` launched the app process. A real Terminal selection test is still pending; the copy-only behavior is verified only against a synthetic read-only AppKit text view.

## Recent Terminal dictation diagnosis

The user reported several recent Terminal attempts did not work. A content-free review of `data/performance.jsonl` and dictation-history metadata (timestamps, lengths and status only) found a 60.9-second recording and a 21.0-second recording whose local transcription completed successfully (2.22s and 1.24s), followed by `selection/source_unavailable`. A later 4.6-second attempt also transcribed successfully (1.13s) and ended with the same selection failure; its initial target capture was unavailable. These failed transformations are absent from SQLite history because the worker exits before history persistence, and none reached formatter or delivery. A separate 24.2-second recording transcribed in 1.17s, formatted through Groq key 1 in 2.13s, and emitted `delivery/sent`; its history row contains 235 raw and 178 final characters. Delivery/sent means the Command-V event was issued, not that the destination accepted it. No records in this window indicate a recording-duration, STT, or formatter timeout. macOS Unified Logging had no Ripple entries; the performance JSONL is the available diagnostic source. The exact destination for individual records is not independently logged. Ripple is currently running.

## Clipboard fallback after insertion failure

The user asked to keep a transcript available when automatic insertion fails. The native app now copies the completed output to the macOS clipboard whenever there is no usable paste target, a readable target is copy-only, focus/selection changes, text is unsupported, modifier release times out, or paste delivery is uncertain. The bubble reports that it was copied and can still use its Copy button. The app never retries Command-V, since uncertain delivery could have partially inserted text. Added content-free clipboard fallback success/failure diagnostics. `npm run app:build` and the synthetic macOS focus checks passed; the app was quit and reopened. No personal transcript or provider call was used to verify this change.

## Direct links to macOS permission settings

Replaced the permission button's prior generic recheck/prompt behavior with a deep link to the next missing Privacy & Security pane. Repeated clicks open Input Monitoring, Accessibility, then Microphone as applicable; the prompt explains to return and click again for the next missing permission. The button checks actual preflight/authorization state each time and reports a manual navigation path if Settings cannot be opened. Added current and legacy System Settings pane identifiers for macOS compatibility. macOS still requires the user to enable each toggle and may require relaunch; Ripple cannot grant TCC permissions automatically. The app rebuilt and relaunched successfully; code-signature verification passed. Rendered the permission prompt and confirmed the concise instructions fit in the existing compact panel. The live settings navigation has not been exercised because no permission grant was needed during the build; no system permission was changed.

## Restrained progressive-disclosure Hub UI and Detail & Iteration Inspector

Implemented a clean three-tier desktop interface inspired by Wispr Flow, Superwhisper, and Linear/Raycast:

1. **Tier 1 (Ambient Liquid Glass Pill)**: Compact 32 × 12 px resting capsule expanding to 64 × 24 px with live audio meter bars during speech and indeterminate progress fill during processing. Static at idle (0% CPU). Clicking opens the Ripple Hub.
2. **Tier 2 (Compact Whisper Toast)**: Floating 368 × 64 px exception capsule with Copy, Details ↗ shortcut into the Hub, and a 6.5s auto-dismiss timer.
3. **Tier 3 (Ripple Hub Window)**: 900 × 580 px SwiftUI window (minSize: 780 × 500 px) featuring:
   - **Page 1 Transcripts Feed**: Uncluttered view showing only final text, quiet timestamp, chronological grouping (_Today_, _Yesterday_, _Earlier_), live search with word count summary, and hover actions. Responsive header layout prevents title clipping when the drawer opens.
   - **Slide-over Detail & Iteration Inspector**: 328pt drawer with full keyboard dismissal (`Esc`). Supports one-click `Compare Raw` side-by-side/stacked comparison, style presets (`Raw`, `Plain`, `Email`, `Code`), script options (`Spoken`, `Romanize`, `Translate`), one-click quick refinement chips (`Make shorter`, `Bullet points`, `More formal`, `Friendly tone`), custom transformation instructions, and raw verbatim transcript card (`Use Raw` / `Copy Raw`).
   - **Adaptive Headless Preview Helpers**: Implemented `AdaptiveScrollContainer` and `AdaptiveTextField` in SwiftUI so interactive windows use native macOS `ScrollView`/`TextField` controls while headless CLI snapshot generation (`ImageRenderer`) renders crisp, non-blanked PNG previews across all tabs and drawers.
   - **Tabs 2 & 3**: Comprehensive Style & Language settings and System & Access status with direct deep links to macOS Privacy & Security.

Verification:

- Added comprehensive negative and validation tests for `handleHistoryRequest` in `test/dictation-history.test.ts` covering invalid actions, malformed UUIDs, unexpected keys, invalid target languages, instructions > 500 characters, missing record IDs, and single-record deletion.
- All 25 automated dictation test suites passed.
- Built native macOS bundle via `npm run app:build` and verified clean compilation and ad-hoc code-signing.
- Generated `/tmp/ripple-hub-preview.png`, `/tmp/ripple-hub-inspector-preview.png`, and `/tmp/ripple-hub-style-preview.png` via `--ui-preview-hub*` flags and visually inspected the output.

## Hub Refresh — Direction B (Warm Editorial)

Refactored the Hub UI (`native/macos/dictation/HubWindow.swift`) according to Direction B (Warm Editorial):

1. **Direction B Design Tokens**:
   - Replaced high-contrast obsidian surfaces with warm stone/alabaster surfaces: `#141416` Dark / `#FAF9F6` Light, `#1C1C1F` cards, `#232328` hover, `#2A2A30` active.
   - Unified single accent on Muted Iris (`#8B5CF6` Dark / `#6D28D9` Light), removing dual-accent cyan/violet competition.
   - Removed resting borders on cards, buttons, and search inputs; cards use subtle fill contrast at rest with a 1px hairline border only when selected.
   - Tri-system typography: SF Pro Rounded for brand and major headers; SF Pro text with `.monospacedDigit()` for timestamps and counters; natural sentence-case section labels.
2. **Layout & Interaction Polish**:
   - Sidebar decluttered: Brand title uses SF Pro with a small Muted Iris accent dot; footer simplified to a single-line status row (`● Plain · Auto` ... `Ready`).
   - Feed header: Borderless search bar, borderless icon buttons, and natural sentence-case chronological headers.
   - Slide-over Inspector Drawer: Sentence-case headings (`Result`, `Re-transform`, `Spoken Transcript`), unified 4-segment mode track (`Plain | Email | Code | Raw`), 3 refinement chips (`Shorter`, `Formal`, `Bullet Points`) + adaptive `Script ▾` menu, borderless custom instruction input, solid Muted Iris primary action button, and clean 1-line metadata footer (`Polished · Spoken Script · 16 words`).
   - Style & Language settings and System tabs fit cleanly within the 900 × 580 px window without bottom clipping or vertical overflow.
3. **Verification**:
   - Rendered `/tmp/ripple-hub-preview.png`, `/tmp/ripple-hub-inspector-preview.png`, and `/tmp/ripple-hub-style-preview.png`.
   - Verified that all 25 automated dictation tests pass.

## Ambient Liquid Droplet v2 (Multi-Octave Noise Field)

Replaced the initial sine-lobe droplet and bar-wave activity indicator with Droplet v2, implementing the user-selected alternative design from `droplet_v2_alt.gif`:

1. **Periodic Noise on Unit Circle ($S^1 \times \mathbb{R}$)**:
   - Projects polar angle $\theta$ onto Cartesian unit circle $(\cos\theta, \sin\theta)$ to sample a 3D periodic noise field $N(\cos\theta, \sin\theta, z(t))$ with 3 octaves (macro contour $f=1.0$, formant ripples $f=2.0$, and capillary surface shimmer $f=4.0$).
   - Guarantees $C^\infty$ mathematical continuity across $\theta = 0 \leftrightarrow 2\pi$ with zero seams or kinks.
   - Fluid time drift: $z(t)$ advances continuously at baseline $\nu = 0.45$ rad/s, accelerating with speech energy to $\nu = 1.30$ rad/s without mechanical spinning.
2. **Simplified 2-Layer Rendering Stack**:
   - Layer 1: Contact drop shadow (`black @ 30%, radius 6, y +2`) + Catmull-Rom cubic spline liquid body fill (`stateColor.opacity(...)`).
   - Layer 2: Clipped top-left meniscus highlight (`white @ 60%`) + 1px hairline specular rim (`white @ 22%`).
   - Deleted gooey `alphaThreshold`/`blur` canvas filter, 8-pass glow, and satellite droplet budding code.
3. **Choreography & Reviewer Corrections Applied**:
   - **Correction 1**: Encapsulated simulation state and `lastDate: Date?` in non-published reference type `DropletSimulation`, completely avoiding "Modifying state during view update" runtime warnings. Resets `lastDate = nil` on pause.
   - **Correction 2**: Implemented exact mathematical formulas for `.error` (damped horizontal wobble $4.0 \cdot e^{-6t} \cos(2\pi \cdot 12t)$), `.transcribing` (quadrupole breathing $0.05 \cos(2\theta) \sin(2\pi \cdot 0.8 z)$), and `.polishing` (viscous respiration $0.06 \cos(4\theta) \sin(2\pi \cdot 0.7 z)$).
   - **Correction 3**: Pre-allocated and reused 28-node `[CGPoint]` buffer in `DropletSimulation` to eliminate 60fps heap array allocations.
   - Idle state rests at 10pt Obsidian Pearl (`#1C1E26 @ 88%`) and pauses `TimelineView` (0.0% CPU) when settled.
4. **Verification**:
   - Added `--test-droplet-stability` headless flag; ran 10,000 simulated frames with synthetic 0.1s dt spikes, asserting all points remain finite and bounded within $[0.5 R_0, 1.7 R_0]$ (PASSED).
   - Added `--ui-preview-droplet-sequence <seconds> <outputDir>` flag; rendered 30-frame sequence to `/tmp/droplet-seq` at 30 fps.
   - Rendered and visually inspected all state previews via `--ui-preview-droplet` (`idle`, `listening`, `peak`, `transcribing`, `polishing`, `success`, `error`).
   - All 25 automated dictation tests pass. Live app instance remained untouched.

## Hub Layout — Option 2 (2-Pane Focus Feed + On-Demand Sheet) & Option 4 (Streamlined Tab 2)

Implemented the approved **Option 2** and **Option 4** layout architecture in `native/macos/dictation/HubWindow.swift` and updated menu bar references in `native/macos/dictation/main.swift`:

1. **Option 2: 2-Pane Focus Feed + On-Demand Sheet**:
   - **2-Pane Architecture**: Refactored `HubRootView` into a clean 2-pane structure (180pt navigation sidebar + flexible canvas). Lowered minimum window dimensions from 780 × 500 to 560 × 460 with responsive flex layout.
   - **Leaf-Isolated Transcript Row**: Extracted `TranscriptRowView` with leaf-isolated `@State private var isHovered: Bool = false` to eliminate parent re-renders. Replaced feed `VStack` with `LazyVStack`.
   - **Click Isolation**: Attached `.onTapGesture { onSelect() }` strictly to the transcript text. The trailing 68pt slot containing the `Copy` button is completely decoupled, ensuring clicking `Copy` does not trigger row selection or open the modal.
   - **On-Demand Modal Sheet (`InspectorSheetView`)**: Transferred the 328pt side drawer into a focused 480 × 530 pt modal sheet presented via `.sheet(isPresented: $model.isSheetPresented)` (and centered overlay for headless preview). Features sentence-case headers, `Compare Raw` toggle, 4-segment style track (`Plain | Email | Code | Raw`), script dropdown (`Spoken (Original)`, `Latin (Romanized)`, `Translate`), 3 unclipped refinement chips (`Shorter`, `Formal`, `Bullet Points`), custom instruction input, solid Muted Iris `Apply Transform` button, verbatim spoken transcript card with `Copy Raw`, and metadata footer.
   - **Scroll Safety**: Wrapped inner content in `AdaptiveScrollContainer` so long transcripts and expanded raw comparisons scroll smoothly with zero vertical boundary clipping.
2. **Option 4: Streamlined Tab 2 (Style & Language)**:
   - Replaced the previous 10-card layout with 3 calm grouped macOS Settings sections:
     - **Default Dictation Mode**: 4-segment control (`Raw | Plain | Email | Code`) with dynamic helper caption explaining active mode behavior.
     - **Script & Translation**: Grouped card containing `Output script` dropdown (`Spoken (Original script)`, `Latin (Romanized) · e.g. Aap kaise ho?`, `Translate`) and conditional `Translate target` selector.
     - **Speech Recognition (Whisper)**: Grouped card containing `Spoken language` dropdown (Auto-detect + 32 languages) and `English-only guard` switch toggle (`Discard non-English audio before transcribing`).
3. **Menu Bar & Headless Preview Support**:
   - Updated menu bar labels in `main.swift` for parity: `Spoken language (original script)` and `Latin (Romanized) · e.g. Aap kaise ho?`.
   - Added `--ui-preview-hub-narrow` support to `renderHubPreviewIfNeeded()` (renders at 560 × 460).
4. **Verification**:
   - Built native app via `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer python3 scripts/build_dictation_app.py` (0 errors, code signed).
   - Executed all 25 automated dictation tests (`PATH=/Users/ritu.shandilya/.nvm/versions/node/v20.19.3/bin:$PATH npx tsx --test test/dictation*.test.ts`) — all 25 passed.
   - Rendered and visually inspected all 4 preview snapshots:
     - `/tmp/ripple-hub-option2-preview.png` (900 × 580 Focus Feed)
     - `/tmp/ripple-hub-narrow-preview.png` (560 × 460 Narrow Window — zero sidebar or icon clipping)
     - `/tmp/ripple-hub-sheet-preview.png` (480 × 530 Modal Sheet centered with dimming)
     - `/tmp/ripple-hub-tab2-streamlined.png` (Streamlined Tab 2 3-section settings)
   - Live app instance (PID 10739) was preserved without restart or termination.
