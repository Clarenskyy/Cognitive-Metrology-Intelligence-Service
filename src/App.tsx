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
  Info,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Code
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
import { CalibrationRun, CalibrationSpec, InstrumentProfile, ToleranceItem, DriftForecast, ShapValue } from "./types";
import { INITIAL_PROFILES, PRESET_MANUALS } from "./data";

interface SegmentedBlock {
  id: string;
  type: "header" | "tabular" | "scpi" | "description";
  title: string;
  text: string;
  confidence: number;
  coordinates: { x: number; y: number; w: number; h: number };
  extractedFields?: {
    parameter?: string;
    range?: string;
    nominal_value?: number;
    tolerance_ppm?: number;
    scpi_command?: string;
  };
}

export default function App() {
  // Navigation tabs: "assets" | "document-ai" | "forecasting" | "playground"
  const [activeTab, setActiveTab] = useState<string>("assets");

  // Profiles state - initialized with our premium seed metrology profiles
  const [profiles, setProfiles] = useState<InstrumentProfile[]>(INITIAL_PROFILES);
  const [activeProfileId, setActiveProfileId] = useState<string>("prof-fluke-8846a");
  
  // Active Profile retrieval
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  // Manual Document AI parameters
  const [customManualText, setCustomManualText] = useState<string>(PRESET_MANUALS["Fluke 8846A"]);
  const [targetInstrumentModel, setTargetInstrumentModel] = useState<string>("Fluke 8846A");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  // Block Segmenting Interactive State
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  // File Ingest Drop Zone Reference
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Responsive Sidebar Toggle State for Mobile Viewports
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState<boolean>(false);

  // Sync manual context when changing between preset options
  const handlePresetSelect = (presetKey: string) => {
    setTargetInstrumentModel(presetKey);
    setCustomManualText(PRESET_MANUALS[presetKey] || "");
    setSelectedSegmentId(null);
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

  // Optical Text Segmentation logic running locally to power the Segmenting Visualizer dynamically
  const getSegmentedBlocks = (): SegmentedBlock[] => {
    if (!customManualText) return [];
    
    // Split the document into logical paragraphs or double line-breaks
    const linesAndParagraphs = customManualText.split(/\n(?=\s*[A-Z0-9\-\s]{4,}:|\s*Section|\s*Accuracy|\s*[0-9]+|\s*Tolerances?)/g);
    let currentY = 15;

    return linesAndParagraphs.map((sec, i) => {
      const trimmed = sec.trim();
      if (!trimmed) return null;

      let type: "header" | "tabular" | "scpi" | "description" = "description";
      let title = "Metadata Context Block";
      let confidence = 0.82;
      let extractedFields: any = {};

      const lower = trimmed.toLowerCase();
      
      if (lower.includes("manual") || lower.includes("section") || lower.includes("technical specifications")) {
        type = "header";
        title = "Section Header Layer";
        confidence = 0.98;
      } else if (lower.includes("scpi") || lower.includes("verify:") || lower.includes("execution:") || lower.includes("command:") || lower.includes("conf:") || lower.includes("sens:") || lower.includes("sour:")) {
        type = "scpi";
        title = "SCPI Automation Registry";
        confidence = 0.96;
        
        const cmdMatch = trimmed.match(/(CONF:[A-Z0-9:\s\.;\?]+|SOUR:[A-Z0-9:\s\.;\?]+|SENS:[A-Z0-9:\s\.;\?]+|PRESET; [A-Z0-9\s:;\?\']+)/i);
        if (cmdMatch) {
          extractedFields.scpi_command = cmdMatch[1].trim();
        } else {
          extractedFields.scpi_command = "CONF:VOLT:DC; READ?";
        }
      } else if (lower.includes("range") || lower.includes("ppm") || lower.includes("tolerance") || lower.includes("limit") || lower.includes("accuracy") || lower.includes("ohm") || lower.includes("volt")) {
        type = "tabular";
        title = "Tabular Calibration Limit";
        confidence = 0.94;

        // Parse range
        const rangeMatch = trimmed.match(/(\d+\s*(?:mv|v|kohm|ohm|ma|a|hz))\s*range/i);
        if (rangeMatch) {
          extractedFields.range = rangeMatch[1];
        }

        // Parse ppm
        const ppmMatch = trimmed.match(/(\d+)\s*ppm/i);
        if (ppmMatch) {
          extractedFields.tolerance_ppm = parseInt(ppmMatch[1]);
        }
        
        // Parse nominal
        if (lower.includes("100 mv")) extractedFields.nominal_value = 0.1;
        else if (lower.includes("10 v")) extractedFields.nominal_value = 10.0;
        else if (lower.includes("1 v")) extractedFields.nominal_value = 1.0;
        else if (lower.includes("10 kohm")) extractedFields.nominal_value = 10000.0;
      } else {
        type = "description";
        title = "Metrology Compliance Note";
        confidence = 0.85;
      }

      const blockHeight = Math.max(60, Math.min(140, trimmed.split('\n').length * 22 + 28));
      const block: SegmentedBlock = {
        id: `seg-block-${i}`,
        type,
        title,
        text: trimmed,
        confidence,
        coordinates: { x: 20, y: currentY, w: 460, h: blockHeight },
        extractedFields: Object.keys(extractedFields).length > 0 ? extractedFields : undefined
      };
      
      currentY += blockHeight + 14;
      return block;
    }).filter((b): b is SegmentedBlock => b !== null);
  };

  const segmentedBlocks = getSegmentedBlocks();

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
            forecast: null // Clear current forecast as tolerances changed
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
      setPredictiveError(err.message || "Drift projection computation failed.");
    }
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
          forecast: null // Reset forecast to force recomputation with the new telemetry point
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
        // Simulates visa hardware polling activity
      }, hardwarePollingRate);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPyVISAHardwarePolling, hardwarePollingRate]);

  // Calculate drift chart points including forward extrapolations!
  const getChartData = () => {
    if (!activeProfile.runs || activeProfile.runs.length === 0) return [];
    
    const nominal = activeProfile.spec?.tolerance_array[0]?.nominal_value 
      || activeProfile.runs[0]?.nominal_value 
      || 10.0;

    const data = activeProfile.runs.map((r, i) => {
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

    if (activeProfile.forecast) {
      const lastRun = activeProfile.runs[activeProfile.runs.length - 1];
      const lastPpm = ((lastRun.as_found - nominal) / nominal) * 1e6;
      const monthlyDrift = activeProfile.forecast.current_drift_rate_ppm_month;
      const days = activeProfile.forecast.days_until_oot;

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

  const getActiveToleranceLimit = () => {
    if (activeProfile.spec && activeProfile.spec.tolerance_array.length > 0) {
      return activeProfile.spec.tolerance_array[0].tolerance_ppm;
    }
    return 24; // Default reference limit
  };

  const toleranceRatingLimit = getActiveToleranceLimit();
  const chartPoints = getChartData();

  const getShapColor = (index: number) => {
    const colors = ["#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#6B7280"];
    return colors[index % colors.length];
  };

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

  // Determine Asset risk category based on days_until_oot
  const getAssetStatus = () => {
    if (!activeProfile.forecast) return { label: "Unknown (No Forecast)", color: "text-gray-400 bg-gray-500/10 border-gray-500/20", risk: "low" };
    const days = activeProfile.forecast.days_until_oot;
    if (days < 90) return { label: "CRITICAL DRIFT WARNING", color: "text-red-400 bg-red-500/10 border-red-500/20", risk: "high" };
    if (days < 180) return { label: "MODERATE STRESS", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", risk: "medium" };
    return { label: "OPTIMAL STABILITY", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", risk: "none" };
  };

  const assetStatus = getAssetStatus();

  return (
    <div className="min-h-screen bg-brand-bg text-gray-100 font-sans flex flex-col selection:bg-blue-600 selection:text-white" id="cmis-viewport">
      
      {/* 1. BRAND HEADER BAR */}
      <header className="border-b border-brand-border bg-brand-panel/90 backdrop-blur-md sticky top-0 z-50 px-4 py-3" id="main-header">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-blue-500/20 border border-amber-500/30 rounded-xl relative overflow-hidden group">
              <Cpu className="w-6 h-6 text-amber-400 animate-pulse" />
              <div className="absolute inset-0 bg-amber-400/10 scale-0 group-hover:scale-100 transition-all rounded" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display font-bold text-gray-100 tracking-tight text-lg md:text-xl">
                  Cognitive Metrology Intelligence Service
                </h1>
                <span className="text-[10px] bg-brand-border text-amber-400 font-mono border border-brand-border/80 px-2 py-0.5 rounded uppercase font-semibold">
                  CMIS PRO
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium">
                ISO/IEC 17025 Compliant Document AI Templates & Predictive Stochastic Drift Microservice
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto" id="profile-selection">
            <span className="text-xs text-gray-400 font-semibold hidden sm:inline">Active Asset:</span>
            <select 
              value={activeProfileId}
              onChange={(e) => {
                setActiveProfileId(e.target.value);
                const prof = profiles.find(p => p.id === e.target.value);
                if (prof) {
                  setTargetInstrumentModel(prof.model);
                  setCustomManualText(PRESET_MANUALS[prof.model] || PRESET_MANUALS["Fluke 8846A"]);
                  setSelectedSegmentId(null);
                }
              }}
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
              className="px-2.5 py-1.5 border border-brand-border hover:bg-brand-border/50 text-gray-400 hover:text-gray-100 rounded-lg text-xs transition-all font-semibold"
              title="Reset profile data to factory seed template"
              id="reset-profile-btn"
            >
              Reset
            </button>
            
            {/* Mobile Sidebar Toggle Button */}
            <button 
              onClick={() => setShowSidebarOnMobile(!showSidebarOnMobile)}
              className="lg:hidden px-3 py-1.5 bg-brand-panel border border-brand-border text-amber-400 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-brand-border/30"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI HUD
            </button>
          </div>

        </div>
      </header>

      {/* METROLOGY SUMMARY BANNER CARD */}
      <section className="bg-gradient-to-r from-amber-500/10 via-brand-panel to-brand-panel max-w-[1600px] w-full mx-auto mt-4 px-4 py-3 border-b border-brand-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" id="active-summary-callout">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-amber-500 mt-1 shrink-0" />
          <div>
            <h2 className="text-sm font-display font-semibold text-gray-100">
              Active Profile: <span className="text-amber-400">{activeProfile.model}</span> (S/N: {activeProfile.serial_number})
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Recalibration is on a <strong>{activeProfile.calibration_cycle_months}-month</strong> cycle. 
              {activeProfile.spec 
                ? ` Tolerances mapped via ${activeProfile.spec.embedding_model_selected}.`
                : " Standard specs are set. Open 'Document AI Pipeline' to upload a custom specification sheet."
              }
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="bg-brand-bg px-2.5 py-1 border border-brand-border rounded-lg">
            <span className="text-gray-400">Spec Base: </span> 
            <span className="text-amber-400 font-semibold">±{toleranceRatingLimit} PPM</span>
          </div>
          <div className="bg-brand-bg px-2.5 py-1 border border-brand-border rounded-lg">
            <span className="text-gray-400">Logs: </span> 
            <span className="text-blue-400 font-semibold">{activeProfile.runs.length} Runs</span>
          </div>
        </div>
      </section>

      {/* THREE-COLUMN MODERN LAYOUT WITH PERSISTENT SIDEBAR */}
      <div className="max-w-[1600px] w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0" id="main-grid-container">
        
        {/* ==================== LEFT COLUMN: MAIN CONTENT ZONE & TABS (9 COLS) ==================== */}
        <main className="lg:col-span-9 p-4 md:p-6 flex flex-col gap-6 border-r border-brand-border">
          
          {/* NAVIGATION TABS RAIL */}
          <div className="flex flex-wrap items-center justify-between border-b border-brand-border pb-1 gap-2">
            <div className="flex items-center gap-1" id="tab-navigation-rail">
              <button
                onClick={() => { setActiveTab("assets"); setSelectedSegmentId(null); }}
                className={`px-4 py-2.5 text-xs font-bold transition-all rounded-lg flex items-center gap-2 border cursor-pointer ${
                  activeTab === "assets" 
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-400" 
                    : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-brand-panel/40"
                }`}
                id="tab-btn-assets"
              >
                <Layers className="w-3.5 h-3.5" />
                Lab Assets & Runs
              </button>
              
              <button
                onClick={() => { setActiveTab("document-ai"); setSelectedSegmentId(null); }}
                className={`px-4 py-2.5 text-xs font-bold transition-all rounded-lg flex items-center gap-2 border cursor-pointer ${
                  activeTab === "document-ai" 
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-400" 
                    : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-brand-panel/40"
                }`}
                id="tab-btn-document-ai"
              >
                <FileText className="w-3.5 h-3.5" />
                Document AI Pipeline
              </button>

              <button
                onClick={() => { setActiveTab("forecasting"); setSelectedSegmentId(null); }}
                className={`px-4 py-2.5 text-xs font-bold transition-all rounded-lg flex items-center gap-2 border cursor-pointer ${
                  activeTab === "forecasting" 
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-400" 
                    : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-brand-panel/40"
                }`}
                id="tab-btn-forecasting"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Drift Forecasting
              </button>

              <button
                onClick={() => { setActiveTab("playground"); setSelectedSegmentId(null); }}
                className={`px-4 py-2.5 text-xs font-bold transition-all rounded-lg flex items-center gap-2 border cursor-pointer ${
                  activeTab === "playground" 
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-400" 
                    : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-brand-panel/40"
                }`}
                id="tab-btn-playground"
              >
                <Terminal className="w-3.5 h-3.5" />
                API Gateway Playground
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-gray-500">
              <span>Status:</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-gray-400 font-semibold">ISO/IEC 17025 Secure</span>
            </div>
          </div>

          {/* ACTIVE PAGE CONTENT AREA */}
          <div className="flex-1" id="active-tab-panel">
            <AnimatePresence mode="wait">
              
              {/* PAGE 1: LAB ASSETS & HISTORIC TELEMETRY RUNS */}
              {activeTab === "assets" && (
                <motion.div
                  key="assets-page"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  {/* METROLOGY PROFILES GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="assets-profiles-grid">
                    {profiles.map((p) => {
                      const isActive = p.id === activeProfileId;
                      return (
                        <div 
                          key={p.id}
                          onClick={() => {
                            setActiveProfileId(p.id);
                            setTargetInstrumentModel(p.model);
                            setCustomManualText(PRESET_MANUALS[p.model] || PRESET_MANUALS["Fluke 8846A"]);
                          }}
                          className={`p-4 rounded-xl border text-left cursor-pointer transition-all relative overflow-hidden group ${
                            isActive 
                              ? "bg-brand-panel border-amber-500 shadow-lg shadow-amber-500/5" 
                              : "bg-brand-panel/50 border-brand-border hover:border-gray-600"
                          }`}
                        >
                          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-all" />
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-gray-400">
                              S/N: {p.serial_number}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-400 animate-ping' : 'bg-gray-600'}`} />
                          </div>
                          <h4 className="font-display font-bold text-gray-100 text-sm truncate">
                            {p.model}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1 truncate">{p.name}</p>
                          
                          <div className="mt-4 pt-3 border-t border-brand-border flex items-center justify-between text-[11px] text-gray-400 font-mono">
                            <span>Cycle: {p.calibration_cycle_months} mo</span>
                            <span className="text-amber-500 font-bold">{p.runs.length} points logged</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* TELEMETRY RUNS LOGGER SECTION */}
                  <div className="bg-brand-panel border border-brand-border rounded-xl p-5" id="telemetry-runs-dashboard">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-brand-border pb-3 mb-4 gap-2">
                      <div>
                        <h3 className="font-display font-bold text-gray-100 text-sm">
                          Stochastic Calibration Telemetry Runs
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Inject live VISA, GPIB, or environmental sensor readings directly to model active drift.
                        </p>
                      </div>
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full font-bold border border-blue-400/20 font-mono">
                        As-Found & As-Left Logs
                      </span>
                    </div>

                    <form onSubmit={handleAddNewRun} className="mb-5 bg-brand-bg/50 border border-brand-border p-4 rounded-xl" id="add-run-form">
                      <span className="text-[11px] text-amber-400 font-mono block mb-3 uppercase font-bold tracking-wider">
                        + Simulate Live VISA Signal / Hardware Ingestion
                      </span>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                        <div>
                          <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">As-Found Reading:</label>
                          <input 
                            type="number" 
                            step="0.0000001"
                            value={asFoundInput}
                            onChange={(e) => setAsFoundInput(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border rounded-lg text-xs px-2.5 py-1.5 focus:border-amber-500 focus:outline-none font-mono text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">As-Left Realignment:</label>
                          <input 
                            type="number" 
                            step="0.0000001"
                            value={asLeftInput}
                            onChange={(e) => setAsLeftInput(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border rounded-lg text-xs px-2.5 py-1.5 focus:border-amber-500 focus:outline-none font-mono text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Cycles Count:</label>
                          <input 
                            type="number" 
                            value={cyclesInput}
                            onChange={(e) => setCyclesInput(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border rounded-lg text-xs px-2.5 py-1.5 focus:border-amber-500 focus:outline-none font-mono text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Temp (BME280):</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              step="0.1"
                              value={tempInput}
                              onChange={(e) => setTempInput(e.target.value)}
                              className="w-full bg-brand-bg border border-brand-border rounded-lg text-xs pl-2.5 pr-6 py-1.5 focus:border-amber-500 focus:outline-none font-mono text-white"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-gray-500 font-mono">°C</span>
                          </div>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Humidity RH%:</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              step="0.1"
                              value={humidityInput}
                              onChange={(e) => setHumidityInput(e.target.value)}
                              className="w-full bg-brand-bg border border-brand-border rounded-lg text-xs pl-2.5 pr-6 py-1.5 focus:border-amber-500 focus:outline-none font-mono text-white"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-gray-500 font-mono">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="bg-amber-500 hover:bg-amber-400 border border-amber-600 text-brand-bg text-xs font-bold py-2 px-5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-amber-500/10"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Inject Telemetry Run
                        </button>
                      </div>
                    </form>

                    {/* Telemetry Table */}
                    <div className="overflow-x-auto border border-brand-border rounded-xl bg-brand-bg/20" id="runs-history-container">
                      {activeProfile.runs.length === 0 ? (
                        <div className="text-center py-8 text-xs text-gray-500 font-medium">
                          No calibration points logged. Inject a test run above to populate the timeline.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#1C253E] text-gray-300 font-semibold border-b border-brand-border">
                            <tr>
                              <th className="p-3 font-mono">Run ID</th>
                              <th className="p-3">As-Found Reading</th>
                              <th className="p-3">As-Left Realignment</th>
                              <th className="p-3">Environmental (Temp / Humidity)</th>
                              <th className="p-3">Cumulative Cycles</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-brand-border font-mono text-gray-300">
                            {activeProfile.runs.map((run) => {
                              const isLive = run.run_id.startsWith("live");
                              return (
                                <tr key={run.run_id} className="hover:bg-brand-panel/40 transition-colors">
                                  <td className={`p-3 font-bold ${isLive ? 'text-emerald-400' : 'text-gray-400'}`}>
                                    {run.run_id} {isLive && "•"}
                                  </td>
                                  <td className="p-3 font-bold text-gray-200">{run.as_found.toFixed(6)}</td>
                                  <td className="p-3 text-gray-400">{run.as_left.toFixed(6)}</td>
                                  <td className="p-3 font-sans text-gray-300">
                                    {run.temperature_c}°C / {run.humidity_rh}% RH
                                  </td>
                                  <td className="p-3 text-gray-400">{run.operating_cycles.toLocaleString()}</td>
                                  <td className="p-3 text-right">
                                    <button 
                                      onClick={() => handleDeleteRun(run.run_id)}
                                      className="text-gray-500 hover:text-red-400 p-1.5 rounded hover:bg-brand-bg transition-colors cursor-pointer"
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
                </motion.div>
              )}

              {/* PAGE 2: DOCUMENT AI KNOWLEDGE INGESTION & BLOCK SEGMENTATION */}
              {activeTab === "document-ai" && (
                <motion.div
                  key="document-ai-page"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    
                    {/* Left Column: Control Panel */}
                    <div className="xl:col-span-5 space-y-4">
                      <div className="bg-brand-panel border border-brand-border rounded-xl p-5" id="spec-ingestion-control">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-amber-500" />
                          <h4 className="font-display font-bold text-gray-200 text-xs uppercase tracking-wide">
                            Ingestion Options
                          </h4>
                        </div>
                        
                        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                          Provide standard instrument calibration instructions. Differentiates paragraphs from tolerance limits and SCPI drivers.
                        </p>

                        {/* Presets */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {Object.keys(PRESET_MANUALS).map((key) => (
                            <button
                              key={key}
                              onClick={() => handlePresetSelect(key)}
                              className={`px-2.5 py-2 text-[11px] rounded-lg border font-bold transition-all text-center truncate cursor-pointer ${
                                targetInstrumentModel === key 
                                  ? "border-amber-500 bg-amber-500/10 text-amber-400" 
                                  : "border-brand-border bg-brand-bg/60 text-gray-400 hover:text-gray-200"
                              }`}
                            >
                              {key} Presets
                            </button>
                          ))}
                        </div>

                        {/* Drag and Drop Ingest */}
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
                        >
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".pdf,.txt,.doc"
                            className="hidden" 
                          />
                          {selectedFile ? (
                            <>
                              <FileSpreadsheet className="w-6 h-6 text-emerald-400 mb-2 animate-bounce" />
                              <span className="text-xs text-gray-200 font-bold truncate max-w-full">
                                {selectedFile.name}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-mono mt-0.5 font-semibold">
                                Ready to Extract ({Math.round(selectedFile.size / 1024)} KB)
                              </span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-gray-400 mb-2" />
                              <span className="text-xs text-gray-300 font-bold">
                                Upload Manufacturer Manual
                              </span>
                              <span className="text-[10px] text-gray-500 mt-1 font-medium">
                                Supports .pdf, .txt or drag-and-drop
                              </span>
                            </>
                          )}
                        </div>

                        {/* Text manual area */}
                        <div className="space-y-1.5 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Specification Text:</span>
                            <span className="text-[10px] text-amber-500 font-mono">{customManualText.length} chars</span>
                          </div>
                          <textarea
                            value={customManualText}
                            onChange={(e) => {
                              setCustomManualText(e.target.value);
                              setSelectedSegmentId(null);
                            }}
                            className="w-full bg-brand-bg text-xs border border-brand-border rounded-lg p-3 h-44 focus:border-amber-500 focus:outline-none text-gray-300 font-mono leading-relaxed"
                            placeholder="Type specifications..."
                          />
                        </div>

                        {/* Model name / embedding display */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Model Identity:</label>
                            <input 
                              type="text"
                              value={targetInstrumentModel}
                              onChange={(e) => setTargetInstrumentModel(e.target.value)}
                              className="w-full bg-brand-bg text-xs border border-brand-border rounded-md px-2.5 py-1.5 focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 font-bold block mb-1 uppercase">Embeddings Engine:</label>
                            <div className="bg-brand-bg/80 border border-brand-border text-xs rounded-md px-2.5 py-1.5 text-gray-400 font-mono truncate select-none">
                              {activeProfile.spec?.embedding_model_selected || "SciBERT (Metrology)"}
                            </div>
                          </div>
                        </div>

                        {/* Trigger Extraction Button */}
                        <button
                          onClick={() => handleExtractTemplate()}
                          disabled={documentAIStatus === "loading"}
                          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-brand-border disabled:to-brand-border disabled:text-gray-500 text-brand-bg text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                        >
                          {documentAIStatus === "loading" ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-brand-bg border-t-transparent rounded-full animate-spin" />
                              Parsing Document Segments...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 fill-current" />
                              Synchronize Custom Specs Template
                            </>
                          )}
                        </button>

                        {documentAIError && (
                          <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                            {documentAIError}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Dynamic Segmenting Visualizer */}
                    <div className="xl:col-span-7 space-y-4">
                      
                      {/* INTERACTIVE SEGMENTED CANVAS */}
                      <div className="bg-brand-panel border border-brand-border rounded-xl p-5" id="optical-block-segmenter">
                        <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
                          <div>
                            <h3 className="font-display font-bold text-gray-100 text-sm">
                              Optical Block Segmentation Visualizer
                            </h3>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Click on any parsed block to inspect coordinates, classification tags, and properties.
                            </p>
                          </div>
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono font-bold">
                            Live Layout Engine
                          </span>
                        </div>

                        {/* Interactive Document Layout Wrapper */}
                        <div className="border border-brand-border rounded-xl bg-[#090C14] p-4 relative overflow-hidden max-h-[460px] overflow-y-auto" id="segmentation-document-preview">
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 border border-brand-border/60 px-2 py-1 rounded text-[9px] font-mono text-gray-500">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                            <span>VGA SCAN RESOLVED</span>
                          </div>

                          {segmentedBlocks.length === 0 ? (
                            <div className="text-center py-20 text-xs text-gray-500">
                              Document is empty. Enter some text specifications on the left to resolve blocks.
                            </div>
                          ) : (
                            <div className="space-y-3 font-mono">
                              {segmentedBlocks.map((block) => {
                                const isSelected = selectedSegmentId === block.id;
                                
                                // Color styles based on Block Classification type
                                const stylesMap = {
                                  header: {
                                    border: isSelected ? "border-purple-400 bg-purple-500/15" : "border-purple-500/40 bg-purple-500/5 hover:border-purple-400/70",
                                    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
                                    dot: "bg-purple-400"
                                  },
                                  tabular: {
                                    border: isSelected ? "border-amber-400 bg-amber-500/15" : "border-amber-500/40 bg-amber-500/5 hover:border-amber-400/70",
                                    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                                    dot: "bg-amber-400"
                                  },
                                  scpi: {
                                    border: isSelected ? "border-emerald-400 bg-emerald-500/15" : "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-400/70",
                                    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                                    dot: "bg-emerald-400"
                                  },
                                  description: {
                                    border: isSelected ? "border-blue-400 bg-blue-500/15" : "border-brand-border bg-blue-500/5 hover:border-blue-400/50",
                                    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                                    dot: "bg-blue-400"
                                  }
                                };
                                const colors = stylesMap[block.type];

                                return (
                                  <div
                                    key={block.id}
                                    onClick={() => setSelectedSegmentId(block.id === selectedSegmentId ? null : block.id)}
                                    className={`p-3.5 border border-dashed rounded-lg cursor-pointer transition-all ${colors.border}`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                                        <span className="text-[10px] font-bold text-gray-200">{block.title}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-gray-500">
                                          X:{block.coordinates.x}, Y:{block.coordinates.y}
                                        </span>
                                        <span className={`text-[9px] border px-1.5 py-0.5 rounded font-bold ${colors.badge}`}>
                                          Conf: {(block.confidence * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                    <pre className="text-[10px] text-gray-300 whitespace-pre-wrap leading-normal font-mono select-all font-medium">
                                      {block.text}
                                    </pre>
                                    
                                    {/* Segment block drill-down parsed results */}
                                    {block.extractedFields && (
                                      <div className="mt-3 pt-2 border-t border-brand-border/60 flex flex-wrap items-center gap-2 text-[9px]">
                                        <span className="text-amber-400 font-bold">Extracted Parameters:</span>
                                        {block.extractedFields.range && (
                                          <span className="bg-brand-bg px-2 py-0.5 border border-brand-border rounded text-gray-300">
                                            Range: {block.extractedFields.range}
                                          </span>
                                        )}
                                        {block.extractedFields.tolerance_ppm && (
                                          <span className="bg-brand-bg px-2 py-0.5 border border-brand-border rounded text-amber-300 font-semibold">
                                            PPM: ±{block.extractedFields.tolerance_ppm}
                                          </span>
                                        )}
                                        {block.extractedFields.scpi_command && (
                                          <span className="bg-brand-bg px-2 py-0.5 border border-brand-border rounded text-blue-400 font-mono truncate max-w-[200px]" title={block.extractedFields.scpi_command}>
                                            GPIB: {block.extractedFields.scpi_command}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Selection Inspect Card */}
                        {selectedSegmentId && (
                          <div className="mt-4 p-4 bg-brand-bg border border-brand-border rounded-xl">
                            {(() => {
                              const block = segmentedBlocks.find(b => b.id === selectedSegmentId);
                              if (!block) return null;
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
                                    <span className="text-[10px] text-amber-400 font-bold uppercase font-mono">
                                      BLOCK METADATA EXPLORER
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-mono">
                                      H: {block.coordinates.h}px W: {block.coordinates.w}px
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-300 leading-normal">
                                    This block represents a <span className="text-amber-400 font-bold">{block.title}</span> layout region. 
                                    {block.extractedFields ? " High-confidence fields were successfully parsed and mapped." : " General layout context utilized for RAG database constraints."}
                                  </p>
                                  {block.extractedFields && (
                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-1">
                                      <div className="bg-brand-panel p-2 border border-brand-border rounded-lg text-xs font-mono">
                                        <span className="text-gray-500 text-[10px] block font-sans">Resolved Range</span>
                                        <span className="text-gray-200 font-bold">{block.extractedFields.range || "All-Scale"}</span>
                                      </div>
                                      <div className="bg-brand-panel p-2 border border-brand-border rounded-lg text-xs font-mono">
                                        <span className="text-gray-500 text-[10px] block font-sans">Tolerance PPM Bound</span>
                                        <span className="text-amber-400 font-bold">{block.extractedFields.tolerance_ppm ? `±${block.extractedFields.tolerance_ppm} PPM` : "N/A"}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* ACTIVE EXTRACTED SPECS TABLE */}
                      <div className="bg-brand-panel border border-brand-border rounded-xl p-5">
                        <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
                          <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-amber-500" />
                            <div>
                              <h3 className="font-display font-bold text-gray-100 text-sm">
                                Extracted Specification Grid Limits
                              </h3>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Current active thresholds parsed by Document AI and saved to profile.
                              </p>
                            </div>
                          </div>
                        </div>

                        {!activeProfile.spec ? (
                          <div className="text-center py-8 bg-brand-bg/40 border border-brand-border border-dashed rounded-xl">
                            <FileText className="w-6 h-6 text-amber-500/40 mx-auto mb-2" />
                            <span className="text-xs font-semibold text-gray-400 block">No bounds extracted.</span>
                            <p className="text-[11px] text-gray-500 mt-1 max-w-xs mx-auto">
                              Extract a specification template on the left panel to synchronize tolerances.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-brand-border rounded-lg" id="bounds-grid-table">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-[#1C253E] text-gray-400 font-semibold border-b border-brand-border">
                                <tr>
                                  <th className="p-3">Parameter</th>
                                  <th className="p-3">Range</th>
                                  <th className="p-3 font-mono">Test Point</th>
                                  <th className="p-3 text-amber-400">PPM Spec</th>
                                  <th className="p-3 font-mono">Upper Bound</th>
                                  <th className="p-3">SCPI Command</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-brand-border text-gray-300 font-medium">
                                {activeProfile.spec.tolerance_array.map((item) => (
                                  <tr key={item.id} className="hover:bg-brand-bg/40 transition-colors">
                                    <td className="p-3 text-xs font-bold text-gray-200">{item.parameter}</td>
                                    <td className="p-3 font-mono text-gray-400">{item.range}</td>
                                    <td className="p-3 font-mono text-amber-400 font-bold">{item.test_point}</td>
                                    <td className="p-3 text-amber-500 font-mono font-semibold">±{item.tolerance_ppm}</td>
                                    <td className="p-3 font-mono text-gray-400">{item.upper_limit.toFixed(6)} {item.unit}</td>
                                    <td className="p-3 font-mono text-[10px] text-blue-400 select-all" title={item.scpi_command}>
                                      {item.scpi_command}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* PAGE 3: STOCHASTIC DRIFT FORECASTING */}
              {activeTab === "forecasting" && (
                <motion.div
                  key="forecasting-page"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div className="bg-brand-panel border border-brand-border rounded-xl p-5 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-border pb-3 mb-4 gap-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-400 animate-pulse" />
                        <div>
                          <h3 className="font-display font-bold text-gray-100 text-sm">
                            Stochastic Drift Analysis & Regression Model
                          </h3>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Real-time modeling of as-found drifts with confidence intervals plotted against specification limit bands.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleCalculateForecast}
                        disabled={activeProfile.runs.length === 0 || !activeProfile.spec || predictiveStatus === "loading"}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-[11px] font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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
                        <span className="text-xs text-gray-400 font-semibold block">Tolerances are missing.</span>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Ingest a specification template in Document AI tab to define specification limit lines.
                        </p>
                      </div>
                    ) : chartPoints.length === 0 ? (
                      <div className="text-center py-20 bg-brand-bg/40 rounded-xl">
                        <span className="text-xs text-gray-500 font-medium">Please inject some telemetry runs under Lab Assets tab.</span>
                      </div>
                    ) : (
                      <div className="w-full h-80 mt-2" id="recharts-line-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartPoints} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
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
                            
                            {/* Limits */}
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
                              name="Ensemble Projected Path"
                              stroke="#3B82F6" 
                              strokeWidth={2.2}
                              strokeDasharray="4 4" 
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* FORECAST DETAILS SECTION */}
                  {activeProfile.forecast ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="forecast-details-dashboard">
                      
                      {/* OOT Stats Card */}
                      <div className="bg-brand-panel border border-brand-border p-5 rounded-xl flex flex-col justify-between relative">
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">
                            Forecasted OOT Breach Countdown
                          </span>
                          <h4 className="text-3xl font-display font-bold text-amber-500 mt-1">
                            {activeProfile.forecast.projected_oot_date}
                          </h4>
                          <p className="text-xs text-gray-300 font-semibold mt-1">
                            Calculated Out-of-Tolerance in <span className="text-white font-bold underline decoration-amber-500">{activeProfile.forecast.days_until_oot} Days</span>
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono mt-3">
                            Estimated confidence bounds: {activeProfile.forecast.confidence_interval.lower_days} to {activeProfile.forecast.confidence_interval.upper_days} days
                          </p>
                        </div>
                        
                        <div className="absolute top-4 right-4 p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full">
                          <Flame className="w-4 h-4" />
                        </div>

                        <div className="mt-4 pt-3 border-t border-brand-border flex items-center justify-between text-xs font-mono text-gray-400">
                          <span>Calculated Drift Speed:</span>
                          <span className="text-amber-400 font-bold">{activeProfile.forecast.current_drift_rate_ppm_month.toFixed(3)} PPM/Mo</span>
                        </div>
                      </div>

                      {/* SHAP Factor Attributions */}
                      <div className="bg-brand-panel border border-brand-border p-5 rounded-xl">
                        <div className="flex items-center justify-between mb-3 border-b border-brand-border pb-2.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide flex items-center gap-1">
                            <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                            ISO 17025 Auditable SHAP Weights
                          </span>
                          <span className="text-[9px] text-gray-500 font-mono">{activeProfile.forecast.model_type_used}</span>
                        </div>

                        <div className="h-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={activeProfile.forecast.shap_values} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
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

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {activeProfile.forecast.shap_values.slice(0, 4).map((v, i) => (
                            <div key={v.factor} className="flex items-center gap-2 text-[10px] text-gray-300">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getShapColor(i) }} />
                              <span className="truncate font-bold">{v.factor.replace(/\(BME280\)|\(Age\)/, "")}</span>
                              <span className="font-mono text-gray-400 text-[9px] ml-auto">{v.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-12 bg-brand-panel border border-brand-border rounded-xl">
                      <HelpCircle className="w-8 h-8 text-blue-500/40 mx-auto mb-2" />
                      <span className="text-xs text-gray-400 font-bold block">No forecasting parameters resolved yet.</span>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Click the **'Forecast Asset Drift'** button above to generate a stochastic regression prediction.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* PAGE 4: DEV SANDBOX PLAYGROUND */}
              {activeTab === "playground" && (
                <motion.div
                  key="playground-page"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div className="bg-brand-panel border border-brand-border rounded-xl p-5" id="developer-gateway">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-brand-border pb-3 mb-4 gap-2">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-blue-400" />
                        <div>
                          <h3 className="font-display font-bold text-gray-100 text-sm">
                            Developer REST API Gateway Playground
                          </h3>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Query microservice endpoints. Zero-blocking hardware orchestration loops.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-start sm:self-auto uppercase font-mono text-[10px]">
                        <span className="text-gray-400">VISA Driver Polling:</span>
                        <button 
                          onClick={() => setIsPyVISAHardwarePolling(!isPyVISAHardwarePolling)}
                          className={`px-2 py-1 rounded font-bold transition-all border cursor-pointer ${
                            isPyVISAHardwarePolling 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                              : "bg-brand-bg text-gray-400 border-brand-border"
                          }`}
                        >
                          {isPyVISAHardwarePolling ? "● Active Thread" : "○ Paused Thread"}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                      Heavy machine learning and Document AI models run completely decoupled from core real-time telemetry pipelines, ensuring that GPIB or PyVISA polling is never bottlenecked. Use this terminal console to audit network responses in real-time.
                    </p>

                    <div className="flex border-b border-brand-border mb-3" id="terminal-tabs">
                      <button
                        onClick={() => setDeveloperConsoleTab("curl")}
                        className={`px-3 py-1.5 text-xs font-semibold transition-all border-b-2 cursor-pointer ${
                          developerConsoleTab === "curl" 
                            ? "border-amber-500 text-amber-400 bg-brand-bg/40" 
                            : "border-transparent text-gray-400 hover:text-gray-200"
                        }`}
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
                      >
                        Calibration Payload JSON
                      </button>
                      <button
                        onClick={() => setDeveloperConsoleTab("response")}
                        className={`px-3 py-1.5 text-xs font-semibold transition-all border-b-2 cursor-pointer relative ${
                          developerConsoleTab === "response" 
                            ? "border-amber-500 text-amber-400 bg-brand-bg/40" 
                            : "border-transparent text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        Microservice Response JSON
                        {playgroundServerResponse && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                        )}
                      </button>
                    </div>

                    <div className="bg-brand-bg/90 border border-brand-border rounded-lg p-3.5 relative font-mono text-[11px]" id="code-snippet-box">
                      <pre className="whitespace-pre-wrap overflow-x-auto text-gray-300 max-h-[340px] leading-relaxed">
                        {getCurlSnippet()}
                      </pre>

                      <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-[10px] font-mono text-gray-500">
                        <div>
                          Latest Endpoint Run: <span className="text-gray-400">{lastApiTriggered || "None"}</span>
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
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </main>

        {/* ==================== RIGHT COLUMN: PERSISTENT EXPLAINABLE AI PREVIEW SIDEBAR ==================== */}
        {/* Visible always on desktop (lg+), collapsible drawer on mobile */}
        <aside 
          className={`lg:col-span-3 bg-brand-panel/30 p-5 flex flex-col gap-5 sticky top-[80px] h-fit max-h-[calc(100vh-80px)] overflow-y-auto lg:block ${
            showSidebarOnMobile 
              ? "fixed inset-y-0 right-0 w-80 z-50 bg-brand-panel border-l border-brand-border shadow-2xl p-6 lg:relative lg:inset-auto lg:w-auto lg:z-auto" 
              : "hidden"
          }`}
          id="explainable-ai-side-preview"
        >
          {/* Mobile close button */}
          <div className="lg:hidden flex justify-end mb-2">
            <button 
              onClick={() => setShowSidebarOnMobile(false)}
              className="text-gray-400 hover:text-white text-xs font-bold font-mono px-2 py-1 border border-brand-border rounded"
            >
              [X] Close HUD
            </button>
          </div>

          <div className="border-b border-brand-border pb-3">
            <span className="text-[10px] text-amber-500 font-bold uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Explainable AI Preview
            </span>
            <h3 className="text-xs text-gray-400 mt-1 font-bold">
              Cognitive Live Diagnostics
            </h3>
          </div>

          {/* Active Asset Card */}
          <div className="bg-brand-bg/60 border border-brand-border p-3.5 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">Asset ID Card</span>
            <h4 className="text-sm font-display font-bold text-gray-200 mt-1 truncate">
              {activeProfile.model}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">S/N: {activeProfile.serial_number}</p>
            
            <div className={`mt-3 border px-2.5 py-1 rounded text-[9.5px] font-bold font-mono inline-block ${assetStatus.color}`}>
              {assetStatus.label}
            </div>
          </div>

          {/* OOT Countdown Gauge */}
          <div className="bg-brand-bg/60 border border-brand-border p-3.5 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">Projected OOT Countdown</span>
            {activeProfile.forecast ? (
              <div className="mt-2 space-y-1">
                <div className="text-xl font-display font-bold text-amber-400">
                  {activeProfile.forecast.days_until_oot} Days Remaining
                </div>
                <p className="text-[10.5px] text-gray-400 font-medium">
                  Breach estimated: <span className="text-gray-200 font-bold">{activeProfile.forecast.projected_oot_date}</span>
                </p>
                {/* Visual meter bar */}
                <div className="w-full h-1.5 bg-brand-border rounded-full mt-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      activeProfile.forecast.days_until_oot < 120 ? 'bg-red-500' : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${Math.min(100, (activeProfile.forecast.days_until_oot / 365) * 100)}%` }} 
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2 py-3 text-left">
                <p className="text-[11px] text-gray-500">No forecasting computed. Go to **Drift Forecasting** tab to calculate projections.</p>
              </div>
            )}
          </div>

          {/* Persistent SHAP list */}
          <div className="bg-brand-bg/60 border border-brand-border p-3.5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-gray-500 font-bold uppercase block">SHAP Factor Attributions</span>
              {activeProfile.forecast && (
                <span className="text-[8.5px] text-gray-500 font-mono">Ensemble %</span>
              )}
            </div>

            {activeProfile.forecast ? (
              <div className="space-y-2.5">
                {activeProfile.forecast.shap_values.slice(0, 4).map((entry, idx) => (
                  <div key={entry.factor} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-300">
                      <span className="truncate font-bold">{entry.factor.replace(/\(BME280\)|\(Age\)/, "")}</span>
                      <span className="font-mono text-[9px] text-gray-400">{entry.percentage}%</span>
                    </div>
                    {/* Tiny bar */}
                    <div className="w-full h-1 bg-brand-border rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full" 
                        style={{ 
                          width: `${entry.percentage}%`,
                          backgroundColor: getShapColor(idx)
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-2.5 text-left text-[11px] text-gray-500">
                Trigger **Drift Forecast** to view live sensor coordinates weights.
              </div>
            )}
          </div>

          {/* Sticky AI Metrologist Insight Advice */}
          <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/25 p-3.5 rounded-xl">
            <span className="text-[9px] text-amber-400 font-bold uppercase font-mono tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 fill-current" />
              Live AI Advisor Comment
            </span>
            <p className="text-[11px] text-gray-300 mt-2 font-medium leading-relaxed italic">
              "{activeProfile.forecast ? activeProfile.forecast.metrologist_annotation : 'Select a profile and calculate forecasting to resolve custom compliance comments.'}"
            </p>
          </div>

        </aside>

      </div>

      {/* FOOTER BAR */}
      <footer className="border-t border-brand-border bg-brand-panel py-6 px-4 text-center text-xs text-gray-500 font-mono" id="main-footer">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Cognitive Metrology Intelligence Service (CMIS). Decoupled Calibration AI Gateway.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-gray-300 transition-colors">ISO/IEC 17025 Standard</span>
            <span>•</span>
            <span className="hover:text-gray-300 transition-colors">RAG Optical Tables resolved</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
