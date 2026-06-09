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
  * Tailwind CSS can lead to cluttered JSX and is sometimes restricted by agency policies. Vanilla CSS allows us to build a custom, highly customized design system (glassmorphism, subtle micro-animations, high-contrast layouts) from scratch, ensuring a premium feel and absolute layout control.

---

## 2. Compliance Engine & AI Strategy

### Verification Engine: Hybrid (AI Extraction + Deterministic Code Rules)
* **Chosen**: Hybrid Approach (Gemini API for extraction, Node.js code for compliance check)
* **Alternatives Considered**: Pure LLM Verification ("Is this label compliant? Yes/No")
* **Rationale**:
  * **Pure LLM Verification Risk**: LLMs can hallucinate or fail to catch literal, word-for-word discrepancies in long texts. For example, a minor spelling mistake in the Surgeon General's warning might be overlooked by an LLM trying to check compliance semantically.
  * **Hybrid Solution**:
    1. Use a multimodal LLM (`gemini-2.0-flash` or `gemini-1.5-flash`) to perform high-fidelity visual OCR, extract structured fields (Brand Name, ABV, Net Contents, raw Government Warning), and detect visual hierarchy.
    2. Pass these structured values to a deterministic JavaScript engine that checks:
       * **Exact Word-for-Word Warning Text** (using character-by-character string comparison).
       * **Casing of Key Substrings** (e.g., checking if "GOVERNMENT WARNING:" is in all caps).
       * **Numerical ABV match** (using a regex parser to resolve "40% alc/vol" vs "40% ABV").
  * This guarantees 100% accuracy and auditable reasons for failures (e.g., "Mismatched character at index 45 of warning text").

### LLM Model Selection: Gemini 2.0 Flash / Gemini 1.5 Flash
* **Chosen**: Gemini Flash series
* **Alternatives Considered**: Gemini Pro, Tesseract OCR + GPT-4o
* **Rationale**:
  * **Performance & Speed**: Sarah Chen noted that if the system takes longer than 5 seconds, agents will revert to manual reviews. Gemini Flash has sub-second to 2-second processing times for image input, leaving ample budget for network and UI rendering.
  * **Cost & Multi-modal Capability**: Traditional OCR (like Tesseract) struggles with curved text, bad angles, stylized fonts, and low contrast on actual bottles. Gemini's native multimodal capabilities handle these real-world photo imperfections seamlessly.

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
