# Project Checklist: AI-Powered Alcohol Label Verification App

This checklist outlines the phases of development for the standalone proof-of-concept label verification prototype.

## Phase 1: Setup & Initialization
- [ ] Initialize Next.js project with TypeScript, React, and Vanilla CSS
- [ ] Configure project structure (components, pages, lib, styles)
- [ ] Set up environment variables and API clients (Gemini API SDK configuration)
- [ ] Establish styling system in `globals.css` with modern design tokens (color palette, spacing, typography, gradients)

## Phase 2: AI & Compliance Engine (Backend API)
- [ ] Create `/api/verify` endpoint to process image uploads and form fields
- [ ] Integrate Gemini Multimodal API (using `gemini-2.0-flash` or `gemini-1.5-flash` for <2s latency)
- [ ] Design robust prompt to extract fields: Brand Name, ABV, Net Contents, Class/Type, and raw Government Warning text
- [ ] Implement strict verification logic:
  - [ ] **Exact String Match**: Compare brand name, class/type, and net contents (handling minor casing discrepancies as warnings)
  - [ ] **ABV Parser & Matcher**: Match alcohol content percentage (e.g., "45%" vs "45% Alc./Vol." or "90 Proof")
  - [ ] **Government Warning Checker**:
    - [ ] Word-for-word string match against the CFR Title 27 standard text
    - [ ] Case-sensitivity check (specifically checking if "GOVERNMENT WARNING:" is in ALL CAPS)
    - [ ] Formatting check (checking if warning is bolded or visually distinct where possible, or flagging formatting warnings)
- [ ] Return structured JSON response with verification status (`MATCH`, `WARNING`, `MISMATCH`) and detailed diffs for each field

## Phase 3: Single Label Verification UI
- [ ] Build a modern, clean Dashboard layout (accessible for users of all tech levels)
- [ ] Create intuitive upload area supporting drag-and-drop of label images
- [ ] Build the interactive application form fields side-by-side with the upload container
- [ ] Implement loading skeleton and progress state (targeting a complete verification under 5 seconds)
- [ ] Build verification result dashboard:
  - [ ] **Visual Side-by-Side Comparison**: Uploaded label image next to verification findings
  - [ ] **Color-Coded Statuses**: Green for matches, amber for warnings, red for mismatches
  - [ ] **Diff Viewer**: Highlighting character mismatches or warning states (especially for the Government Warning statement)
  - [ ] **Agent Decision Panel**: Easy action buttons ("Approve", "Reject", "Request Resubmission") to finalize the review

## Phase 4: Batch Processing Feature
- [ ] Create a Batch Verification dashboard
- [ ] Build a bulk uploader for multiple images and a CSV data mapper (matching forms to images by filename/index)
- [ ] Implement client-side queue manager with concurrency control (e.g., 3 parallel tasks) to keep UI responsive and respect API limits
- [ ] Display live progress bar and status cards for each label in the queue
- [ ] Provide batch dashboard filters (e.g., view only "Mismatches" or "Warnings" for quick triage)

## Phase 5: Testing & Refinement
- [ ] Generate mock label images using AI image generation to represent edge cases:
  - [ ] Poor lighting, off-angles, glare
  - [ ] Minor spelling typos in brand name or warning text
  - [ ] Deviations in Government Warning text casing
- [ ] Write integration test scripts to verify the compliance engine rules
- [ ] Audit accessibility (contrast, font size, keyboard navigability) for older agents (50+ demographic)
- [ ] Verify execution latency is consistently under the 5-second target

## Phase 6: Documentation & Handover
- [ ] Create detailed `README.md` with local setup and run instructions
- [ ] Complete `design_decisions.md` detailing architectural trade-offs, language, and stack decisions
