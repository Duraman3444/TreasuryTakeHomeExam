"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, XCircle, 
  RefreshCw, FileImage, ShieldCheck, ChevronRight, CornerDownRight, 
  RotateCcw, Sparkles
} from "lucide-react";
import { LABEL_SAMPLES } from "@/lib/samples";
import { STANDARD_GOVERNMENT_WARNING_FULL, VerificationReport, VerificationFieldResult, DiffPart } from "@/lib/verifier";

interface VerificationDashboardProps {
  apiKey: string;
}

export default function VerificationDashboard({ apiKey }: VerificationDashboardProps) {
  const [selectedSampleId, setSelectedSampleId] = useState<string>(LABEL_SAMPLES[0].id);
  const [formValues, setFormValues] = useState(LABEL_SAMPLES[0].formValues);
  const [labelValues, setLabelValues] = useState(LABEL_SAMPLES[0].labelValues);
  
  // Custom uploaded image or canvas base64
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string>("image/png");
  const [dragActive, setDragActive] = useState(false);
  
  // Verification states
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ report: VerificationReport; extracted: unknown } | null>(null);

  // Decision states
  const [decision, setDecision] = useState<"approve" | "reject" | "resubmit" | null>(null);
  const [agentNotes, setAgentNotes] = useState("");
  const [decisionSubmitted, setDecisionSubmitted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load a preset sample
  const handleLoadSample = (sampleId: string) => {
    const sample = LABEL_SAMPLES.find(s => s.id === sampleId);
    if (sample) {
      setSelectedSampleId(sampleId);
      setFormValues({ ...sample.formValues });
      setLabelValues({ ...sample.labelValues });
      setUploadedImage(null);
      setResult(null);
      setDecision(null);
      setAgentNotes("");
      setDecisionSubmitted(false);
    }
  };

  // Render mock label to HTML5 canvas
  const drawLabel = () => {
    const canvas = canvasRef.current;
    if (!canvas || uploadedImage) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sample = LABEL_SAMPLES.find(s => s.id === selectedSampleId);
    const options = sample?.canvasOptions || {};

    // Base dimensions
    canvas.width = 400;
    canvas.height = 360;

    // Draw background (parchment/paper style or dark metal)
    if (options.darkBg) {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "#1e293b");
      grad.addColorStop(1, "#0f172a");
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "#fafaf9");
      grad.addColorStop(1, "#f5f5f4");
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vignette or lighting effect
    if (options.badLighting) {
      const radialGrad = ctx.createRadialGradient(
        canvas.width * 0.3, canvas.height * 0.3, 20,
        canvas.width / 2, canvas.height / 2, canvas.width
      );
      radialGrad.addColorStop(0, "rgba(255,255,255,0.1)");
      radialGrad.addColorStop(0.5, "rgba(0,0,0,0.15)");
      radialGrad.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Border line
    ctx.strokeStyle = options.darkBg ? "rgba(255,255,255,0.1)" : "#d6d3d1";
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
    ctx.lineWidth = 1;
    ctx.strokeStyle = options.darkBg ? "rgba(255,255,255,0.05)" : "#e7e5e4";
    ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);

    // Text configuration
    ctx.fillStyle = options.darkBg ? "#f8fafc" : "#1c1917";
    ctx.textAlign = "center";

    // Brand Name
    ctx.font = "bold 24px Georgia, serif";
    ctx.fillText(labelValues.brandName.toUpperCase(), canvas.width / 2, 70);

    // Divider line
    ctx.strokeStyle = options.darkBg ? "#a855f7" : "#c084fc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 88);
    ctx.lineTo(canvas.width - 80, 88);
    ctx.stroke();

    // Class / Type
    ctx.fillStyle = options.darkBg ? "#94a3b8" : "#44403c";
    ctx.font = "italic 16px Georgia, serif";
    ctx.fillText(labelValues.classType, canvas.width / 2, 115);

    // ABV and Net Contents
    ctx.fillStyle = options.darkBg ? "#f8fafc" : "#1c1917";
    ctx.font = "bold 14px Arial, sans-serif";
    ctx.fillText(`${labelValues.abv}  •  ${labelValues.netContents}`, canvas.width / 2, 150);

    // Government Warning Panel
    ctx.strokeStyle = options.darkBg ? "rgba(255,255,255,0.1)" : "#e7e5e4";
    ctx.fillStyle = options.darkBg ? "rgba(15,23,42,0.6)" : "rgba(250,250,249,0.8)";
    ctx.fillRect(35, 175, canvas.width - 70, 150);
    ctx.strokeRect(35, 175, canvas.width - 70, 150);

    // Render Government Warning text wrap
    ctx.fillStyle = options.darkBg ? "#94a3b8" : "#57534e";
    const text = labelValues.governmentWarning;
    const x = canvas.width / 2;
    let y = 195;
    const maxWidth = canvas.width - 90;
    const lineHeight = 11;

    // Detect if we draw first few words in Bold
    const warningWords = text.split(/\s+/);
    let currentLine = "";
    
    ctx.font = "8px Arial, sans-serif";

    for (let n = 0; n < warningWords.length; n++) {
      const testLine = currentLine + warningWords[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        // Draw the current line
        drawWarningLine(ctx, currentLine, x, y, options.darkBg);
        currentLine = warningWords[n] + " ";
        y += lineHeight;
      } else {
        currentLine = testLine;
      }
    }
    drawWarningLine(ctx, currentLine, x, y, options.darkBg);
  };

  // Helper to draw a single line of warning text, bolding the prefix if it exists
  const drawWarningLine = (ctx: CanvasRenderingContext2D, lineText: string, x: number, y: number, isDark?: boolean) => {
    // If the line contains "GOVERNMENT WARNING:" or "Government Warning:"
    const prefixMatch = lineText.match(/^(GOVERNMENT WARNING:|Government Warning:)/i);
    if (prefixMatch) {
      const prefix = prefixMatch[0];
      const rest = lineText.slice(prefix.length);
      
      ctx.font = "bold 8.5px Arial, sans-serif";
      ctx.fillStyle = isDark ? "#f8fafc" : "#1c1917";
      
      const prefixWidth = ctx.measureText(prefix).width;
      const totalWidth = prefixWidth + ctx.measureText(rest).width;
      
      const startX = x - totalWidth / 2;
      
      // Draw bold prefix
      ctx.textAlign = "left";
      ctx.fillText(prefix, startX, y);
      
      // Draw regular body
      ctx.font = "8px Arial, sans-serif";
      ctx.fillStyle = isDark ? "#94a3b8" : "#57534e";
      ctx.fillText(rest, startX + prefixWidth, y);
      ctx.textAlign = "center";
    } else {
      ctx.font = "8px Arial, sans-serif";
      ctx.fillText(lineText.trim(), x, y);
    }
  };

  // Redraw canvas whenever sample values or preset changes
  useEffect(() => {
    drawLabel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSampleId, labelValues, uploadedImage]);

  // Handle manual input form changes
  const handleInputChange = (field: string, value: string) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  };

  // Handle mock label text changes (lets user simulate typos on the fly!)
  const handleLabelTextChange = (field: string, value: string) => {
    setLabelValues(prev => ({ ...prev, [field]: value }));
  };

  // File Upload Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG or JPEG)");
      return;
    }
    setImageType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setUploadedImage(e.target.result as string);
        setResult(null);
        setDecision(null);
        setDecisionSubmitted(false);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    setResult(null);
    setDecision(null);
    // Reload active sample text
    handleLoadSample(selectedSampleId);
  };

  // Trigger compliance verification
  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setDecision(null);
    setDecisionSubmitted(false);

    try {
      let imageData = "";
      
      if (uploadedImage) {
        imageData = uploadedImage;
      } else if (canvasRef.current) {
        imageData = canvasRef.current.toDataURL(imageType);
      } else {
        throw new Error("No image target detected for verification.");
      }

      setLoadingStep("Extracting fields with Google Gemini AI...");
      
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageData,
          imageType,
          formValues,
          apiKeyOverride: apiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Compliance API returned an error.");
      }

      setLoadingStep("Comparing parameters & generating compliance scores...");
      
      // Artificial delay to make transition smoother and readable for user (under 1s)
      await new Promise(r => setTimeout(r, 600));

      setResult(data);

      // Pre-fill agent notes based on overall status
      if (data.report.overallStatus === "MATCH") {
        setDecision("approve");
        setAgentNotes("All verification parameters match. Label complies with TTB criteria.");
      } else if (data.report.overallStatus === "WARNING") {
        setDecision("approve");
        setAgentNotes("Minor issues detected (formatting/casing). Review matches closely, acceptable for clearance.");
      } else {
        setDecision("reject");
        // Aggregate compliance errors
        const errors: string[] = [];
        Object.entries(data.report.fields as Record<string, VerificationFieldResult>).forEach(([fieldName, val]) => {
          if (val.status === "MISMATCH") {
            errors.push(`- ${fieldName.toUpperCase()}: ${val.message}`);
          }
        });
        setAgentNotes(`Label application rejected due to compliance discrepancies:\n${errors.join("\n")}`);
      }

    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleDecisionSubmit = () => {
    setDecisionSubmitted(true);
  };

  // Diff rendering helper
  const renderDiff = (diff: DiffPart[] | undefined) => {
    if (!diff) return null;
    return (
      <div 
        style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          gap: "0.25rem", 
          backgroundColor: "rgba(15,23,42,0.4)", 
          padding: "0.5rem 0.75rem", 
          borderRadius: "var(--radius-sm)", 
          fontFamily: "monospace", 
          fontSize: "0.75rem",
          marginTop: "0.375rem",
          lineHeight: "1.4",
          border: "1px solid rgba(255,255,255,0.05)"
        }}
      >
        {diff.map((part, index) => {
          if (part.type === "match") {
            return <span key={index} style={{ color: "var(--text-primary)" }}>{part.value}</span>;
          } else if (part.type === "mismatch-case") {
            return (
              <span 
                key={index} 
                title="Casing Mismatch"
                style={{ 
                  color: "var(--color-warning)", 
                  textDecoration: "underline", 
                  fontWeight: "bold",
                  padding: "0 2px"
                }}
              >
                {part.value}
              </span>
            );
          } else if (part.type === "added") {
            return (
              <span 
                key={index} 
                title="Added Word"
                style={{ 
                  backgroundColor: "rgba(16, 185, 129, 0.25)", 
                  color: "#34d399", 
                  padding: "0 4px", 
                  borderRadius: "2px", 
                  border: "1px dashed var(--color-match)" 
                }}
              >
                {part.value}
              </span>
            );
          } else { // removed
            return (
              <span 
                key={index} 
                title="Missing Word"
                style={{ 
                  backgroundColor: "rgba(239, 68, 68, 0.2)", 
                  color: "#f87171", 
                  padding: "0 4px", 
                  borderRadius: "2px", 
                  textDecoration: "line-through" 
                }}
              >
                {part.value}
              </span>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Sample Selector Toolbar */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: "1rem", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sparkles size={18} style={{ color: "var(--accent-purple)" }} />
          <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>Load Preset Test Case:</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {LABEL_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleLoadSample(sample.id)}
              disabled={uploadedImage !== null}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                fontWeight: "500",
                cursor: uploadedImage !== null ? "not-allowed" : "pointer",
                backgroundColor: selectedSampleId === sample.id && !uploadedImage ? "var(--primary)" : "var(--bg-tertiary)",
                color: selectedSampleId === sample.id && !uploadedImage ? "white" : "var(--text-secondary)",
                border: "none",
                opacity: uploadedImage !== null ? 0.5 : 1,
                transition: "background-color var(--transition-fast)"
              }}
            >
              {sample.name.split(" ")[0] + " " + sample.name.split(" ")[1]}
            </button>
          ))}
        </div>
      </div>

      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", 
          gap: "1.5rem",
          alignItems: "start"
        }}
      >
        {/* LEFT COLUMN: Input form and Image Display */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Label Canvas / Image Card */}
          <div className="glass-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "600" }}>Label Artwork</h3>
              {uploadedImage && (
                <button 
                  onClick={clearUploadedImage}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-mismatch)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem"
                  }}
                >
                  <RotateCcw size={14} /> Clear Upload
                </button>
              )}
            </div>

            <div style={{ position: "relative", width: "100%", maxWidth: "400px", aspectRatio: "4/3.6", display: "flex", justifyContent: "center" }}>
              {uploadedImage ? (
                <div style={{ width: "100%", height: "100%", borderRadius: "var(--radius-md)", overflow: "hidden", border: "2px dashed var(--bg-tertiary)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded label" 
                    style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#020617" }} 
                  />
                </div>
              ) : (
                <canvas 
                  ref={canvasRef} 
                  style={{ 
                    borderRadius: "var(--radius-md)", 
                    maxWidth: "100%", 
                    boxShadow: "0 10px 30px rgba(0,0,0,0.3)" 
                  }} 
                />
              )}
            </div>

            {!uploadedImage && (
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", maxWidth: "90%" }}>
                {LABEL_SAMPLES.find(s => s.id === selectedSampleId)?.description}
              </p>
            )}

            {/* Dynamic Label Editor (Only shown when testing presets, allows interactive testing) */}
            {!uploadedImage && (
              <div 
                style={{ 
                  width: "100%", 
                  borderTop: "1px solid var(--bg-tertiary)", 
                  paddingTop: "0.75rem", 
                  marginTop: "0.5rem" 
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", display: "block", marginBottom: "0.5rem" }}>
                  Interactive Label Canvas Editor (modify text to update the image dynamically):
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input
                    type="text"
                    value={labelValues.brandName}
                    onChange={(e) => handleLabelTextChange("brandName", e.target.value)}
                    placeholder="Brand on label"
                    style={{
                      padding: "0.375rem 0.5rem",
                      fontSize: "0.75rem",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      borderRadius: "4px",
                    }}
                  />
                  <input
                    type="text"
                    value={labelValues.abv}
                    onChange={(e) => handleLabelTextChange("abv", e.target.value)}
                    placeholder="ABV on label"
                    style={{
                      padding: "0.375rem 0.5rem",
                      fontSize: "0.75rem",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <textarea
                  value={labelValues.governmentWarning}
                  onChange={(e) => handleLabelTextChange("governmentWarning", e.target.value)}
                  placeholder="Government Warning on label"
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "0.375rem 0.5rem",
                    fontSize: "0.7rem",
                    fontFamily: "monospace",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    borderRadius: "4px",
                    resize: "none",
                  }}
                />
              </div>
            )}

            {/* Custom File Upload Dropper */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
                border: dragActive ? "2px dashed var(--primary)" : "2px dashed var(--bg-tertiary)",
                backgroundColor: dragActive ? "var(--primary-glow)" : "rgba(15,23,42,0.2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                transition: "all var(--transition-fast)"
              }}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                style={{ display: "none" }} 
                onChange={handleFileChange}
                accept="image/*"
              />
              <Upload size={22} style={{ color: "var(--text-muted)" }} />
              <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                Drag & drop custom label, or <span style={{ color: "var(--primary)", textDecoration: "underline" }}>browse files</span>
              </p>
              <p style={{ fontSize: "0.675rem", color: "var(--text-muted)" }}>Supports PNG, JPEG up to 5MB</p>
            </div>
          </div>

          {/* Reference Application Form */}
          <div className="glass-panel">
            <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={18} style={{ color: "var(--accent-blue)" }} />
              COLA Form Parameters (Reference)
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                  Brand Name
                </label>
                <input
                  type="text"
                  value={formValues.brandName}
                  onChange={(e) => handleInputChange("brandName", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.875rem",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    Class / Type
                  </label>
                  <input
                    type="text"
                    value={formValues.classType}
                    onChange={(e) => handleInputChange("classType", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.875rem",
                      outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    ABV (%)
                  </label>
                  <input
                    type="text"
                    value={formValues.abv}
                    onChange={(e) => handleInputChange("abv", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "var(--bg-primary)",
                      border: "1px solid var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.875rem",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                  Net Contents (e.g. 750 mL)
                </label>
                <input
                  type="text"
                  value={formValues.netContents}
                  onChange={(e) => handleInputChange("netContents", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.875rem",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                    Government warning
                  </label>
                  <button
                    onClick={() => handleInputChange("governmentWarning", STANDARD_GOVERNMENT_WARNING_FULL)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "0.65rem",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    Reset to Standard CFR text
                  </button>
                </div>
                <textarea
                  value={formValues.governmentWarning}
                  onChange={(e) => handleInputChange("governmentWarning", e.target.value)}
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    outline: "none",
                    resize: "none"
                  }}
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.875rem",
                  marginTop: "0.5rem",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: loading ? "var(--bg-tertiary)" : "var(--primary)",
                  color: "white",
                  border: "none",
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  transition: "background-color var(--transition-fast)"
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Verify Label Compliance
                  </>
                )}
              </button>
              
              {!apiKey && (
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.25rem" }}>
                  * Note: If no API key is entered, server-side environment variables will be used.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Results, Loading or Empty Placeholder */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Loading State */}
          {loading && (
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "350px", gap: "1.5rem" }}>
              <div style={{ position: "relative", width: "80px", height: "80px" }}>
                <div style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", border: "4px solid var(--bg-tertiary)" }} />
                <div style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", border: "4px solid transparent", borderTopColor: "var(--primary)", animation: "spin 1s linear infinite" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <h4 style={{ fontSize: "1.125rem", fontWeight: "600" }}>Analyzing Label Compliance</h4>
                <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.375rem" }}>{loadingStep}</p>
              </div>
              <div style={{ width: "80%", height: "4px", backgroundColor: "var(--bg-tertiary)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ width: "60%", height: "100%", backgroundColor: "var(--primary)", borderRadius: "2px", animation: "progressPulse 1.5s ease-in-out infinite" }} />
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="glass-panel" style={{ borderLeft: "4px solid var(--color-mismatch)" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <XCircle style={{ color: "var(--color-mismatch)", flexShrink: 0 }} size={22} />
                <div>
                  <h4 style={{ fontSize: "1rem", fontWeight: "600", color: "var(--color-mismatch)" }}>Verification Failed</h4>
                  <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>{error}</p>
                  <button 
                    onClick={handleVerify}
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.75rem",
                      backgroundColor: "var(--bg-tertiary)",
                      border: "none",
                      borderRadius: "4px",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem"
                    }}
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State / Standby */}
          {!loading && !error && !result && (
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "450px", gap: "1.25rem", textAlign: "center", padding: "2rem" }}>
              <FileImage size={56} style={{ color: "var(--text-muted)", strokeWidth: 1.2 }} />
              <div>
                <h4 style={{ fontSize: "1.125rem", fontWeight: "600" }}>Awaiting Verification</h4>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", maxWidth: "300px", margin: "0.5rem auto 0" }}>
                  Adjust parameters, draw your sample label or upload an artwork, and click the verify button to scan compliance.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  onClick={handleVerify}
                  disabled={!apiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "rgba(99,102,241,0.1)",
                    border: "1px solid var(--primary)",
                    color: "var(--primary)",
                    fontSize: "0.825rem",
                    fontWeight: "600",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    transition: "all var(--transition-fast)"
                  }}
                >
                  Quick Scan (Active Sample)
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS RESULT VIEW */}
          {!loading && !error && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Overall status card */}
              <div 
                className="glass-panel" 
                style={{ 
                  borderLeft: `5px solid ${
                    result.report.overallStatus === "MATCH" 
                      ? "var(--color-match)" 
                      : result.report.overallStatus === "WARNING"
                      ? "var(--color-warning)"
                      : "var(--color-mismatch)"
                  }`,
                  padding: "1.25rem 1.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Scan Compliance Result
                    </span>
                    <h2 
                      style={{ 
                        fontSize: "1.5rem", 
                        fontWeight: "800",
                        marginTop: "0.125rem",
                        color: 
                          result.report.overallStatus === "MATCH" 
                            ? "var(--color-match)" 
                            : result.report.overallStatus === "WARNING"
                            ? "var(--color-warning)"
                            : "var(--color-mismatch)"
                      }}
                    >
                      {result.report.overallStatus === "MATCH" && "COMPLIANT"}
                      {result.report.overallStatus === "WARNING" && "COMPLIANT WITH WARNINGS"}
                      {result.report.overallStatus === "MISMATCH" && "NON-COMPLIANT"}
                    </h2>
                  </div>
                  {result.report.overallStatus === "MATCH" && <CheckCircle2 size={42} style={{ color: "var(--color-match)" }} />}
                  {result.report.overallStatus === "WARNING" && <AlertTriangle size={42} style={{ color: "var(--color-warning)" }} />}
                  {result.report.overallStatus === "MISMATCH" && <XCircle size={42} style={{ color: "var(--color-mismatch)" }} />}
                </div>
              </div>

              {/* Field by field details */}
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "600", borderBottom: "1px solid var(--bg-tertiary)", paddingBottom: "0.5rem" }}>
                  Verification Details
                </h3>

                {Object.entries(result.report.fields as Record<string, VerificationFieldResult>).map(([key, value]) => {
                  const labelTitle = key.replace(/([A-Z])/g, " $1").replace(/^./, (str: string) => str.toUpperCase());
                  return (
                    <div 
                      key={key} 
                      style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        borderBottom: "1px solid rgba(255,255,255,0.03)", 
                        paddingBottom: "1rem" 
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>{labelTitle}</span>
                        <span 
                          style={{ 
                            fontSize: "0.675rem", 
                            fontWeight: "600", 
                            padding: "0.25rem 0.5rem", 
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            backgroundColor: 
                              value.status === "MATCH" 
                                ? "var(--color-match-bg)" 
                                : value.status === "WARNING"
                                ? "var(--color-warning-bg)"
                                : "var(--color-mismatch-bg)",
                            color: 
                              value.status === "MATCH" 
                                ? "var(--color-match)" 
                                : value.status === "WARNING"
                                ? "var(--color-warning)"
                                : "var(--color-mismatch)",
                            border: `1px solid ${
                              value.status === "MATCH" 
                                ? "var(--color-match-border)" 
                                : value.status === "WARNING"
                                ? "var(--color-warning-border)"
                                : "var(--color-mismatch-border)"
                            }`
                          }}
                        >
                          {value.status === "MATCH" && <CheckCircle2 size={10} />}
                          {value.status === "WARNING" && <AlertTriangle size={10} />}
                          {value.status === "MISMATCH" && <XCircle size={10} />}
                          {value.status}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.5rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--text-muted)", width: "70px", flexShrink: 0 }}>Form:</span>
                          <span style={{ fontFamily: "monospace" }}>{value.expected}</span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--text-muted)", width: "70px", flexShrink: 0 }}>Label:</span>
                          <span style={{ fontFamily: "monospace", color: value.status === "MISMATCH" ? "var(--color-mismatch)" : "inherit" }}>
                            {value.actual}
                          </span>
                        </div>
                      </div>

                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.375rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <CornerDownRight size={10} style={{ color: "var(--primary)", marginTop: "1px" }} />
                        {value.message}
                      </p>

                      {/* Render Visual Diff if there are mismatches or warnings */}
                      {value.diff && renderDiff(value.diff)}
                    </div>
                  );
                })}
              </div>

              {/* AGENT DECISION BOARD (Interactive final action) */}
              <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <ShieldCheck size={18} style={{ color: "var(--accent-purple)" }} />
                  Compliance Agent Actions
                </h3>

                {decisionSubmitted ? (
                  <div style={{ backgroundColor: "var(--color-match-bg)", border: "1px solid var(--color-match-border)", borderRadius: "var(--radius-md)", padding: "1rem", textAlign: "center" }}>
                    <CheckCircle2 size={32} style={{ color: "var(--color-match)", margin: "0 auto 0.5rem" }} />
                    <h4 style={{ color: "var(--color-match)", fontWeight: "600", fontSize: "0.95rem" }}>Decision Recorded</h4>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                      Application review finalized. Notification has been pushed to the importer registry.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                      <button
                        onClick={() => setDecision("approve")}
                        style={{
                          padding: "0.625rem 0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          backgroundColor: decision === "approve" ? "var(--color-match)" : "var(--bg-tertiary)",
                          color: decision === "approve" ? "white" : "var(--text-secondary)",
                          border: "none",
                          transition: "all var(--transition-fast)"
                        }}
                      >
                        Approve COLA
                      </button>
                      <button
                        onClick={() => setDecision("reject")}
                        style={{
                          padding: "0.625rem 0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          backgroundColor: decision === "reject" ? "var(--color-mismatch)" : "var(--bg-tertiary)",
                          color: decision === "reject" ? "white" : "var(--text-secondary)",
                          border: "none",
                          transition: "all var(--transition-fast)"
                        }}
                      >
                        Reject COLA
                      </button>
                      <button
                        onClick={() => setDecision("resubmit")}
                        style={{
                          padding: "0.625rem 0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          backgroundColor: decision === "resubmit" ? "var(--color-warning)" : "var(--bg-tertiary)",
                          color: decision === "resubmit" ? "white" : "var(--text-secondary)",
                          border: "none",
                          transition: "all var(--transition-fast)"
                        }}
                      >
                        Need Corrections
                      </button>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                        Compliance Review Notes / Feedback to Importer:
                      </label>
                      <textarea
                        value={agentNotes}
                        onChange={(e) => setAgentNotes(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          backgroundColor: "var(--bg-primary)",
                          border: "1px solid var(--bg-tertiary)",
                          color: "var(--text-primary)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                          outline: "none",
                          resize: "none"
                        }}
                      />
                    </div>

                    <button
                      onClick={handleDecisionSubmit}
                      style={{
                        padding: "0.625rem",
                        backgroundColor: "var(--text-primary)",
                        color: "var(--bg-primary)",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.825rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.25rem",
                        transition: "all var(--transition-fast)"
                      }}
                    >
                      Record Final Review Decision <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
