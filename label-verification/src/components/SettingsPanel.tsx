"use client";

import React, { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Save, Check } from "lucide-react";

interface SettingsPanelProps {
  onKeyChange: (key: string) => void;
}

export default function SettingsPanel({ onKeyChange }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedKey = localStorage.getItem("GEMINI_API_KEY") || "";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApiKey(storedKey);
      if (storedKey) {
        onKeyChange(storedKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    localStorage.setItem("GEMINI_API_KEY", apiKey);
    onKeyChange(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Key size={20} className="gradient-text" style={{ stroke: "var(--primary)" }} />
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "var(--text-primary)" }}>
              API Settings
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Provide your Gemini (AIzaSy...) or Claude (sk-ant-...) API key. Key is stored locally in your browser.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexGrow: 1, maxWidth: "450px" }}>
          <div style={{ position: "relative", flexGrow: 1 }}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter Gemini or Claude API Key..."
              style={{
                width: "100%",
                padding: "0.625rem 2.5rem 0.625rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--bg-tertiary)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
                outline: "none",
                transition: "border-color var(--transition-fast)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--bg-tertiary)")}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "0.25rem",
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            onClick={handleSave}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.625rem 1rem",
              borderRadius: "var(--radius-sm)",
              backgroundColor: saved ? "var(--color-match)" : "var(--primary)",
              color: "white",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: "500",
              cursor: "pointer",
              transition: "background-color var(--transition-fast)",
            }}
          >
            {saved ? (
              <>
                <Check size={16} /> Saved
              </>
            ) : (
              <>
                <Save size={16} /> Save Key
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
