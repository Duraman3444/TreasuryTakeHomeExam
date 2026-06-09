# Design Decisions, Trade-offs & Assumptions

This document explains the technical choices, architecture decisions, and core assumptions behind the AI-Powered Alcohol Label Verification App. It will be updated as the project evolves.

---

## 1. Technical Stack Selection

### Language: TypeScript / JavaScript
* **Chosen**: TypeScript
* **Alternatives Considered**: C# (.NET), Python
* **Rationale**:
  * **Unified Codebase**: Next.js allows writing both the interactive user interface and the backend processing APIs in a single language (TypeScript). This increases development velocity.
  * **C# / .NET**: Although the production COLA system is built on .NET, building a modern, highly interactive prototype in C# requires significant boilerplate. Marcus (IT Admin) confirmed that we are **not** integrating with the COLA backend for this prototype. Therefore, matching the production stack was deprioritized in favor of prototyping speed.
  * **Python**: Python is excellent for AI, but creating a beautiful, modern interactive frontend in Python (e.g., Streamlit, Gradio) feels restrictive and lacks a premium, production-ready aesthetic.

### Framework: Next.js (React)
* **Chosen**: Next.js (App Router)
* **Alternatives Considered**: Vite (SPA) + Express (Backend)
* **Rationale**:
  * **Zero-Config Backend**: Next.js API Routes let us easily secure API keys (like the Gemini API key) on the server side without spinning up and deploying a separate Express server.
  * **Deployment Simplicity**: Next.js can be deployed as a single unit (on Vercel, Firebase App Hosting, or Azure App Service), matching the standalone proof-of-concept requirement.

### Styling: Vanilla CSS (Custom CSS Variables & Modern Layouts)
* **Chosen**: Vanilla CSS
* **Alternatives Considered**: Tailwind CSS
* **Rationale**:
  * Tailwind CSS can lead to cluttered JSX and is sometimes restricted by agency policies. Vanilla CSS (custom properties + inline styles) gives absolute layout control and a centralized token system.
  * **Final visual direction**: a light, high-contrast theme inspired by the **U.S. Web Design System (USWDS)** — the federal standard — rather than a dark "modern SaaS" look. This was a deliberate pivot to match the actual audience: federal compliance agents, half of them 50+, per Sarah's "something my mother could figure out" benchmark. Gradients, glows, and glassmorphism were removed in favor of a navy/blue palette, flat bordered cards, and squared corners that read as a credible government tool.

---

## 2. Compliance Engine & AI Strategy

### Verification Engine: Hybrid (AI Extraction + Deterministic Code Rules)
* **Chosen**: Hybrid Approach (Gemini API for extraction, Node.js code for compliance check)
* **Alternatives Considered**: Pure LLM Verification ("Is this label compliant? Yes/No")
* **Rationale**:
  * **Pure LLM Verification Risk**: LLMs can hallucinate or fail to catch literal, word-for-word discrepancies in long texts. For example, a minor spelling mistake in the Surgeon General's warning might be overlooked by an LLM trying to check compliance semantically.
  * **Hybrid Solution**:
    1. Use a multimodal LLM (`gemini-2.5-flash`, run at `temperature: 0` for deterministic extraction) to perform high-fidelity visual OCR, extract structured fields (Brand Name, ABV, Net Contents, raw Government Warning), and detect visual hierarchy.
    2. Pass these structured values to a deterministic JavaScript engine that checks:
       * **Exact Word-for-Word Warning Text** (using character-by-character string comparison).
       * **Casing of Key Substrings** (e.g., checking if "GOVERNMENT WARNING:" is in all caps).
       * **Numerical ABV match** (using a regex parser to resolve "40% alc/vol" vs "40% ABV").
  * This guarantees 100% accuracy and auditable reasons for failures (e.g., "Mismatched character at index 45 of warning text").

### LLM Model Selection: Gemini 2.5 Flash
* **Chosen**: `gemini-2.5-flash` (Gemini Flash series)
* **Alternatives Considered**: Gemini Pro, Tesseract OCR + GPT-4o
* **Rationale**:
  * **Performance & Speed**: Sarah Chen noted that if the system takes longer than 5 seconds, agents will revert to manual reviews. Gemini Flash targets a 2–5 second round trip for image input, leaving budget for network and UI rendering.
  * **Cost & Multi-modal Capability**: Traditional OCR (like Tesseract) struggles with curved text, bad angles, stylized fonts, and low contrast on actual bottles. Gemini's native multimodal capabilities handle these real-world photo imperfections seamlessly.
  * **Model migration note**: the prototype originally targeted `gemini-1.5-flash`, but that model has been retired from the public `v1beta` `generateContent` endpoint and now returns `404`. We migrated to `gemini-2.5-flash` (verified working). `gemini-2.0-flash` is also code-compatible but had **zero free-tier quota** on the test key, so `2.5-flash` is the default.

