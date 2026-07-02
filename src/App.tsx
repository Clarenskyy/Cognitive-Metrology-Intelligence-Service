import React, { useState, useEffect, useRef } from "react";
import { 
  Cpu, 
  Upload, 
  Trash2, 
  Plus, 
  TrendingUp, 
  Settings, 
  Gauge, 
  HelpCircle, 
  Terminal, 
  FileText, 
  FileSpreadsheet, 
  Flame, 
  Zap, 
  ChevronRight, 
  Volume2, 
  Layers,
  Thermometer,
  Droplets,
  RotateCw,
  Clock,
  Send,
  Sparkles,
  Info
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ReferenceLine,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { CalibrationRun, CalibrationSpec, InstrumentProfile, ToleranceItem, DriftForecast } from "./types";
import { INITIAL_PROFILES, PRESET_MANUALS } from "./data";

export default function App() {
  // Profiles state - initialized with our premium seed metrology profiles
  const [profiles, setProfiles] = useState<InstrumentProfile[]>(INITIAL_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>("prof-fluke-8846a");
  
  // Active Profile retrieval
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  // Manual Document AI parameters
  const [customManualText, setCustomManualText] = useState<string>(PRESET_MANUALS["Fluke 8846A"]);
  const [targetInstrumentModel, setTargetInstrumentModel] = useState<string>("Fluke 8846A");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [documentAIStatus, setDocumentAIStatus] = useState<string>("idle"); // idle | loading | success | error
  const [documentAIError, setDocumentAIError] = useState<string | null>(null);

  // New telemetry run entry
  const [asFoundInput, setAsFoundInput] = useState<string>("10.00018");
  const [asLeftInput, setAsLeftInput] = useState<string>("10.00001");
  const [tempInput, setTempInput] = useState<string>("23.5");
  const [humidityInput, setHumidityInput] = useState<string>("41.2");
  const [cyclesInput, setCyclesInput] = useState<string>("2400");
  
  // Predictive AI forecast states
  const [predictiveStatus, setPredictiveStatus] = useState<string>("idle"); // idle | loading | success
  const [predictiveError, setPredictiveError] = useState<string | null>(null);

  // Integration playground metrics
  const [developerConsoleTab, setDeveloperConsoleTab] = useState<"curl" | "payload" | "response">("curl");
  const [playgroundLatencyMs, setPlaygroundLatencyMs] = useState<number | null>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState<boolean>(false);
  const [playgroundServerResponse, setPlaygroundServerResponse] = useState<any>(null);
  const [lastApiTriggered, setLastApiTriggered] = useState<string>("");
  const [isPyVISAHardwarePolling, setIsPyVISAHardwarePolling] = useState<boolean>(false);
  const [hardwarePollingRate, setHardwarePollingRate] = useState<number>(250); // ms

  // File Ingest Drop Zone Reference
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Sync manual context when changing between preset options
  const handlePresetSelect = (presetKey: string) => {
    setTargetInstrumentModel(presetKey);
    setCustomManualText(PRESET_MANUALS[presetKey] || "");
  };

  // Sync inputs dynamically based on active profile nominal value
  useEffect(() => {
    if (activeProfile) {
      // Find nominal or default to 10
      const nom = activeProfile.spec?.tolerance_array[0]?.nominal_value || 10.0;
      setAsFoundInput((nom + 0.00021).toFixed(6));
      setAsLeftInput((nom + 0.00002).toFixed(6));
    }
  }, [activeProfileId]);

  // Document AI Trigger (POST /api/ai/extract-template)
  const handleExtractTemplate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDocumentAIStatus("loading");
    setDocumentAIError(null);
    const startTime = performance.now();

    try {
      const formData = new FormData();
      formData.append("target_instrument_model", targetInstrumentModel);
      
      if (selectedFile) {
        formData.append("PDF_file", selectedFile);
      } else {
        // Fallback or string body if no file is uploaded
        formData.append("text_manual", customManualText);
      }

      const response = await fetch("/api/ai/extract-template", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned extraction fault: ${response.status} ${response.statusText}`);
      }

      const extractedSpec: CalibrationSpec = await response.json();
      const endTime = performance.now();
      
      // Update our reactive profiles array with the newly extracted specifications
      setProfiles(prevProfiles => prevProfiles.map(p => {
        if (p.id === activeProfileId) {
          return {
            ...p,
            spec: extractedSpec,
            // Clear current forecast as tolerances changed
            forecast: null
          };
        }
        return p;
      }));

      setDocumentAIStatus("success");
      setPlaygroundServerResponse(extractedSpec);
      setLastApiTriggered("POST /api/ai/extract-template");
      setPlaygroundLatencyMs(Math.round(endTime - startTime));
      setSelectedFile(null); // Clear manual queue
    } catch (err: any) {
      console.error(err);
      setDocumentAIStatus("error");
      setDocumentAIError(err.message || "Failed to parse manual specifications.");
    }
  };

  // Predictive AI Trigger (POST /api/ai/forecast-drift)
  const handleCalculateForecast = async () => {
    if (activeProfile.runs.length === 0) return;
    
    setPredictiveStatus("loading");
    setPredictiveError(null);
    const startTime = performance.now();

    try {
      const payload = {
        profile_id: activeProfile.id,
        CALIBRATION_RUNS: activeProfile.runs
      };

      const response = await fetch("/api/ai/forecast-drift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server statistical modeling fault: ${response.status}`);
      }

      const forecastData: DriftForecast = await response.json();
      const endTime = performance.now();

      setProfiles(prevProfiles => prevProfiles.map(p => {
        if (p.id === activeProfileId) {
          return {
            ...p,
            forecast: forecastData
          };
        }
        return p;
      }));

      setPredictiveStatus("success");
      setPlaygroundServerResponse(forecastData);
      setLastApiTriggered("POST /api/ai/forecast-drift");
      setPlaygroundLatencyMs(Math.round(endTime - startTime));
    } catch (err: any) {
      console.error(err);
      setPredictiveStatus("error");
      setPr_dictiveError(err.message || "Drift projection computation failed.");
    }
  };

  // Helper function to set prediction error if something fails
  const setPr_dictiveError = (msg: string | null) => {
    setPredictiveError(msg);
  };

  // Add a new raw telemetry run manually
  const handleAddNewRun = (e: React.FormEvent) => {
    e.preventDefault();
    const asFoundVal = parseFloat(asFoundInput);
    const asLeftVal = parseFloat(asLeftInput);
    const tempVal = parseFloat(tempInput);
    const humVal = parseFloat(humidityInput);
    const cyclVal = parseInt(cyclesInput) || 0;

    if (isNaN(asFoundVal) || isNaN(asLeftVal)) {
      alert("Invalid measurement bounds. Enter valid decimal metrics.");
      return;
    }

    // Default nominal value from spec, or first run nominal
    const nominalValue = activeProfile.spec?.tolerance_array[0]?.nominal_value 
      || activeProfile.runs[0]?.nominal_value 
      || 10.0;

    const newRun: CalibrationRun = {
      run_id: `live-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      as_found: asFoundVal,
      as_left: asLeftVal,
      nominal_value: nominalValue,
      temperature_c: tempVal,
      humidity_rh: humVal,
      operating_cycles: cyclVal
    };

    setProfiles(prevProfiles => prevProfiles.map(p => {
      if (p.id === activeProfileId) {
        const updatedRuns = [...p.runs, newRun];
        return {
          ...p,
          runs: updatedRuns,
          // Reset forecast to force recomputation with the new telemetry point
          forecast: null
        };
      }
      return p;
    }));

    // Reset simple incremental steps
    setCyclesInput((cyclVal + 1200).toString());
    
    // Automatically query forecasting backend to refresh visual chart immediately
    setTimeout(() => {
      handleCalculateForecast();
    }, 100);
  };

  // Delete a specific run from memory
  const handleDeleteRun = (runId: string) => {
    setProfiles(prevProfiles => prevProfiles.map(p => {
      if (p.id === activeProfileId) {
        return {
          ...p,
          runs: p.runs.filter(r => r.run_id !== runId),
          forecast: null
        };
      }
      return p;
    }));
  };

  // Reset active profile to its factory state (from INITIAL_PROFILES configuration)
  const handleResetProfile = () => {
    const factory = INITIAL_PROFILES.find(p => p.id === activeProfileId);
    if (factory) {
      setProfiles(prev => prev.map(p => {
        if (p.id === activeProfileId) {
          return JSON.parse(JSON.stringify(factory));
        }
        return p;
      }));
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      // Automatically pull target instrument model from standard file prefix
      const cleanedName = file.name.split(".")[0].replace(/_/g, " ").replace(/-/g, " ");
      setTargetInstrumentModel(cleanedName);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const cleanedName = file.name.split(".")[0].replace(/_/g, " ").replace(/-/g, " ");
      setTargetInstrumentModel(cleanedName);
    }
  };

  // Custom simulation trigger to run the mock PyVISA instrument hardware loop parallel
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPyVISAHardwarePolling) {
      interval = setInterval(() => {
        // Just simulates background hardware checking (polling of ESP32 and VISA devices)
        // keeping low baseline latency shown in developers console
      }, hardwarePollingRate);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPyVISAHardwarePolling, hardwarePollingRate]);

  // Calculate drift chart points including forward extrapolations!
  const getChartData = () => {
    if (!activeProfile.runs || activeProfile.runs.length === 0) return [];
    
    // Convert runs to chronological chart nodes
    const nominal = activeProfile.spec?.tolerance_array[0]?.nominal_value 
      || activeProfile.runs[0]?.nominal_value 
      || 10.0;

    const data = activeProfile.runs.map((r, i) => {
      // Calculate deviation in Parts Per Million (PPM)
      const devAsFoundPpm = ((r.as_found - nominal) / nominal) * 1e6;
      const devAsLeftPpm = ((r.as_left - nominal) / nominal) * 1e6;
      
      const formattedDate = new Date(r.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
      return {
        name: formattedDate,
        "As-Found (PPM)": parseFloat(devAsFoundPpm.toFixed(2)),
        "As-Left (PPM)": parseFloat(devAsLeftPpm.toFixed(2)),
        "Drift Base": parseFloat(devAsFoundPpm.toFixed(2)),
        Temperature: r.temperature_c,
        isForecast: false
      };
    });

    // Extrapolate forecast nodes if forecast results are calculated
    if (activeProfile.forecast) {
      const lastRun = activeProfile.runs[activeProfile.runs.length - 1];
      const lastPpm = ((lastRun.as_found - nominal) / nominal) * 1e6;
      const monthlyDrift = activeProfile.forecast.current_drift_rate_ppm_month;
      const days = activeProfile.forecast.days_until_oot;

      // Create 3 projection steps forward in time
      const periods = 3;
      const daysPerPeriod = days / periods;
      
      for (let p = 1; p <= periods; p++) {
        const stepDays = daysPerPeriod * p;
        const projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + stepDays);
        const ppmProjected = lastPpm + (monthlyDrift * (stepDays / 30.43));

        data.push({
          name: projectedDate.toLocaleDateString([], { month: "short", day: "numeric" }) + " (Est)",
          "As-Found (PPM)": undefined as any,
          "As-Left (PPM)": undefined as any,
          "Drift Base": parseFloat(ppmProjected.toFixed(2)),
          Temperature: 23.0,
          isForecast: true
        });
      }
    }

    return data;
  };

  // Determine active tolerance PPM bands to display as reference lines on chart
  const getActiveToleranceLimit = () => {
    if (activeProfile.spec && activeProfile.spec.tolerance_array.length > 0) {
      // Find voltage parameters or whatever model has
      return activeProfile.spec.tolerance_array[0].tolerance_ppm;
    }
    return 24; // Baseline generic
  };

  const toleranceRatingLimit = getActiveToleranceLimit();
  const chartPoints = getChartData();

  // Color mapping variables for neat UI styling
  const getShapColor = (index: number) => {
    const colors = ["#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#6B7280"];
    return colors[index % colors.length];
  };

  // SDK / cURL command structures for Developers Sandbox
  const getCurlSnippet = () => {
    if (developerConsoleTab === "curl") {
      return `# Endpoint 1: Extract Calibration Template from Document AI PDF Manual
curl -X POST /api/ai/extract-template \\
  -F "target_instrument_model=${activeProfile.model}" \\
  -F "PDF_file=@fluke_specification_sheet.pdf"

# Endpoint 2: Trigger XGBoost/Ensemble Stochastic Drift Forecasting
curl -X POST /api/ai/forecast-drift \\
  -H "Content-Type: application/json" \\
  -d '{
    "profile_id": "${activeProfile.id}",
    "CALIBRATION_RUNS": ${JSON.stringify(activeProfile.runs.slice(0, 2), null, 2).replace(/\n/g, "\n    ")}
  }'`;
    } else if (developerConsoleTab === "payload") {
      return JSON.stringify({
        profile_id: activeProfile.id,
        target_instrument_model: activeProfile.model,
        CALIBRATION_RUNS: activeProfile.runs
      }, null, 2);
    } else {
      return playgroundServerResponse 
        ? JSON.stringify(playgroundServerResponse, null, 2)
        : `{ "status": "No network payload triggered yet", "tip": "Click 'Extract Specification Template' or 'Calculate Drift Projection' to view live microservice REST API responses." }`;
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-gray-100 font-sans selection:bg-blue-600 selection:text-white" id="cmis-viewport">
      
      {/* 1. BRAND HEADER BAR */}
      <header className="border-b border-brand-border bg-brand-panel/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3" id="main-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-blue-500/20 border border-amber-500/30 rounded-xl relative overflow-hidden group">
              <Cpu className="w-6 h-6 text-amber-400 animate-pulse" />
              <div className="absolute inset-0 bg-amber-400/10 scale-0 group-hover:scale-100 transition-all rounded" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-gray-100 tracking-tight text-lg md:text-xl">
                  Cognitive Metrology Intelligence Service
                </h1>
                <span className="text-[10px] bg-brand-border text-amber-400 font-mono border border-brand-border/80 px-1.5 py-0.5 rounded uppercase">
                  CMIS v1.2
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium">
                ISO/IEC 17025 Compliant Document AI Templates & Predictive Stochastic Drift Microservice
              </p>
            </div>
          </div>

          {/* Profile Choice dropdown */}
          <div className="flex items-center gap-2 self-stretch md:self-auto" id="profile-selection">
            <span className="text-xs text-gray-400 font-medium hidden sm:inline">Active Profile:</span>
            <select 
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="bg-brand-bg border border-brand-border text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:border-amber-500 focus:outline-none transition-all cursor-pointer font-medium flex-1 md:flex-initial"
              id="profile-dropdown"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.model} ({p.name})
                </option>
              ))}
            </select>
            <button 
              onClick={handleResetProfile}
              className="px-2.5 py-1.5 border border-brand-border hover:bg-brand-border/50 text-gray-400 hover:text-gray-100 rounded-lg text-xs transition-all font-medium"
              title="Reset profile data to factory seed template"
              id="reset-profile-btn"
            >
              Reset
            </button>
          </div>

        </div>
      </header>

      {/* METROLOGY SUMMARY BANNER CARD */}
      <section className="bg-gradient-to-r from-amber-500/10 via-brand-panel to-brand-panel max-w-7xl mx-auto mt-6 mx-4 p-4 rounded-xl border border-brand-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink" id="active-summary-callout">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-amber-500 mt-1 shrink-0" />
          <div>
            <h2 className="text-sm font-display font-semibold text-gray-100">
              Active Asset: <span className="text-amber-400">{activeProfile.model}</span> (S/N: {activeProfile.serial_number})
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 max-w-2xl leading-relaxed">
              Standard calibration cycle remains on a <strong>{activeProfile.calibration_cycle_months}-month</strong> loop. 
              {activeProfile.spec 
                ? ` Extraction schema powered by local ${activeProfile.spec.embedding_model_selected} mapping.`
                : " This profile's technical specification bounds are not extracted yet. Run Document AI to process manufacture manual sheets below."
              }
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="bg-brand-bg px-2.5 py-1.5 border border-brand-border rounded-lg">
            <span className="text-gray-400">Tolerance Band: </span> 
            <span className="text-amber-400 font-semibold">{toleranceRatingLimit} PPM</span>
          </div>
          <div className="bg-brand-bg px-2.5 py-1.5 border border-brand-border rounded-lg">
            <span className="text-gray-400">Runs Tracked: </span> 
            <span className="text-blue-400 font-semibold">{activeProfile.runs.length} Runs</span>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT DASHBOARD MATRIX */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-matrix">
        
        {/* ==================== LEFT COLUMN: INGESTION & RUNS (5 COLS) ==================== */}
        <div className="lg:col-span-5 flex flex-col gap-6" id="left-column">
          
          {/* MODULE 1: INTERACTIVE DOCUMENT AI SPECS KNOWLEDGE INGESTION */}
          <div className="bg-brand-panel border border-brand-border rounded-xl p-5 relative overflow-hidden" id="module-document-ai">
            
            <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-bold text-gray-100 text-sm">
                  Knowledge Ingestion Pipeline (Document AI)
                </h3>
              </div>
              <span className="text-[10px] bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full font-semibold border border-amber-400/20 font-mono">
                Segment-Based
              </span>
            </div>

            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Upload a manufacturer technical PDF or choose from standardized metrology presets. Differentiates text paragraphs from calibration tabular configurations.
            </p>

            {/* Ingestion preset toggles */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {Object.keys(PRESET_MANUALS).map((key) => (
                <button
                  key={key}
                  onClick={() => handlePresetSelect(key)}
                  className={`px-2 py-1.5 text-[11px] rounded border font-medium transition-all text-center truncate ${
                    targetInstrumentModel === key 
                      ? "border-amber-500 bg-amber-500/10 text-amber-400" 
                      : "border-brand-border bg-brand-bg/60 text-gray-400 hover:text-gray-200"
                  }`}
                  id={`preset-btn-${key.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {key} Spec
                </button>
              ))}
            </div>

            {/* DRAG AND DROP ZONE */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 mb-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive 
                  ? "border-amber-400 bg-amber-400/5" 
                  : selectedFile 
                    ? "border-emerald-500/60 bg-emerald-500/5" 
                    : "border-brand-border hover:border-gray-500 bg-brand-bg/30"
              }`}
              id="file-drop-zone"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.txt,.doc"
                className="hidden" 
                id="file-input-field"
              />
              {selectedFile ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-xs text-gray-200 font-semibold truncate max-w-full">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    Ready for Segment extraction ({Math.round(selectedFile.size / 1024)} KB)
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400 mb-2 group-hover:text-amber-400" />
                  <span className="text-xs text-gray-300 font-semibold group-hover:text-amber-400">
                    Upload Manufacturer PDF Spec
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium tracking-tight mt-0.5">
                    Drag & Drop file or Click to browse
                  </span>
                </>
              )}
            </div>

            {/* Custom Manual Specs Textbox */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-400 font-semibold uppercase">
                  Calibration Text Bounds Schema Context:
                </label>
                <span className="text-[10px] text-amber-500 font-mono">
                  {customManualText.length} characters
                </span>
              </div>
              <textarea
                value={customManualText}
                onChange={(e) => setCustomManualText(e.target.value)}
                className="w-full bg-brand-bg text-xs border border-brand-border rounded-lg p-2.5 h-32 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30 text-gray-300 font-mono leading-relaxed"
                placeholder="Enter raw instrument spec limits or SCPI register manuals here..."
                id="manual-textbox"
              />
            </div>

            {/* Target instrument name input */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-gray-400 font-semibold block mb-1 uppercase">
                  Extraction Model Identity:
                </label>
                <input 
                  type="text"
                  value={targetInstrumentModel}
                  onChange={(e) => setTargetInstrumentModel(e.target.value)}
                  className="w-full bg-brand-bg text-xs border border-brand-border rounded-md px-2.5 py-1.5 focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. Fluke 8846A"
                  id="target-model-input"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold block mb-1 uppercase">
                  Local Embeddings Model:
                </label>
                <div className="bg-brand-bg/80 border border-brand-brand border-brand-border text-xs rounded-md px-2.5 py-1.5 text-gray-300 font-medium select-none truncate">
                  {activeProfile.spec?.embedding_model_selected || "SciBERT (Domain-Specific)"}
                </div>
              </div>
            </div>

            {/* Trigger Button */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExtractTemplate()}
                disabled={documentAIStatus === "loading"}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-brand-border disabled:to-brand-border disabled:text-gray-500 text-brand-bg text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                id="trigger-extraction-btn"
              >
                {documentAIStatus === "loading" ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-brand-bg border-t-transparent rounded-full animate-spin" />
                    Segmenting Blocks...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                    Extract Specification Template
                  </>
                )}
              </button>
            </div>

            {/* Status alerts */}
            {documentAIError && (
              <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                {documentAIError}
              </div>
            )}

          </div>

          {/* TELEMETRY RUNS LOG TABLE */}
          <div className="bg-brand-panel border border-brand-border rounded-xl p-5" id="telemetry-log">
            
            <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                <h3 className="font-display font-bold text-gray-100 text-sm">
                  Stochastic Calibration Telemetry Runs
                </h3>
              </div>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-semibold border border-blue-400/20 font-mono">
                As-Found & As-Left
              </span>
            </div>

            {/* Form to submit a new telemetry node */}
            <form onSubmit={handleAddNewRun} className="mb-5 bg-brand-bg/50 border border-brand-border p-3 rounded-lg" id="add-run-form">
              <span className="text-[10px] text-amber-500 font-mono block mb-2 uppercase font-semibold">
                + Simulate Custom VISA / ESP32 Hardware Ingestion signal
              </span>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-3">
                <div>
                  <label className="text-[9px] text-gray-400 font-semibold block uppercase">As-Found Reading:</label>
                  <input 
                    type="number" 
                    step="0.0000001"
                    value={asFoundInput}
                    onChange={(e) => setAsFoundInput(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded text-xs px-2 py-1 focus:border-amber-500 focus:outline-none font-mono"
                    id="input-as-found"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-400 font-semibold block uppercase">As-Left Realignment:</label>
                  <input 
                    type="number" 
                    step="0.0000001"
                    value={asLeftInput}
                    onChange={(e) => setAsLeftInput(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded text-xs px-2 py-1 focus:border-amber-500 focus:outline-none font-mono"
                    id="input-as-left"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[9px] text-gray-400 font-semibold block uppercase">Relay Cycles Count:</label>
                  <input 
                    type="number" 
                    value={cyclesInput}
                    onChange={(e) => setCyclesInput(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded text-xs px-2 py-1 focus:border-amber-500 focus:outline-none font-mono text-gray-300"
                    id="input-cycles"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-400 font-semibold block uppercase">Temp (BME280):</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1"
                      value={tempInput}
                      onChange={(e) => setTempInput(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded text-xs pl-2 pr-5 py-1 focus:border-amber-500 focus:outline-none font-mono text-gray-300"
                      id="input-temp"
                    />
                    <span className="absolute right-1.5 top-1 text-[9px] text-gray-400 font-mono">°C</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-gray-400 font-semibold block uppercase">Humidity RH%:</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1"
                      value={humidityInput}
                      onChange={(e) => setHumidityInput(e.target.value)}
                      className="w-full bg-brand-bg border border-brand-border rounded text-xs pl-2 pr-5 py-1 focus:border-amber-500 focus:outline-none font-mono text-gray-300 animate-fade"
                      id="input-humidity"
                    />
                    <span className="absolute right-1.5 top-1 text-[9px] text-gray-400 font-mono">%</span>
                  </div>
                </div>
                <div className="flex items-end justify-stretch">
                  <button
                    type="submit"
                    className="w-full bg-brand-border hover:bg-brand-border/80 border border-amber-500/30 text-amber-400 text-[10px] font-bold py-1 px-2.5 rounded flex items-center justify-center gap-1 cursor-pointer"
                    id="add-run-submit-btn"
                  >
                    <Plus className="w-3 h-3 text-amber-500" />
                    Inject Run
                  </button>
                </div>
              </div>
            </form>

            {/* List scrollbox */}
            <div className="max-h-56 overflow-y-auto border border-brand-border rounded-lg" id="runs-history-container">
              {activeProfile.runs.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500 font-medium">
                  No telemetry logs tracked for this profile.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#1C253E] text-gray-400 font-medium">
                    <tr>
                      <th className="p-2 text-[9px] uppercase tracking-wider font-semibold">ID</th>
                      <th className="p-2 text-[9px] uppercase tracking-wider font-semibold">As-Found</th>
                      <th className="p-2 text-[9px] uppercase tracking-wider font-semibold">As-Left</th>
                      <th className="p-2 text-[9px] uppercase tracking-wider font-semibold">BME280 C/RH</th>
                      <th className="p-2 text-[9px] uppercase tracking-wider font-semibold">Cycles</th>
                      <th className="p-2 text-[9px] uppercase tracking-wider font-semibold text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border font-mono text-gray-300">
                    {activeProfile.runs.map((run) => {
                      const ageClass = run.run_id.startsWith("live") ? "text-emerald-400" : "text-gray-400";
                      return (
                        <tr key={run.run_id} className="hover:bg-brand-bg/40 transition-colors">
                          <td className={`p-2 text-[10px] font-bold ${ageClass}`}>{run.run_id}</td>
                          <td className="p-2 font-semibold">{run.as_found.toFixed(6)}</td>
                          <td className="p-2">{run.as_left.toFixed(6)}</td>
                          <td className="p-2 text-[11px]">
                            {run.temperature_c}° / {run.humidity_rh}%
                          </td>
                          <td className="p-2 text-gray-400">{run.operating_cycles}</td>
                          <td className="p-2 text-right">
                            <button 
                              onClick={() => handleDeleteRun(run.run_id)}
                              className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-brand-bg/80 transition-colors cursor-pointer"
                              id={`delete-run-${run.run_id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>

        </div>

        {/* ==================== RIGHT COLUMN: METRIC VISUALIZERS (7 COLS) ==================== */}
        <div className="lg:col-span-7 flex flex-col gap-6" id="right-column">
          
          {/* MULTI-PARAMETER TOLERANCE GRID PREVIEW */}
          <div className="bg-brand-panel border border-brand-border rounded-xl p-5" id="extracted-tolerance-grid">
            <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-display font-bold text-gray-100 text-sm">
                    Extracted Tolerance Passes & SCPI Target Bounds
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    1-Year Pass thresholds extracted by Document AI optical block algorithms
                  </p>
                </div>
              </div>
            </div>

            {!activeProfile.spec ? (
              <div className="text-center py-10 bg-brand-bg/40 border border-brand-border border-dashed rounded-xl" id="no-extracted-bounds-card">
                <FileText className="w-8 h-8 text-amber-500/40 mx-auto mb-2.5" />
                <span className="text-xs font-semibold text-gray-400 block">No bounds extracted yet.</span>
                <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Click <strong>'Extract Specification Template'</strong> in the leftmost panel to ingest manual bounds and generate tolerance boundaries.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-brand-border rounded-lg" id="bounds-grid-table">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#1C253E] text-gray-400 font-medium">
                    <tr>
                      <th className="p-2.5">Parameter</th>
                      <th className="p-2.5">Range</th>
                      <th className="p-2.5 font-mono">Test Point</th>
                      <th className="p-2.5 text-amber-400">PPM Spec</th>
                      <th className="p-2.5 font-mono">Upper Bound</th>
                      <th className="p-2.5">SCPI Verification Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border text-gray-300 font-medium">
                    {activeProfile.spec.tolerance_array.map((item) => (
                      <tr key={item.id} className="hover:bg-brand-bg/30 transition-colors">
                        <td className="p-2.5 text-xs font-bold text-gray-200">{item.parameter}</td>
                        <td className="p-2.5 font-mono text-gray-400 text-[11px]">{item.range}</td>
                        <td className="p-2.5 font-mono text-amber-400">{item.test_point}</td>
                        <td className="p-2.5 text-amber-500 font-mono font-semibold">±{item.tolerance_ppm}</td>
                        <td className="p-2.5 font-mono text-gray-400 font-medium">{item.upper_limit.toFixed(6)} {item.unit}</td>
                        <td className="p-2.5 font-mono text-[10px] text-blue-400 bg-brand-bg/40 max-w-[120px] truncate hover:text-blue-300 select-all" title={item.scpi_command}>
                          {item.scpi_command}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DUAL-AXIS DRIFT TREND & PREDICTION CHART */}
          <div className="bg-brand-panel border border-brand-border rounded-xl p-5 relative overflow-hidden" id="predictive-chart-panel">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-border pb-3 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400 animate-pulse" />
                <div>
                  <h3 className="font-display font-bold text-gray-100 text-sm">
                    Stochastic Calibration Drift Forecasting
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Real-time calibration regression compared with extracted microservice specification boundaries
                  </p>
                </div>
              </div>
              <button
                onClick={handleCalculateForecast}
                disabled={activeProfile.runs.length === 0 || !activeProfile.spec || predictiveStatus === "loading"}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-[11px] font-bold py-1.5 px-3.5 rounded-lg flex items-center justify-center gap-1.5 self-start sm:self-auto transition-all cursor-pointer"
                id="calculate-forecast-btn"
              >
                {predictiveStatus === "loading" ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Forecasting...
                  </>
                ) : (
                  <>
                    <Settings className="w-3.5 h-3.5" />
                    Forecast Asset Drift
                  </>
                )}
              </button>
            </div>

            {!activeProfile.spec ? (
              <div className="text-center py-20 bg-brand-bg/40 rounded-xl border border-brand-border border-dashed" id="no-spec">
                <Info className="w-8 h-8 text-blue-500/40 mx-auto mb-2" />
                <span className="text-xs text-gray-400 font-semibold block">Initialize specs first.</span>
                <p className="text-[11px] text-gray-500 mt-1">
                  Extract a calibration template from manufacturer logs to establish upper/lower bounds.
                </p>
              </div>
            ) : chartPoints.length === 0 ? (
              <div className="text-center py-20 bg-brand-bg/40 rounded-xl" id="no-data">
                <span className="text-xs text-gray-500 font-medium">Please inject some telemetry runs on the left form.</span>
              </div>
            ) : (
              <div className="w-full h-64 mt-2" id="recharts-line-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222F4D" />
                    <XAxis dataKey="name" stroke="#687B9E" style={{ fontSize: "10px", fontFamily: "monospace" }} />
                    <YAxis 
                      stroke="#687B9E" 
                      style={{ fontSize: "10px", fontFamily: "monospace" }}
                      domain={[-toleranceRatingLimit * 1.5, toleranceRatingLimit * 1.5]}
                      label={{ value: "Drift Deviation (PPM)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: "10px", fill: "#687B9E" } }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#131A2D", borderColor: "#1E2943", borderRadius: "8px", fontSize: "11px", color: "#F3F4F6", fontFamily: "monospace" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    
                    {/* Tolerance Reference bounds displayed! */}
                    <ReferenceLine y={toleranceRatingLimit} stroke="#D97706" strokeDasharray="5 5" label={{ value: `USL (+${toleranceRatingLimit} PPM)`, fill: "#F59E0B", position: "insideTopRight", style: { fontSize: "9px" } }} />
                    <ReferenceLine y={-toleranceRatingLimit} stroke="#D97706" strokeDasharray="5 5" label={{ value: `LSL (-${toleranceRatingLimit} PPM)`, fill: "#F59E0B", position: "insideBottomRight", style: { fontSize: "9px" } }} />
                    <ReferenceLine y={0} stroke="#4B5563" strokeWidth={0.8} />

                    <Line 
                      type="monotone" 
                      dataKey="As-Found (PPM)" 
                      stroke="#F59E0B" 
                      strokeWidth={2.5} 
                      dot={{ r: 4, stroke: "#131A2D", strokeWidth: 1.5 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="As-Left (PPM)" 
                      stroke="#10B981" 
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      dot={{ r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Drift Base" 
                      name="XGBoost Extrapolated Path"
                      stroke="#3B82F6" 
                      strokeWidth={2.2}
                      strokeDasharray="4 4" 
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* STATS FROM THE MODEL PREDICTION (SHAP EXPLAINABILITY VALUES) */}
            {activeProfile.forecast && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-5 border-t border-brand-border pt-5" id="oot-stats">
                
                {/* Out Of Tolerance Target info */}
                <div className="md:col-span-5 flex flex-col justify-center bg-brand-bg/50 border border-brand-border p-4 rounded-xl relative" id="oot-counter">
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 font-semibold uppercase tracking-wide">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    Forecasted OOT Breach
                  </div>
                  <div className="text-2xl font-display font-bold text-amber-500 mt-2">
                    {activeProfile.forecast.projected_oot_date}
                  </div>
                  <div className="text-xs text-gray-300 font-medium mt-1">
                    Drifting Out-Of-Tolerance in <span className="text-white font-bold text-sm underline decoration-amber-500/50">{activeProfile.forecast.days_until_oot} Days</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-2">
                    Confidence interval: {activeProfile.forecast.confidence_interval.lower_days} to {activeProfile.forecast.confidence_interval.upper_days} days
                  </div>
                  <div className="absolute top-2 right-2 flex items-center justify-center p-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full">
                    <Flame className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* SHAP coordinate weights diagram */}
                <div className="md:col-span-7" id="shap-values-visualization">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                      ISO 17025 auditable SHAP coordinate weights
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono">{activeProfile.forecast.model_type_used}</span>
                  </div>

                  <div className="h-28" id="shap-bar-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeProfile.forecast.shap_values} layout="vertical" margin={{ left: -15, right: 10, top: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="factor" type="category" hide style={{ fontSize: "9px" }} />
                        <Tooltip contentStyle={{ backgroundColor: "#0B0F19", borderColor: "#1E2943", fontSize: "10px" }} />
                        <Bar dataKey="percentage" name="Stochastic Weight %" radius={[0, 4, 4, 0]}>
                          {activeProfile.forecast.shap_values.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getShapColor(index)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* SHAP Factor Legend Lists */}
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {activeProfile.forecast.shap_values.slice(0, 4).map((v, i) => (
                      <div key={v.factor} className="flex items-center gap-1.5 text-[10px] text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getShapColor(i) }} />
                        <span className="truncate font-medium">{v.factor.replace(/\(BME280\)|\(Age\)/, "")}</span>
                        <span className="font-mono text-gray-400 text-[9px] ml-auto">{v.percentage}%</span>
                      </div>
                    ))}
                  </div>

                </div>

              </div>
            )}

            {/* SMART AI ANNOTATIVE INSIGHT DIRECTIVE COMMENTS */}
            {activeProfile.forecast && activeProfile.forecast.metrologist_annotation && (
              <div className="mt-4 p-3 bg-brand-bg border border-brand-border/80 rounded-lg flex items-start gap-2.5 relative" id="ai-metrologist-banner">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase block tracking-wide">
                    Real-time AI Metrologist Insight
                  </span>
                  <p className="text-xs text-gray-300 mt-1 font-medium leading-relaxed italic">
                    "{activeProfile.forecast.metrologist_annotation}"
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* DECOUPLED Microservice REST Gateway PLAYGROUND */}
          <div className="bg-brand-panel border border-brand-border rounded-xl p-5" id="developer-gateway">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-brand-border pb-3 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-display font-bold text-gray-100 text-sm">
                    Developer REST API Gateway Playground
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Query live microservice endpoints. Demonstrates non-blocking hardware orchestration loops.
                  </p>
                </div>
              </div>
              
              {/* Simple simulation check for background hardware read */}
              <div className="flex items-center gap-2 self-start sm:self-auto uppercase font-mono text-[10px]">
                <span className="text-gray-400">VISA Driver Polling:</span>
                <button 
                  onClick={() => setIsPyVISAHardwarePolling(!isPyVISAHardwarePolling)}
                  className={`px-2 py-0.5 rounded font-bold transition-all border ${
                    isPyVISAHardwarePolling 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                      : "bg-brand-bg text-gray-400 border-brand-border"
                  }`}
                  id="visa-polling-toggle"
                >
                  {isPyVISAHardwarePolling ? "● Active Thread" : "○ Paused Thread"}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              When hardware calibration loops are polling via PyVISA or multi-threaded drivers, heavy ML calculations are dispatched in parallel. This API console tracks millisecond processing times to prove zero hardware bottlenecks.
            </p>

            <div className="flex border-b border-brand-border mb-3" id="terminal-tabs">
              <button
                onClick={() => setDeveloperConsoleTab("curl")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all border-b-2 cursor-pointer ${
                  developerConsoleTab === "curl" 
                    ? "border-amber-500 text-amber-400 bg-brand-bg/40" 
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
                id="tab-curl"
              >
                cURL Shell Commands
              </button>
              <button
                onClick={() => setDeveloperConsoleTab("payload")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all border-b-2 cursor-pointer ${
                  developerConsoleTab === "payload" 
                    ? "border-amber-500 text-amber-400 bg-brand-bg/40" 
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
                id="tab-payload"
              >
                Calibration Logs Payload
              </button>
              <button
                onClick={() => setDeveloperConsoleTab("response")}
                className={`px-3 py-1.5 text-xs font-semibold transition-all border-b-2 cursor-pointer relative ${
                  developerConsoleTab === "response" 
                    ? "border-amber-500 text-amber-400 bg-brand-bg/40" 
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
                id="tab-response"
              >
                microservice Response JSON
                {playgroundServerResponse && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                )}
              </button>
            </div>

            <div className="bg-brand-bg/90 border border-brand-border rounded-lg p-3 relative" id="code-snippet-box">
              <pre className="text-[11px] font-mono whitespace-pre-wrap overflow-x-auto text-gray-300 max-h-56 leading-relaxed">
                {getCurlSnippet()}
              </pre>

              {/* Status bar inside sandbox */}
              <div className="mt-3 pt-2.5 border-t border-brand-border/60 flex items-center justify-between text-[10px] font-mono text-gray-500">
                <div>
                  Latest Query: <span className="text-gray-400">{lastApiTriggered || "None"}</span>
                </div>
                {playgroundLatencyMs !== null && (
                  <div className="flex items-center gap-1.5">
                    <span>Gateway Latency: </span>
                    <span className="text-emerald-400 font-semibold">{playgroundLatencyMs} ms</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* FOOTER BAR */}
      <footer className="border-t border-brand-border bg-brand-panel py-6 px-4 mt-12 text-center text-xs text-gray-500 font-mono" id="main-footer">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Cognitive Metrology Intelligence Service (CMIS). Decoupled Calibration AI Gateway.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-gray-300 transition-colors">ISO/IEC 17025 Standard</span>
            <span>•</span>
            <span className="hover:text-gray-300 transition-colors">RAG optical tables</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
