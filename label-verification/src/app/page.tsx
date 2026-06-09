"use client";

import React, { useState } from "react";
import VerificationDashboard from "@/components/VerificationDashboard";
import BatchDashboard from "@/components/BatchDashboard";
import { ShieldCheck, HelpCircle } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header Banner */}
      <header
        style={{
          borderBottom: "1px solid var(--bg-tertiary)",
          padding: "1.25rem 2rem",
          backgroundColor: "var(--bg-secondary)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "4px",
                backgroundColor: "var(--primary-dark)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={24} style={{ color: "white" }} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "800",
                  letterSpacing: "-0.025em",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <span className="gradient-text">TTB COMPLIANCE PORTAL</span>
                <span style={{ fontSize: "0.7rem", backgroundColor: "var(--primary-glow)", color: "var(--primary)", border: "1px solid var(--glass-border)", padding: "2px 6px", borderRadius: "10px", fontWeight: "600" }}>
                  Prototype
                </span>
              </h1>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1px" }}>
                AI-Powered Alcohol Label Verification & TTB Compliance Assistant
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setActiveTab("single")}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.825rem",
                fontWeight: "600",
                cursor: "pointer",
                backgroundColor: activeTab === "single" ? "var(--primary)" : "transparent",
                color: activeTab === "single" ? "#ffffff" : "var(--text-secondary)",
                border: activeTab === "single" ? "1px solid var(--primary)" : "1px solid var(--bg-tertiary)",
                transition: "all var(--transition-fast)",
              }}
            >
              Single Application review
            </button>
            <button
              onClick={() => setActiveTab("batch")}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.825rem",
                fontWeight: "600",
                cursor: "pointer",
                backgroundColor: activeTab === "batch" ? "var(--primary)" : "transparent",
                color: activeTab === "batch" ? "#ffffff" : "var(--text-secondary)",
                border: activeTab === "batch" ? "1px solid var(--primary)" : "1px solid var(--bg-tertiary)",
                transition: "all var(--transition-fast)",
              }}
            >
              Batch importer queue
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main
        style={{
          flex: 1,
          maxWidth: "1280px",
          width: "100%",
          margin: "0 auto",
          padding: "1.5rem 2rem 3rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {/* Help Banner for older agents (Dave's demographic) */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: "0.75rem 1.25rem", 
            borderLeft: "4px solid var(--accent-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
            fontSize: "0.825rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
            <HelpCircle size={16} style={{ color: "var(--accent-blue)" }} />
            <span>
              <strong>Quick Tip:</strong> Select a preset case below to auto-fill the form and load a mock label onto the canvas, then press the verify button.
            </span>
          </div>
        </div>

        {/* Tab workspaces */}
        {activeTab === "single" ? (
          <VerificationDashboard />
        ) : (
          <BatchDashboard />
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--bg-tertiary)",
          padding: "1.5rem 2rem",
          backgroundColor: "var(--primary-dark)",
          color: "#e6eaf0",
          textAlign: "center",
          fontSize: "0.75rem",
          marginTop: "auto",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <span>Alcohol and Tobacco Tax and Trade Bureau (TTB) — Compliance Operations Prototype</span>
          <span>Powered by Gemini 2.5 Flash • Latency Target &lt; 5.0s</span>
        </div>
      </footer>
    </div>
  );
}
