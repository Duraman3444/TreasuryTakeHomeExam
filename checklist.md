# Project Checklist: AI-Powered Alcohol Label Verification App

This checklist outlines the development phases for the standalone proof-of-concept label verification prototype.

---

### **Project Status Summary (Updated: June 9, 2026)**
*   **Current Status**: **Complete & deployed.** Core single-label and batch verification both verified end-to-end against the live Gemini API, and the app is live on Vercel.
*   **Live demo**: https://treasury-take-home-exam.vercel.app
*   **Accomplished Tasks**:
    1.  **Phase 4 (Batch Import)**: Full multi-image drag-and-drop batch upload and CSV form-metadata parser, with filename matching, "Unlisted (not in CSV)" handling, visual diagnostics, template downloader, and a concurrency-limited queue runner. **Verified end-to-end** with a 5-item CSV + images (correct set → all MATCH; error set → all MISMATCH, varied error types).
    2.  **Phase 5 (Accessibility / UX)**: Restyled to a light, high-contrast **USWDS-inspired federal theme** (navy/blue palette, flat cards, no gradients/glows) suited to the 50+ agent demographic, with `:focus-visible` keyboard indicators.
    3.  **Phase 6 (Deployment)**: Deployed to **Vercel** (root directory `label-verification`, server-side `GEMINI_API_KEY`). Production verified: page + live `/api/verify` return correct results at ~1.9s latency.

*   **Live-Testing Fixes (post-integration verification):**
    1.  Migrated the Gemini model from retired `gemini-1.5-flash` (returns `404`) to **`gemini-2.5-flash`**; verified end-to-end.
    2.  Upgraded **Next.js 15.1.0 → 15.5.19** to patch CVE-2025-66478 (Vercel blocks deploys on the vulnerable version).
    3.  Set **`temperature: 0`** on both providers for deterministic, auditable extraction.
    4.  Added the **`INCOMPLETE`** status so blank COLA form fields no longer produce misleading `MISMATCH`/`WARNING`/`"null%"`; the form auto-clears on custom image upload.
    5.  Added **retry-with-backoff** on transient `429`/`503` (unit-tested) for resilience under load.
    6.  Added an **"Autofill from label"** button (AI reads fields off the image as a starting point) and removed the API-key settings box (the deployed app uses the env key automatically).
    7.  Documented the **provider-routing sharp edge** (placeholder Claude key hijacks routing) and commented out the Claude key in `.env.example` by default.

*   **Known limitations (documented trade-offs):**
    *   **Imperfect-image handling** (extreme angle/glare/lighting) relies entirely on the multimodal model and has not been formally benchmarked — flagged as out of scope per the brief.
    *   **Cloud-API dependency**: extraction calls Google's API. Acceptable for a prototype, but a real TTB deployment would need an on-prem/Azure-hosted vision model given the agency firewall (noted by Marcus). See `design_decisions.md`.

---

## Phase 1: Setup & Initialization
- [x] Initialize Next.js project with TypeScript, React, and Vanilla CSS
- [x] Configure project structure (components, pages, lib, styles)
- [x] Set up environment variables and API clients (Gemini API SDK configuration)
- [x] Establish styling system in `globals.css` with modern design tokens (color palette, spacing, typography, gradients)

## Phase 2: AI & Compliance Engine (Backend API)
- [x] Create `/api/verify` endpoint to process image uploads and form fields
- [x] Integrate Gemini & Claude Multimodal API (automatically switching based on key/env format)
- [x] Design robust prompt to extract fields: Brand Name, ABV, Net Contents, Class/Type, and raw Government Warning text
- [x] Implement strict verification logic:
  - [x] **Exact String Match**: Compare brand name, class/type, and net contents (handling minor casing discrepancies as warnings)
  - [x] **ABV Parser & Matcher**: Match alcohol content percentage (e.g., "45%" vs "45% Alc./Vol." or "90 Proof")
  - [x] **Government Warning Checker**:
    - [x] Word-for-word string match against the CFR Title 27 standard text
    - [x] Case-sensitivity check (specifically checking if "GOVERNMENT WARNING:" is in ALL CAPS)
    - [x] Formatting check (checking if warning is bolded or visually distinct where possible, or flagging formatting warnings)
- [x] Return structured JSON response with verification status (`MATCH`, `WARNING`, `MISMATCH`) and detailed diffs for each field

## Phase 3: Single Label Verification UI
- [x] Build a modern, clean Dashboard layout (accessible for users of all tech levels)
- [x] Create intuitive upload area supporting drag-and-drop of label images
- [x] Build the interactive application form fields side-by-side with the upload container
- [x] Implement loading skeleton and progress state (targeting a complete verification under 5 seconds)
- [x] Build verification result dashboard:
  - [x] **Visual Side-by-Side Comparison**: Uploaded label image next to verification findings
  - [x] **Color-Coded Statuses**: Green for matches, amber for warnings, red for mismatches
  - [x] **Diff Viewer**: Highlighting character mismatches or warning states (especially for the Government Warning statement)
  - [x] **Agent Decision Panel**: Easy action buttons ("Approve", "Reject", "Request Resubmission") to finalize the review

## Phase 4: Batch Processing Feature
- [x] Create a Batch Verification dashboard (UI layout, parallel processing workers, and stats panel complete)
- [x] Build a bulk uploader for multiple images and a CSV data mapper (matching forms to images by filename/index)
- [x] Implement client-side queue manager with concurrency control (e.g., 3 parallel tasks) to keep UI responsive and respect API limits
- [x] Display live progress bar and status cards for each label in the queue
- [x] Provide batch dashboard filters (e.g., view only "Mismatches" or "Warnings" for quick triage)

## Phase 5: Testing & Refinement
- [x] Generate mock label images using AI image generation to represent edge cases:
  - [x] Poor lighting, off-angles, glare
  - [x] Minor spelling typos in brand name or warning text
  - [x] Deviations in Government Warning text casing
- [x] Write integration test scripts to verify the compliance engine rules (executed via `src/lib/test-verifier.ts`)
- [x] Audit accessibility (contrast, font size, keyboard navigability) for older agents (50+ demographic)
- [x] Verify execution latency is consistently under the 5-second target (sub-2s with Gemini Flash)

## Phase 6: Documentation & Handover
- [x] Create detailed `README.md` with local setup, run instructions, and mermaid architecture diagram
- [x] Complete `design_decisions.md` detailing architectural trade-offs, language, and stack decisions
