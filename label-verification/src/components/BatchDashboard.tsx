"use client";

import React, { useState, useRef } from "react";
import { 
  Play, RefreshCw, Layers, CheckCircle2, AlertTriangle, 
  XCircle, ChevronDown, ChevronUp, Clock, AlertCircle, FileSpreadsheet
} from "lucide-react";
import { STANDARD_GOVERNMENT_WARNING_FULL, VerificationReport, VerificationFieldResult, DiffPart } from "@/lib/verifier";

interface BatchItem {
  id: string;
  name: string;
  formValues: {
    brandName: string;
    classType: string;
    abv: string;
    netContents: string;
    governmentWarning: string;
  };
  labelValues: {
    brandName: string;
    classType: string;
    abv: string;
    netContents: string;
    governmentWarning: string;
  };
  imageData: string; // Base64 dataURL
  status: "pending" | "verifying" | "success" | "failed";
  report: VerificationReport | null;
  errorMessage: string | null;
}

interface BatchDashboardProps {
  apiKey: string;
}

export default function BatchDashboard({ apiKey }: BatchDashboardProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [concurrency, setConcurrency] = useState(2);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate a mock batch of labels for testing
  const generateMockBatch = () => {
    if (!hiddenCanvasRef.current) return;
    const canvas = hiddenCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 360;

    const mockData = [
      {
        id: "batch-1",
        name: "Application #48291 (OLD TOM - Compliant)",
        form: {
          brandName: "OLD TOM DISTILLERY",
          classType: "Kentucky Straight Bourbon Whiskey",
          abv: "45% Alc./Vol.",
          netContents: "750 mL",
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
        },
        label: {
          brandName: "OLD TOM DISTILLERY",
          classType: "Kentucky Straight Bourbon Whiskey",
          abv: "45% Alc./Vol. (90 Proof)",
          netContents: "750 mL",
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
        }
      },
      {
        id: "batch-2",
        name: "Application #48292 (STONE'S THROW - Minor Typo)",
        form: {
          brandName: "Stone's Throw",
          classType: "Dry Gin",
          abv: "40% ABV",
          netContents: "1 L",
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
        },
        label: {
          brandName: "STONE'S THROW",
          classType: "Dry Gin",
          abv: "40% Alc./Vol.",
          netContents: "1 L",
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
        }
      },
      {
        id: "batch-3",
        name: "Application #48293 (HIGHLAND MIST - Warning Casing Error)",
        form: {
          brandName: "HIGHLAND MIST",
          classType: "Single Malt Scotch Whisky",
          abv: "43% Alc./Vol.",
          netContents: "700 mL",
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
        },
        label: {
          brandName: "HIGHLAND MIST",
          classType: "Single Malt Scotch Whisky",
          abv: "43% Alc./Vol.",
          netContents: "700 mL",
          // Lowercase government warning prefix
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL.replace("GOVERNMENT WARNING:", "Government Warning:"),
        }
      },
      {
        id: "batch-4",
        name: "Application #48294 (EL DORADO - Warning Typo)",
        form: {
          brandName: "EL DORADO",
          classType: "Tequila Reposado",
          abv: "40% Alc./Vol.",
          netContents: "750 mL",
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
        },
        label: {
          brandName: "EL DORADO",
          classType: "Tequila Reposado",
          abv: "40% Alc./Vol.",
          netContents: "750 mL",
          // Mismatch in text wording
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL.replace("Surgeon General", "Sergeon General"),
        }
      },
      {
        id: "batch-5",
        name: "Application #48295 (CHATEAU ROUGE - ABV Mismatch)",
        form: {
          brandName: "CHATEAU ROUGE",
          classType: "Red Wine",
          abv: "13.5% Alc./Vol.",
          netContents: "750 mL",
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
        },
        label: {
          brandName: "CHATEAU ROUGE",
          classType: "Red Wine",
          abv: "14.5% Alc./Vol.", // 1% mismatch!
          netContents: "750 mL",
          governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL,
        }
      }
    ];

    const generatedItems: BatchItem[] = mockData.map(item => {
      // Render the image dynamically onto the hidden canvas
      ctx.fillStyle = "#fafaf9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw border
      ctx.strokeStyle = "#d6d3d1";
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Brand Name
      ctx.fillStyle = "#1c1917";
      ctx.textAlign = "center";
      ctx.font = "bold 20px Georgia, serif";
      ctx.fillText(item.label.brandName.toUpperCase(), canvas.width / 2, 60);

      // Class/Type
      ctx.font = "italic 14px Georgia, serif";
      ctx.fillStyle = "#44403c";
      ctx.fillText(item.label.classType, canvas.width / 2, 100);

      // ABV / Net
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.fillStyle = "#1c1917";
      ctx.fillText(`${item.label.abv}  •  ${item.label.netContents}`, canvas.width / 2, 130);

      // Warning text block
      ctx.fillStyle = "rgba(0,0,0,0.02)";
      ctx.fillRect(25, 160, canvas.width - 50, 175);
      ctx.strokeStyle = "#e7e5e4";
      ctx.strokeRect(25, 160, canvas.width - 50, 175);

      ctx.fillStyle = "#57534e";
      ctx.font = "7.5px Arial, sans-serif";
      const warningWords = item.label.governmentWarning.split(/\s+/);
      let line = "";
      let y = 175;
      const maxWidth = canvas.width - 70;
      const lineHeight = 10;

      for (let n = 0; n < warningWords.length; n++) {
        const testLine = line + warningWords[n] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, canvas.width / 2, y);
          line = warningWords[n] + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, canvas.width / 2, y);

      const base64Image = canvas.toDataURL("image/png");

      return {
        id: item.id,
        name: item.name,
        formValues: item.form,
        labelValues: item.label,
        imageData: base64Image,
        status: "pending",
        report: null,
        errorMessage: null
      };
    });

    setItems(generatedItems);
    setProcessing(false);
    setExpandedItemId(null);
  };

  // Run the batch pipeline with concurrency control
  const runBatch = async () => {
    if (items.length === 0) return;
    setProcessing(true);

    // Filter items that need verification
    const pendingItems = items.filter(item => item.status === "pending" || item.status === "failed");
    const queue = [...pendingItems];

    const runWorker = async (): Promise<void> => {
      if (queue.length === 0) return;
      const currentItem = queue.shift()!;
      
      // Update status to verifying
      setItems(prev => prev.map(it => it.id === currentItem.id ? { ...it, status: "verifying" } : it));

      try {
        const response = await fetch("/api/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image: currentItem.imageData,
            imageType: "image/png",
            formValues: currentItem.formValues,
            apiKeyOverride: apiKey
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed processing label.");
        }

        setItems(prev => prev.map(it => 
          it.id === currentItem.id 
            ? { ...it, status: "success", report: data.report, errorMessage: null } 
            : it
        ));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error occurred";
        setItems(prev => prev.map(it => 
          it.id === currentItem.id 
            ? { ...it, status: "failed", errorMessage: message } 
            : it
        ));
      } finally {
        // Recurse to handle next item in queue
        await runWorker();
      }
    };

    // Spawn workers based on concurrency limit
    const workers = [];
    const numWorkers = Math.min(concurrency, queue.length);
    for (let i = 0; i < numWorkers; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
    setProcessing(false);
  };

  const clearBatch = () => {
    setItems([]);
    setProcessing(false);
    setExpandedItemId(null);
  };

  // Statistics
  const totalItems = items.length;
  const completedItems = items.filter(i => i.status === "success").length;
  const failedItems = items.filter(i => i.status === "failed").length;
  const pendingItems = items.filter(i => i.status === "pending").length;
  const verifyingItems = items.filter(i => i.status === "verifying").length;
  
  const compliantCount = items.filter(i => i.report?.overallStatus === "MATCH").length;
  const warningCount = items.filter(i => i.report?.overallStatus === "WARNING").length;
  const nonCompliantCount = items.filter(i => i.report?.overallStatus === "MISMATCH").length;

  const progressPct = totalItems > 0 ? Math.round(((completedItems + failedItems) / totalItems) * 100) : 0;

  // Diff rendering helper
  const renderDiff = (diff: DiffPart[] | undefined) => {
    if (!diff) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem", backgroundColor: "rgba(15,23,42,0.6)", padding: "0.5rem", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.7rem", marginTop: "0.25rem" }}>
        {diff.map((part, index) => {
          if (part.type === "match") return <span key={index} style={{ color: "var(--text-primary)" }}>{part.value}</span>;
          if (part.type === "mismatch-case") return <span key={index} style={{ color: "var(--color-warning)", textDecoration: "underline" }}>{part.value}</span>;
          if (part.type === "added") return <span key={index} style={{ backgroundColor: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "0 2px" }}>{part.value}</span>;
          return <span key={index} style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#f87171", padding: "0 2px", textDecoration: "line-through" }}>{part.value}</span>;
        })}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Hidden canvas to render mock labels */}
      <canvas ref={hiddenCanvasRef} style={{ display: "none" }} />

      {/* Control Panel */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Layers size={22} className="gradient-text" style={{ stroke: "var(--primary)" }} />
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "600" }}>Batch Verification Engine</h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Process multiple label applications concurrently with visual queue monitoring.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {items.length === 0 ? (
            <button
              onClick={generateMockBatch}
              style={{
                padding: "0.625rem 1rem",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--bg-tertiary)",
                border: "none",
                color: "var(--text-primary)",
                fontWeight: "600",
                fontSize: "0.825rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem"
              }}
            >
              <FileSpreadsheet size={16} /> Load Sample Import Batch (5 items)
            </button>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Workers:</span>
                <select
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value))}
                  disabled={processing}
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--bg-tertiary)",
                    borderRadius: "4px",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    outline: "none"
                  }}
                >
                  <option value={1}>1 worker</option>
                  <option value={2}>2 workers (Parallel)</option>
                  <option value={3}>3 workers (Fast)</option>
                </select>
              </div>

              <button
                onClick={runBatch}
                disabled={processing || pendingItems === 0}
                style={{
                  padding: "0.625rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: processing ? "var(--bg-tertiary)" : "var(--primary)",
                  color: "white",
                  border: "none",
                  fontWeight: "600",
                  fontSize: "0.825rem",
                  cursor: processing || pendingItems === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  transition: "background-color var(--transition-fast)"
                }}
              >
                {processing ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} /> Verifying...
                  </>
                ) : (
                  <>
                    <Play size={16} /> Run Pipeline
                  </>
                )}
              </button>

              <button
                onClick={clearBatch}
                disabled={processing}
                style={{
                  padding: "0.625rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  color: "var(--color-mismatch)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  fontWeight: "600",
                  fontSize: "0.825rem",
                  cursor: processing ? "not-allowed" : "pointer"
                }}
              >
                Clear Queue
              </button>
            </>
          )}
        </div>
      </div>

      {/* Batch Stats & Progress bar */}
      {items.length > 0 && (
        <div className="glass-panel" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Progress row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.825rem", fontWeight: "600", color: "var(--text-secondary)" }}>
              {processing ? "Verification Progress" : "Queue Status"}
            </span>
            <span style={{ fontSize: "0.825rem", fontWeight: "700", color: "var(--primary)" }}>
              {completedItems + failedItems} / {totalItems} processed ({progressPct}%)
            </span>
          </div>

          <div style={{ width: "100%", height: "8px", backgroundColor: "var(--bg-primary)", borderRadius: "4px", overflow: "hidden" }}>
            <div 
              style={{ 
                width: `${progressPct}%`, 
                height: "100%", 
                backgroundColor: "var(--primary)", 
                borderRadius: "4px",
                transition: "width 0.4s ease-out"
              }} 
            />
          </div>

          {/* Cards stats grid */}
          <div 
            style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", 
              gap: "0.75rem",
              marginTop: "0.25rem" 
            }}
          >
            <div style={{ backgroundColor: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--bg-tertiary)" }}>
              <div style={{ fontSize: "0.675rem", color: "var(--text-muted)", fontWeight: "600" }}>PENDING</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Clock size={16} style={{ color: "var(--text-muted)" }} /> {pendingItems}
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--bg-tertiary)" }}>
              <div style={{ fontSize: "0.675rem", color: "var(--text-muted)", fontWeight: "600" }}>VERIFYING</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <RefreshCw size={16} className={verifyingItems > 0 ? "animate-spin" : ""} style={{ color: "var(--primary)" }} /> {verifyingItems}
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(16,185,129,0.02)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-match-border)" }}>
              <div style={{ fontSize: "0.675rem", color: "var(--color-match)", fontWeight: "600" }}>COMPLIANT</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--color-match)" }}>
                {compliantCount}
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(245,158,11,0.02)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-warning-border)" }}>
              <div style={{ fontSize: "0.675rem", color: "var(--color-warning)", fontWeight: "600" }}>WARNINGS</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--color-warning)" }}>
                {warningCount}
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(239,68,68,0.02)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-mismatch-border)" }}>
              <div style={{ fontSize: "0.675rem", color: "var(--color-mismatch)", fontWeight: "600" }}>NON-COMPLIANT</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--color-mismatch)" }}>
                {nonCompliantCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue items list */}
      {items.length === 0 ? (
        <div 
          className="glass-panel" 
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center", 
            minHeight: "250px", 
            gap: "1rem", 
            textAlign: "center",
            padding: "2rem"
          }}
        >
          <Layers size={48} style={{ color: "var(--text-muted)", strokeWidth: 1.2 }} />
          <div>
            <h4 style={{ fontSize: "1rem", fontWeight: "600" }}>Batch Queue Empty</h4>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", maxWidth: "340px", margin: "0.25rem auto 0" }}>
              Load the sample batch dataset above, or configure multiple CSV applications to initiate batch testing.
            </p>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--bg-tertiary)" }}>
                  <th style={{ padding: "1rem" }}>Application / Label File</th>
                  <th style={{ padding: "1rem" }}>Brand Name</th>
                  <th style={{ padding: "1rem" }}>ABV</th>
                  <th style={{ padding: "1rem" }}>Status</th>
                  <th style={{ padding: "1rem", width: "80px" }}>Review</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  
                  return (
                    <React.Fragment key={item.id}>
                      <tr 
                        onClick={() => item.status === "success" && setExpandedItemId(isExpanded ? null : item.id)}
                        style={{ 
                          borderBottom: "1px solid rgba(255,255,255,0.03)", 
                          cursor: item.status === "success" ? "pointer" : "default",
                          backgroundColor: isExpanded ? "rgba(255,255,255,0.01)" : "transparent",
                          transition: "background-color var(--transition-fast)"
                        }}
                        className={item.status === "success" ? "hover:bg-slate-800" : ""}
                      >
                        <td style={{ padding: "0.875rem 1rem", fontWeight: "500" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={item.imageData} 
                              alt="Thumbnail" 
                              style={{ width: "36px", height: "36px", objectFit: "cover", borderRadius: "4px", backgroundColor: "#000", border: "1px solid var(--bg-tertiary)" }} 
                            />
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "0.875rem 1rem", fontFamily: "monospace" }}>{item.formValues.brandName}</td>
                        <td style={{ padding: "0.875rem 1rem", fontFamily: "monospace" }}>{item.formValues.abv}</td>
                        <td style={{ padding: "0.875rem 1rem" }}>
                          {item.status === "pending" && (
                            <span style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: "600" }}>
                              <Clock size={14} /> Pending
                            </span>
                          )}
                          {item.status === "verifying" && (
                            <span style={{ color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: "600" }}>
                              <RefreshCw size={14} className="animate-spin" /> Verifying
                            </span>
                          )}
                          {item.status === "failed" && (
                            <span style={{ color: "var(--color-mismatch)", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: "600" }} title={item.errorMessage || ""}>
                              <AlertCircle size={14} /> Failed API
                            </span>
                          )}
                          {item.status === "success" && (
                            <span 
                              style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "0.25rem", 
                                fontSize: "0.75rem", 
                                fontWeight: "600",
                                color: 
                                  item.report?.overallStatus === "MATCH" 
                                    ? "var(--color-match)" 
                                    : item.report?.overallStatus === "WARNING"
                                    ? "var(--color-warning)"
                                    : "var(--color-mismatch)"
                              }}
                            >
                              {item.report?.overallStatus === "MATCH" && (
                                <>
                                  <CheckCircle2 size={14} /> Compliant
                                </>
                              )}
                              {item.report?.overallStatus === "WARNING" && (
                                <>
                                  <AlertTriangle size={14} /> Warning
                                </>
                              )}
                              {item.report?.overallStatus === "MISMATCH" && (
                                <>
                                  <XCircle size={14} /> Mismatch
                                </>
                              )}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                          {item.status === "success" && (
                            <button 
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded side-by-side verification report for batch row */}
                      {isExpanded && item.status === "success" && (
                        <tr style={{ backgroundColor: "rgba(15,23,42,0.5)" }}>
                          <td colSpan={5} style={{ padding: "1.25rem", borderBottom: "1px solid var(--bg-tertiary)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem", alignItems: "start" }}>
                              
                              {/* Left: Artwork Preview */}
                              <div>
                                  <h5 style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                                    Label Image
                                  </h5>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img 
                                    src={item.imageData} 
                                    alt="Artwork" 
                                    style={{ width: "100%", maxHeight: "250px", objectFit: "contain", borderRadius: "8px", border: "1px solid var(--bg-tertiary)", backgroundColor: "#020617" }} 
                                  />
                              </div>

                              {/* Right: Compliance Report Fields */}
                              <div>
                                <h5 style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                                  Compliance Comparison
                                </h5>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                  {item.report && Object.entries(item.report.fields).map(([fieldName, fieldVal]: [string, VerificationFieldResult]) => {
                                    const fieldTitle = fieldName.replace(/([A-Z])/g, " $1").replace(/^./, (str: string) => str.toUpperCase());
                                    
                                    return (
                                      <div key={fieldName} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: "0.5rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                          <span style={{ fontSize: "0.75rem", fontWeight: "600" }}>{fieldTitle}</span>
                                          <span style={{ 
                                            fontSize: "0.65rem", 
                                            fontWeight: "700",
                                            color: 
                                              fieldVal.status === "MATCH" 
                                                ? "var(--color-match)" 
                                                : fieldVal.status === "WARNING"
                                                ? "var(--color-warning)"
                                                : "var(--color-mismatch)"
                                          }}>
                                            {fieldVal.status}
                                          </span>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.25rem", fontFamily: "monospace" }}>
                                          <div>
                                            <span style={{ color: "var(--text-muted)" }}>Form:</span> {fieldVal.expected}
                                          </div>
                                          <div>
                                            <span style={{ color: "var(--text-muted)" }}>Label:</span> {fieldVal.actual}
                                          </div>
                                        </div>

                                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                                          {fieldVal.message}
                                        </p>

                                        {fieldVal.diff && renderDiff(fieldVal.diff)}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