### Compliance Status Model: MATCH / WARNING / MISMATCH / INCOMPLETE
* The engine returns one of four per-field statuses. `INCOMPLETE` was added after live testing: when an agent leaves a COLA form field blank, the engine no longer emits a misleading `MISMATCH` (or a false "partial match" `WARNING`). It surfaces what the AI actually read from the label and prompts the agent to complete the form. `INCOMPLETE` outranks `WARNING` but not `MISMATCH` in the overall verdict, and it never auto-approves.

### Field Coverage & the Government-Warning "Bold/Prominence" Check
* The engine verifies all five fields from the brief's sample label (brand, class/type, ABV, net contents, government warning) **plus** the two remaining TTB "common elements": **bottler name/address** and **country of origin** (the latter treated as required only for imports).
* Per Jenny's note that the warning must be "all caps **and bold**" and that violators "bury it in tiny text," the warning check goes beyond text: the multimodal model returns a `governmentWarningProminence` signal (`prominent` / `not_bold` / `too_small`). A non-bold or buried warning whose text is otherwise exact is downgraded to a **WARNING** for the agent to review (never a hard rejection).
* **Honest limitation — deliberately conservative.** Vision models cannot reliably distinguish *subtle* font-weight differences, and early testing showed an aggressive prompt produced false alarms on genuinely-bold labels. Because a compliance tool that cries wolf erodes agent trust (Dave: "don't make my life harder"), the prompt is tuned to **default to `prominent` and only flag when clearly non-bold or genuinely tiny/buried/low-contrast.** The result: zero false positives on compliant labels in testing, at the cost of letting *borderline* non-bold cases through. It is a best-effort assist that surfaces obvious violations, not a guaranteed bold-enforcement gate — the agent's eye remains the backstop for subtle cases.

### Deterministic Extraction (`temperature: 0`)
* Both providers are called at `temperature: 0` so the same label yields the same extracted fields on every run — important for an auditable compliance tool (early testing showed the model varying how much of the class/type designation it returned between runs).

### Provider Routing (known sharp edge)
* The backend selects Claude whenever `CLAUDE_API_KEY`/`ANTHROPIC_API_KEY` is present and otherwise defaults to Gemini. **A non-empty placeholder Claude value will hijack routing** and cause `401` errors, so the shipped `.env.example` keeps the Claude key commented out. A future hardening pass should validate the key format (`sk-ant-` prefix, non-placeholder) before selecting Claude.

---

## 3. UI/UX Design Decisions

### Accessibility-First Interface
* **Design Goal**: "My mother could figure it out" (Sarah's benchmark).
* **Rationale & Decisions**:
  * **No Hidden Actions**: Use clear, permanent navigation tabs instead of hamburger menus.
  * **Explicit Upload Zones**: A giant, highly visible file dropper with a clear icon.
  * **Visual Side-by-Side Panel**: Instead of just showing "Fail", the screen will split: the uploaded label is on the left, and the form fields with inline diffs (green/yellow/red) are on the right. Agents can verify the AI's matching logic instantly.
  * **High Contrast & Font Sizing**: Avoid tiny, faint gray text common in some modern web designs. Use robust typography (Google Fonts *Inter* or *Outfit*) with proper sizing and clear contrast ratios to support older agents (50+ demographic).

---

## 4. Batch Processing Architecture

### Client-Side Queue Management
* **Chosen**: Browser-based parallel batch worker (with concurrency limit)
* **Alternatives Considered**: Server-side job queue (Redis + Celery/BullMQ)
* **Rationale**:
  * **Architecture Simplicity**: A server-side queue requires databases, background workers, and web sockets to push updates back to the browser. This adds immense complexity and host setup overhead.
  * **Client-side Queue**: The React app maintains an upload queue. When an importer uploads 50 labels, the browser calls the Next.js verification API for up to 3 labels concurrently. It displays a live dashboard of results as they arrive. This keeps the application 100% serverless, zero-maintenance, and cost-effective.

---

## 5. Security, Privacy & Data Compliance Assumptions

* **Zero-Retention Policy**: We assume no permanent storage is required for this prototype. Uploaded images are sent to the Gemini API, verified, and the results are returned to the client. Images are not stored on our server disk.
* **No PII Collection**: Label applications contain only corporate brand names, alcohol contents, and publicly visible warning labels. No private agent credentials, personal addresses, or payment details are processed.
* **Firewall Awareness**: Marcus mentioned government firewalls blocking outbound ML endpoints. By using standard HTTPS endpoints for Gemini (or Firebase AI Logic proxies), we route calls over standard port 443, minimizing network blockages.
