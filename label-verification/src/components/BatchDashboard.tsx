"use client";

import React, { useState, useRef } from "react";
import { 
  Play, RefreshCw, Layers, CheckCircle2, AlertTriangle, 
  XCircle, ChevronDown, ChevronUp, Clock, AlertCircle, FileSpreadsheet,
  Upload, FileImage, Download, Trash2
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
  unmatched?: boolean; // image uploaded but no matching CSV row (no reference data to verify against)
}

interface BatchDashboardProps {
  apiKey: string;
}

export default function BatchDashboard({ apiKey }: BatchDashboardProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [concurrency, setConcurrency] = useState(2);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  
  // Custom uploaded files state
  const [customImages, setCustomImages] = useState<{ name: string; data: string }[]>([]);
  const [csvData, setCsvData] = useState<{ filename: string; brandName: string; classType: string; abv: string; netContents: string; governmentWarning: string }[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActiveImages, setIsDragActiveImages] = useState(false);
  const [isDragActiveCsv, setIsDragActiveCsv] = useState(false);

  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // Parse standard CSV file (supports quoted items containing commas)
  const parseCSVText = (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error("CSV file is empty or missing data.");
      }

      const cleanHeader = (h: string) => h.replace(/["']/g, "").trim().toLowerCase();
      const headers = lines[0].split(",").map(cleanHeader);

      const getIndex = (aliases: string[]) => {
        return headers.findIndex(h => aliases.some(alias => h.includes(alias)));
      };

      const fileIdx = getIndex(["file", "image", "path"]);
      const brandIdx = getIndex(["brand", "company"]);
      const classIdx = getIndex(["class", "type", "category"]);
      const abvIdx = getIndex(["abv", "alcohol", "proof", "strength"]);
      const netIdx = getIndex(["net", "volume", "content", "size"]);
      const warnIdx = getIndex(["warning", "government", "surgeon"]);

      if (fileIdx === -1 || brandIdx === -1 || classIdx === -1 || abvIdx === -1 || netIdx === -1) {
        throw new Error("Missing required headers. CSV must have columns mapping to: filename, brandName, classType, abv, netContents");
      }

      const parsedRows = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by commas outside of double quotes
        const tokens = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        const cleanVal = (val: string) => {
          if (!val) return "";
          return val.replace(/^["']|["']$/g, "").trim();
        };

        const filename = cleanVal(tokens[fileIdx]);
        const brandName = cleanVal(tokens[brandIdx]);
        const classType = cleanVal(tokens[classIdx]);
        const abv = cleanVal(tokens[abvIdx]);
        const netContents = cleanVal(tokens[netIdx]);
        const governmentWarning = warnIdx !== -1 && tokens[warnIdx] ? cleanVal(tokens[warnIdx]) : STANDARD_GOVERNMENT_WARNING_FULL;

        if (filename && brandName) {
          parsedRows.push({
            filename,
            brandName,
            classType,
            abv,
            netContents,
            governmentWarning: governmentWarning || STANDARD_GOVERNMENT_WARNING_FULL
          });
        }
      }
      return parsedRows;
    } catch (err: unknown) {
      console.error(err);
      throw new Error(err instanceof Error ? err.message : "Failed to parse CSV file formatting.");
    }
  };

  // Build queue items from image and CSV matching
  const matchAndBuildBatchItems = (
    images: { name: string; data: string }[],
    csvRows: { filename: string; brandName: string; classType: string; abv: string; netContents: string; governmentWarning: string }[]
  ) => {
    const cleanName = (n: string) => n.toLowerCase().split(".")[0].trim();
    const matchedImageNames = new Set<string>();

    const batchItems: BatchItem[] = csvRows.map((row, idx) => {
      const rowClean = cleanName(row.filename);

      // Find matching base64 image
      const matchedImg = images.find(img =>
        cleanName(img.name) === rowClean ||
        img.name.toLowerCase().trim() === row.filename.toLowerCase().trim()
      );
      if (matchedImg) matchedImageNames.add(matchedImg.name);

      return {
        id: `custom-batch-${idx}-${Date.now()}`,
        name: `Application #${10000 + idx} (${row.filename})`,
        formValues: {
          brandName: row.brandName,
          classType: row.classType,
          abv: row.abv,
          netContents: row.netContents,
          governmentWarning: row.governmentWarning
        },
        labelValues: {
          brandName: row.brandName,
          classType: row.classType,
          abv: row.abv,
          netContents: row.netContents,
          governmentWarning: row.governmentWarning
        },
        imageData: matchedImg ? matchedImg.data : "",
        status: matchedImg ? "pending" : "failed",
        report: null,
        errorMessage: matchedImg ? null : "Missing corresponding image file in uploaded labels."
      };
    });

    // Represent uploaded images that aren't referenced by any CSV row, so they're
    // visible in the queue instead of silently dropped. They can't be verified
    // (no COLA reference data), so they're flagged for the user to add a CSV row.
    const blankForm = { brandName: "", classType: "", abv: "", netContents: "", governmentWarning: STANDARD_GOVERNMENT_WARNING_FULL };
    const orphanItems: BatchItem[] = images
      .filter(img => !matchedImageNames.has(img.name))
      .map((img, idx) => ({
        id: `orphan-${idx}-${img.name}`,
        name: `Unlisted Image (${img.name})`,
        formValues: { ...blankForm },
        labelValues: { ...blankForm },
        imageData: img.data,
        status: "failed",
        report: null,
        errorMessage: `Not listed in the CSV. Add a row with filename "${img.name}" to verify this image.`,
        unmatched: true,
      }));

    setItems([...batchItems, ...orphanItems]);
  };

  // Upload handlers
  const handleImageUpload = (files: FileList) => {
    setUploadError(null);
    const loadedImages: { name: string; data: string }[] = [];
    let processed = 0;
    const targetFiles = Array.from(files).filter(f => f.type.startsWith("image/"));

    if (targetFiles.length === 0) {
      setUploadError("No valid image files detected. Choose PNG or JPEG.");
      return;
    }

    targetFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          loadedImages.push({
            name: file.name,
            data: e.target.result as string
          });
        }
        processed++;
        if (processed === targetFiles.length) {
          setCustomImages(prev => {
            const updated = [...prev];
            loadedImages.forEach(newImg => {
              const dupIdx = updated.findIndex(img => img.name === newImg.name);
              if (dupIdx !== -1) {
                updated[dupIdx] = newImg;
              } else {
                updated.push(newImg);
              }
            });
            if (csvData.length > 0) {
              matchAndBuildBatchItems(updated, csvData);
            }
            return updated;
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCsvUpload = (file: File) => {
    setUploadError(null);
    if (!file.name.endsWith(".csv")) {
      setUploadError("Invalid file type. Please upload a .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        try {
          const parsed = parseCSVText(e.target.result as string);
          setCsvData(parsed);
          matchAndBuildBatchItems(customImages, parsed);
        } catch (err: unknown) {
          setUploadError(err instanceof Error ? err.message : "Failed parsing CSV content.");
        }
      }
    };
    reader.readAsText(file);
  };

  // Download template CSV file helper
  const downloadCsvTemplate = () => {
    const csvContent = 
      "filename,brandName,classType,abv,netContents,governmentWarning\n" +
      "old_tom.png,OLD TOM DISTILLERY,Kentucky Straight Bourbon Whiskey,45% Alc./Vol.,750 mL,\n" +
      "stones_throw.jpg,Stone's Throw,Dry Gin,40% ABV,1 L,\n" +
      "highland_mist.png,HIGHLAND MIST,Single Malt Scotch Whisky,43% Alc./Vol.,700 mL,";
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "cola_batch_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drag and Drop Images
  const handleImagesDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActiveImages(true);
    } else if (e.type === "dragleave") {
      setIsDragActiveImages(false);
    }
  };

  const handleImagesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActiveImages(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
    }
  };

  // Drag and Drop CSV
  const handleCsvDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActiveCsv(true);
    } else if (e.type === "dragleave") {
      setIsDragActiveCsv(false);
    }
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActiveCsv(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCsvUpload(e.dataTransfer.files[0]);
    }
  };

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

    // Orphan images (no CSV row) are excluded — there's nothing to verify them against.
    const pendingItems = items.filter(item => (item.status === "pending" || item.status === "failed") && !item.unmatched);
    const queue = [...pendingItems];

    const runWorker = async (): Promise<void> => {
      if (queue.length === 0) return;
      const currentItem = queue.shift()!;
      if (!currentItem.imageData) {
        await runWorker();
        return;
      }
      
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
        await runWorker();
      }
    };

    const workers = [];
    const numWorkers = Math.min(concurrency, queue.filter(q => q.imageData).length);
    if (numWorkers === 0) {
      setProcessing(false);
      return;
    }

    for (let i = 0; i < numWorkers; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
    setProcessing(false);
  };

  const clearBatch = () => {
    setItems([]);
    setCustomImages([]);
    setCsvData([]);
    setUploadError(null);
    setProcessing(false);
    setExpandedItemId(null);
  };

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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem", backgroundColor: "var(--bg-primary)", padding: "0.5rem", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.7rem", marginTop: "0.25rem" }}>
        {diff.map((part, index) => {
          if (part.type === "match") return <span key={index} style={{ color: "var(--text-primary)" }}>{part.value}</span>;
          if (part.type === "mismatch-case") return <span key={index} style={{ color: "var(--color-warning)", textDecoration: "underline" }}>{part.value}</span>;
          if (part.type === "added") return <span key={index} style={{ backgroundColor: "rgba(16, 185, 129, 0.2)", color: "var(--color-match)", padding: "0 2px" }}>{part.value}</span>;
          return <span key={index} style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "var(--color-mismatch)", padding: "0 2px", textDecoration: "line-through" }}>{part.value}</span>;
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
            <div style={{ backgroundColor: "var(--bg-primary)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--bg-tertiary)" }}>
              <div style={{ fontSize: "0.675rem", color: "var(--text-muted)", fontWeight: "600" }}>PENDING</div>
              <div style={{ fontSize: "1.25rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Clock size={16} style={{ color: "var(--text-muted)" }} /> {pendingItems}
              </div>
            </div>
            <div style={{ backgroundColor: "var(--bg-primary)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--bg-tertiary)" }}>
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

      {/* Upload zones — kept available before AND after a CSV/images are added,
          so labels can still be uploaded once the CSV has built the queue. */}
      {(items.length === 0 || csvData.length > 0 || customImages.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Main Drag Drop Areas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
            
            {/* Box 1: Multiple Label Images */}
            <div 
              className="glass-panel" 
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "1rem",
                border: isDragActiveImages ? "2px dashed var(--primary)" : "2px dashed var(--bg-tertiary)",
                backgroundColor: isDragActiveImages ? "var(--primary-glow)" : "var(--glass-bg)",
                transition: "all var(--transition-fast)"
              }}
              onDragEnter={handleImagesDrag}
              onDragOver={handleImagesDrag}
              onDragLeave={handleImagesDrag}
              onDrop={handleImagesDrop}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileImage size={24} style={{ color: "var(--primary)" }} />
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600" }}>Upload Label Artwork Images</h4>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Upload multiple label images (PNG, JPEG, etc.). They will be matched to COLA applications by filename.
              </p>
              
              <div 
                onClick={() => imagesInputRef.current?.click()}
                style={{ 
                  flex: 1,
                  minHeight: "120px", 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  justifyContent: "center",
                  border: "1px dashed var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  backgroundColor: "var(--bg-primary)",
                  gap: "0.5rem",
                  padding: "1rem"
                }}
              >
                <Upload size={24} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: "0.825rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                  Drag & Drop images or <span style={{ color: "var(--primary)", textDecoration: "underline" }}>browse files</span>
                </span>
                <input 
                  ref={imagesInputRef}
                  type="file" 
                  multiple 
                  accept="image/*"
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                  style={{ display: "none" }}
                />
              </div>

              {/* Uploaded Images List */}
              {customImages.length > 0 && (
                <div style={{ maxHeight: "150px", overflowY: "auto", borderTop: "1px solid var(--bg-tertiary)", paddingTop: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
                    <span>Uploaded Labels ({customImages.length})</span>
                    <button 
                      onClick={() => setCustomImages([])}
                      style={{ background: "none", border: "none", color: "var(--color-mismatch)", cursor: "pointer", fontSize: "0.7rem", textDecoration: "underline" }}
                    >
                      Clear All
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {customImages.map((img, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", padding: "0.25rem 0.5rem", backgroundColor: "var(--bg-primary)", borderRadius: "4px" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>{img.name}</span>
                        <button 
                          onClick={() => setCustomImages(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                        >
                          <Trash2 size={12} style={{ color: "var(--color-mismatch)" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Box 2: CSV Data File */}
            <div 
              className="glass-panel" 
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "1rem",
                border: isDragActiveCsv ? "2px dashed var(--primary)" : "2px dashed var(--bg-tertiary)",
                backgroundColor: isDragActiveCsv ? "var(--primary-glow)" : "var(--glass-bg)",
                transition: "all var(--transition-fast)"
              }}
              onDragEnter={handleCsvDrag}
              onDragOver={handleCsvDrag}
              onDragLeave={handleCsvDrag}
              onDrop={handleCsvDrop}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileSpreadsheet size={24} style={{ color: "var(--primary)" }} />
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600" }}>Upload COLA Applications CSV</h4>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Provide a CSV containing form records. Headers should map to: filename, brandName, classType, abv, netContents.
              </p>
              
              <div 
                onClick={() => csvInputRef.current?.click()}
                style={{ 
                  flex: 1,
                  minHeight: "120px", 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  justifyContent: "center",
                  border: "1px dashed var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  backgroundColor: "var(--bg-primary)",
                  gap: "0.5rem",
                  padding: "1rem"
                }}
              >
                <FileSpreadsheet size={24} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: "0.825rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                  {csvData.length > 0 ? (
                    <span style={{ color: "var(--color-match)", fontWeight: "bold" }}>CSV Loaded Successfully!</span>
                  ) : (
                    <>Drag & Drop CSV or <span style={{ color: "var(--primary)", textDecoration: "underline" }}>browse files</span></>
                  )}
                </span>
                <input 
                  ref={csvInputRef}
                  type="file" 
                  accept=".csv"
                  onChange={(e) => e.target.files && handleCsvUpload(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </div>

              {/* CSV rows overview */}
              {csvData.length > 0 && (
                <div style={{ borderTop: "1px solid var(--bg-tertiary)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                    <span>Application Records ({csvData.length})</span>
                    <button 
                      onClick={() => setCsvData([])}
                      style={{ background: "none", border: "none", color: "var(--color-mismatch)", cursor: "pointer", fontSize: "0.7rem", textDecoration: "underline" }}
                    >
                      Clear CSV
                    </button>
                  </div>
                  <div style={{ fontSize: "0.75rem", backgroundColor: "var(--bg-primary)", padding: "0.5rem", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    {csvData.slice(0, 3).map((row, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
                        <span style={{ fontStyle: "italic" }}>{row.filename}</span>
                        <span>{row.brandName}</span>
                      </div>
                    ))}
                    {csvData.length > 3 && (
                      <div style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        + {csvData.length - 3} more records
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Diagnostics and template download toolbar */}
          <div className="glass-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button
                onClick={downloadCsvTemplate}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--primary-glow)",
                  color: "var(--primary)",
                  border: "1px solid var(--bg-tertiary)",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem"
                }}
              >
                <Download size={14} /> Download CSV Template
              </button>
              
              <button
                onClick={generateMockBatch}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "none",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem"
                }}
              >
                Load Mock Sample Batch (5 items)
              </button>
            </div>

            {uploadError && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--color-mismatch)", fontWeight: "600" }}>
                <AlertCircle size={14} />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Prompt for the missing half: batch needs BOTH the CSV (reference data) and the label images. */}
            {customImages.length > 0 && csvData.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--color-warning)", fontWeight: "600", backgroundColor: "var(--color-warning-bg)", border: "1px solid var(--color-warning-border)", borderRadius: "var(--radius-sm)", padding: "0.625rem 0.875rem" }}>
                <AlertTriangle size={16} />
                <span>{customImages.length} image{customImages.length > 1 ? "s" : ""} uploaded. Now insert a <strong>CSV</strong> of COLA applications to build the verification queue.</span>
              </div>
            )}
            {csvData.length > 0 && customImages.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--color-warning)", fontWeight: "600", backgroundColor: "var(--color-warning-bg)", border: "1px solid var(--color-warning-border)", borderRadius: "var(--radius-sm)", padding: "0.625rem 0.875rem" }}>
                <AlertTriangle size={16} />
                <span>{csvData.length} CSV record{csvData.length > 1 ? "s" : ""} loaded. Now insert the <strong>label images</strong> (PNG/JPG) so they can be matched by filename.</span>
              </div>
            )}
          </div>

          {/* Diagnostic overview box if files uploaded but matching is running */}
          {(customImages.length > 0 || csvData.length > 0) && (
            <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderLeft: "4px solid var(--accent-blue)" }}>
              <h4 style={{ fontSize: "0.875rem", fontWeight: "700" }}>Application Matching Diagnostics</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", fontSize: "0.775rem" }}>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Total Images Uploaded:</span>{" "}
                  <strong>{customImages.length}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Total CSV Records:</span>{" "}
                  <strong>{csvData.length}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Matched & Ready:</span>{" "}
                  <strong style={{ color: "var(--color-match)" }}>
                    {items.filter(it => it.imageData && !it.unmatched).length}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Missing Images:</span>{" "}
                  <strong style={{ color: "var(--color-warning)" }}>
                    {items.filter(it => !it.imageData).length}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Unlisted (not in CSV):</span>{" "}
                  <strong style={{ color: "var(--color-warning)" }}>
                    {items.filter(it => it.unmatched).length}
                  </strong>
                </div>
              </div>
              
              {/* Warnings for unmatched items */}
              {items.some(it => !it.imageData) && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", backgroundColor: "var(--color-warning-bg)", border: "1px solid var(--color-warning-border)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem", fontSize: "0.725rem", color: "var(--color-warning)" }}>
                  <AlertTriangle size={14} style={{ marginTop: "1px", flexShrink: 0 }} />
                  <div>
                    <strong>Missing files:</strong> Some applications in the CSV do not have matching uploaded label images. They will show as failed in the queue list below. Please upload the images containing matching filenames.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Queue items list — shown whenever there are items in the queue */}
      {items.length > 0 && (
        <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--bg-tertiary)" }}>
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
                          borderBottom: "1px solid var(--bg-tertiary)", 
                          cursor: item.status === "success" ? "pointer" : "default",
                          backgroundColor: isExpanded ? "var(--bg-primary)" : "transparent",
                          transition: "background-color var(--transition-fast)"
                        }}
                        className={item.status === "success" ? "hover:bg-slate-800" : ""}
                      >
                        <td style={{ padding: "0.875rem 1rem", fontWeight: "500" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            {item.imageData ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageData}
                                alt="Thumbnail"
                                style={{ width: "36px", height: "36px", objectFit: "cover", borderRadius: "4px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--bg-tertiary)" }}
                              />
                            ) : (
                              <div
                                title="No matching image uploaded"
                                style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--bg-tertiary)" }}
                              >
                                <FileImage size={16} style={{ color: "var(--text-muted)" }} />
                              </div>
                            )}
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
                            <span style={{ color: item.unmatched || !item.imageData ? "var(--color-warning)" : "var(--color-mismatch)", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: "600" }} title={item.errorMessage || ""}>
                              <AlertCircle size={14} /> {item.unmatched ? "Not in CSV" : !item.imageData ? "No Image" : "Failed API"}
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
                                    : item.report?.overallStatus === "INCOMPLETE"
                                    ? "var(--color-incomplete)"
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
                              {item.report?.overallStatus === "INCOMPLETE" && (
                                <>
                                  <AlertCircle size={14} /> Incomplete
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
                        <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          <td colSpan={5} style={{ padding: "1.25rem", borderBottom: "1px solid var(--bg-tertiary)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem", alignItems: "start" }}>
                              
                              {/* Left: Artwork Preview */}
                              <div>
                                  <h5 style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                                    Label Image
                                  </h5>
                                  {item.imageData ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.imageData}
                                      alt="Artwork"
                                      style={{ width: "100%", maxHeight: "250px", objectFit: "contain", borderRadius: "8px", border: "1px solid var(--bg-tertiary)", backgroundColor: "var(--bg-tertiary)" }}
                                    />
                                  ) : (
                                    <div
                                      style={{ width: "100%", height: "150px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", borderRadius: "8px", border: "1px dashed var(--bg-tertiary)", backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", fontSize: "0.75rem" }}
                                    >
                                      <FileImage size={24} />
                                      No matching image uploaded
                                    </div>
                                  )}
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
                                      <div key={fieldName} style={{ borderBottom: "1px solid var(--bg-primary)", paddingBottom: "0.5rem" }}>
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
