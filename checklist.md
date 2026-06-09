# Project Checklist: AI-Powered Alcohol Label Verification App

This checklist outlines the development phases for the standalone proof-of-concept label verification prototype.

---

### **Project Status Summary (Updated: June 9, 2026)**
*   **Current Status**: **Phase 5 (Testing & Refinement) & Phase 6 (Documentation & Handover)**
*   **Next Steps / What's Remaining**:
    1.  **Phase 4 (Batch Import Expansion)**: Build the custom CSV file reader and bulk multi-image uploader UI (currently handles 5 preset edge cases in the parallelized queue).
    2.  **Phase 5 (Accessibility Auditing)**: Perform keyboard navigation and color-contrast verification to accommodate agents in the 50+ demographic.
    3.  **Phase 6 (Deployment)**: Deploy the Next.js app to Vercel or Firebase App Hosting as desired.

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
- [/] Create a Batch Verification dashboard (UI layout, parallel processing workers, and stats panel complete)
- [ ] Build a bulk uploader for multiple images and a CSV data mapper (matching forms to images by filename/index)
- [x] Implement client-side queue manager with concurrency control (e.g., 3 parallel tasks) to keep UI responsive and respect API limits
- [x] Display live progress bar and status cards for each label in the queue
- [x] Provide batch dashboard filters (e.g., view only "Mismatches" or "Warnings" for quick triage)

## Phase 5: Testing & Refinement
- [x] Generate mock label images using AI image generation to represent edge cases:
  - [x] Poor lighting, off-angles, glare
  - [x] Minor spelling typos in brand name or warning text
  - [x] Deviations in Government Warning text casing
- [x] Write integration test scripts to verify the compliance engine rules (executed via `src/lib/test-verifier.ts`)
- [ ] Audit accessibility (contrast, font size, keyboard navigability) for older agents (50+ demographic)
- [x] Verify execution latency is consistently under the 5-second target (sub-2s with Gemini Flash)

## Phase 6: Documentation & Handover
- [/] Create detailed `README.md` with local setup, run instructions, and mermaid architecture diagram
- [x] Complete `design_decisions.md` detailing architectural trade-offs, language, and stack decisions
