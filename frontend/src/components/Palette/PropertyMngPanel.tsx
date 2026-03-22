import { useState, useRef, useEffect, useMemo } from "react";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import "./PropertyMngPanel.css";
import { buildExportJSONLD } from "../../utils/exportJSONLD";
import { buildExportJSON, buildExportTurtle } from "../../utils/exportFormats";
import { useAuth } from "../../context/AuthContext";

type SelectedItem = {
  kind: "wam" | "link";
  id?: string;
  wamType?: string;
  linkType?: string;
  label?: string;
  description?: string;
  props?: Record<string, any>;
  sourceHandle?: string;
  targetHandle?: string;
  setLabel?: (label: string) => void;
  setDescription?: (desc: string) => void;
  setProp?: (key: string, value: any) => void;
  setSourceHandle?: (handle: string) => void;
  setTargetHandle?: (handle: string) => void;
};

type ModelSnapshot = {
  nodes: any[];
  edges: any[];
};

interface PropertyMngPanelProps {
  selected: SelectedItem | null;
  model: ModelSnapshot;
  externalDiagram?: any;
  onValidateBeforeSave?: () => Promise<{ valid: boolean; errors: string[] }>;
  onImport?: (diagram: any) => void;
  onSave?: () => void;
}

type NotifyFn = (message: string, type?: "success" | "error") => void;

// Utility Functions
function prettyWamType(t: string): string {
  const types: Record<string, string> = {
    service: "Service",
    application: "Application",
    dataProvider: "Data Provider",
    processUnit: "Process Unit",
    identityProvider: "Identity Provider",
    securityRealm: "Security Realm",
    aiService: "AI Service",
    aiApplication: "AI Application",
    dataset: "Dataset",
    aiProcess: "AI Process",
  };
  return types[t] || t;
}

function prettyLinkType(t: string): string {
  const types: Record<string, string> = {
    legacy: "Legacy Relationship",
    invocation: "Invocation",
    trust: "Trust Relationship",
  };
  return types[t] || t;
}

function downloadText(
  filename: string,
  content: string,
  mime: string = "text/plain",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Element Tab Component
function ElementTab({ selected }: { selected: SelectedItem | null }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [protocol, setProtocol] = useState("HTTPS");
  const [inputs, setInputs] = useState("");
  const [outputs, setOutputs] = useState("");
  const [dataset, setDataset] = useState("");
  const [modelName, setModelName] = useState("");
  const [functionality, setFunctionality] = useState("Inference");
  const [bias, setBias] = useState("");

  const props = useMemo(() => selected?.props ?? {}, [selected]);

  useEffect(() => {
    if (!selected) {
      setName("");
      setDescription("");
      setEndpoint("");
      setInputs("");
      setOutputs("");
      setDataset("");
      setModelName("");
      setFunctionality("Inference");
      setBias("");
      return;
    }
    setName(selected.label ?? "");
    setDescription(selected.description ?? "");
    setEndpoint((props as any).endpoint ?? "");
    setProtocol((props as any).protocol ?? "HTTPS");
    setInputs((props as any).inputs ?? "");
    setOutputs((props as any).outputs ?? "");
    setDataset((props as any).dataset ?? "");
    setModelName((props as any).modelName ?? "");
    setFunctionality((props as any).functionality ?? "Inference");
    setBias((props as any).biasConsiderations ?? "");
  }, [selected, props]);

  const typeText =
    selected?.kind === "wam"
      ? prettyWamType(selected.wamType ?? "Unknown")
      : prettyLinkType(selected?.linkType ?? "link");

  if (!selected)
    return <div className="ppEmpty">Select an element on the canvas</div>;

  return (
    <div>
      {selected.kind === "wam" && (
        <div className="ppSection">
          <label className="ppLabel">Label *</label>
          <input
            type="text"
            placeholder="Write a label"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              selected.setLabel?.(e.target.value);
            }}
            className="ppInput"
          />
        </div>
      )}

      <div className="ppSection">
        <label className="ppLabel">Type</label>
        <div className="ppReadOnly">{typeText}</div>
      </div>

      <div className="ppSection">
        <label className="ppLabel">Description</label>
        <textarea
          placeholder="Describe: What it is, what it does, interactions, and any security/AI relevance..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            selected.setDescription?.(e.target.value);
          }}
          className="ppInput"
          style={{ height: "100px" }}
        />
        <p className="ppHint">
          Explain role, responsibility, and interactions.
        </p>
      </div>

      {selected.kind === "wam" &&
        ["aiService", "aiApplication", "aiProcess", "dataset"].includes(
          selected.wamType ?? "",
        ) && (
          <>
            <div className="ppSection">
              <label className="ppLabel">Inputs</label>
              <input
                type="text"
                placeholder="Data types, files, etc."
                value={inputs}
                onChange={(e) => {
                  setInputs(e.target.value);
                  selected.setProp?.("inputs", e.target.value);
                }}
                className="ppInput"
              />
            </div>
            <div className="ppSection">
              <label className="ppLabel">Outputs</label>
              <input
                type="text"
                placeholder="Results, predictions, etc."
                value={outputs}
                onChange={(e) => {
                  setOutputs(e.target.value);
                  selected.setProp?.("outputs", e.target.value);
                }}
                className="ppInput"
              />
            </div>

            {["aiService", "aiApplication", "aiProcess"].includes(
              selected.wamType ?? "",
            ) && (
              <>
                <div className="ppSection">
                  <label className="ppLabel">Model & AI Functionality</label>
                  <select
                    value={functionality}
                    onChange={(e) => {
                      setFunctionality(e.target.value);
                      selected.setProp?.("functionality", e.target.value);
                    }}
                    className="ppSelect"
                    style={{ marginBottom: "8px" }}
                  >
                    <option value="Inference">Inference</option>
                    <option value="Training">Training</option>
                    <option value="Fine-tuning">Fine-tuning</option>
                    <option value="RAG">RAG</option>
                    <option value="Generation">Generation</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Model Name (e.g. GPT-4)"
                    value={modelName}
                    onChange={(e) => {
                      setModelName(e.target.value);
                      selected.setProp?.("modelName", e.target.value);
                    }}
                    className="ppInput"
                  />
                </div>
                <div className="ppSection">
                  <label className="ppLabel">Dataset / Data Source Used</label>
                  <input
                    type="text"
                    placeholder="Training or inference data source"
                    value={dataset}
                    onChange={(e) => {
                      setDataset(e.target.value);
                      selected.setProp?.("dataset", e.target.value);
                    }}
                    className="ppInput"
                  />
                </div>
                <div className="ppSection">
                  <label className="ppLabel">
                    Bias & Impact Considerations
                  </label>
                  <textarea
                    placeholder="Potential fairness issues, risks, etc."
                    value={bias}
                    onChange={(e) => {
                      setBias(e.target.value);
                      selected.setProp?.("biasConsiderations", e.target.value);
                    }}
                    className="ppInput"
                    style={{ height: "80px" }}
                  />
                </div>
              </>
            )}
          </>
        )}

      {selected.kind === "link" && (
        <>
          <div className="ppSection">
            <label className="ppLabel">Source Side</label>
            <select
              value={selected.sourceHandle ?? "sRight"}
              onChange={(e) => selected.setSourceHandle?.(e.target.value)}
              className="ppSelect"
            >
              <option value="sTop">Top</option>
              <option value="sRight">Right</option>
              <option value="sBottom">Bottom</option>
              <option value="sLeft">Left</option>
              <option value="sTL">Top-Left Corner</option>
              <option value="sTR">Top-Right Corner</option>
              <option value="sBL">Bottom-Left Corner</option>
              <option value="sBR">Bottom-Right Corner</option>
            </select>
          </div>
          <div className="ppSection">
            <label className="ppLabel">Target Side</label>
            <select
              value={selected.targetHandle ?? "tLeft"}
              onChange={(e) => selected.setTargetHandle?.(e.target.value)}
              className="ppSelect"
            >
              <option value="tTop">Top</option>
              <option value="tRight">Right</option>
              <option value="tBottom">Bottom</option>
              <option value="tLeft">Left</option>
              <option value="tTL">Top-Left Corner</option>
              <option value="tTR">Top-Right Corner</option>
              <option value="tBL">Bottom-Left Corner</option>
              <option value="tBR">Bottom-Right Corner</option>
            </select>
          </div>

          {selected.linkType === "invocation" && (
            <div className="ppSection">
              <label className="ppLabel">Protocol</label>
              <select
                value={protocol}
                onChange={(e) => {
                  const newProtocol = e.target.value;
                  setProtocol(newProtocol);
                  selected.setProp?.("protocol", newProtocol);
                  selected.setProp?.("encrypted", newProtocol === "HTTPS");
                }}
                className="ppSelect"
              >
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="SOAP">SOAP</option>
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Diagram Tab Component - SAVE TO DATABASE
function DiagramTab({
  notify,
  model,
  externalDiagram,
  onValidateBeforeSave,
  onSave,
}: {
  notify: NotifyFn;
  model: ModelSnapshot;
  externalDiagram?: any;
  onValidateBeforeSave?: () => Promise<{ valid: boolean; errors: string[] }>;
  onSave?: () => void;
}) {
  const [diagramName, setDiagramName] = useState("");
  const [diagramDescription, setDiagramDescription] = useState("");
  const [diagramType, setDiagramType] = useState("Architecture Diagram");
  const [isSaving, setIsSaving] = useState(false);
  const [tags, setTags] = useState("");
  const [savedDiagramId, setSavedDiagramId] = useState<string | null>(null);

  // Auto-populate when loading an existing diagram
  useEffect(() => {
    if (externalDiagram && externalDiagram._id) {
      setSavedDiagramId(externalDiagram._id);
      if (externalDiagram.name) setDiagramName(externalDiagram.name);
      if (externalDiagram.description)
        setDiagramDescription(externalDiagram.description);
      if (externalDiagram.type) setDiagramType(externalDiagram.type);
      if (externalDiagram.tags && Array.isArray(externalDiagram.tags)) {
        setTags(externalDiagram.tags.join(", "));
      }
    } else {
      // Clear if a new blank diagram is loaded
      setSavedDiagramId(null);
      setDiagramName("");
      setDiagramDescription("");
      setTags("");
    }
  }, [externalDiagram]);

  /** Build AiDiagram-shape JSON from the current canvas model */
  function buildAiDiagramJSON(m: ModelSnapshot) {
    const nodes = (m.nodes ?? [])
      .filter((n: any) => n?.type === "wam")
      .map((n: any) => ({
        id: n.id,
        type: n.data?.wamType ?? "application",
        label: n.data?.label ?? "",
        name: n.data?.label ?? "",
        description: n.data?.description ?? "",
        props: n.data?.props ?? {},
        position: n.position ?? { x: 0, y: 0 },
      }));

    const edges = (m.edges ?? []).map((e: any) => ({
      id: e.id,
      type: e.data?.linkType ?? "legacy",
      from: e.source,
      to: e.target,
      description: e.data?.description ?? "",
      props: e.data?.props ?? {},
    }));

    return { nodes, edges };
  }

  const handleSaveToDatabase = async () => {
    if (!diagramName || !diagramName.trim()) {
      notify("Please enter a diagram name", "error");
      return;
    }

    if (!model || !model.nodes || model.nodes.length === 0) {
      notify("Please add elements to the canvas first", "error");
      return;
    }

    setIsSaving(true);
    try {
      // Run validation first
      if (onValidateBeforeSave) {
        notify("Validating diagram...", "success");
        const result = await onValidateBeforeSave();
        if (!result.valid) {
          notify(
            `Validation failed with ${result.errors.length} issue(s). Fix errors before saving.`,
            "error",
          );
          setIsSaving(false);
          return;
        }
      }

      const diagramData = buildAiDiagramJSON(model);
      const tagArray = tags
        .split(",")
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);

      // Generate thumbnail from canvas viewport
      let thumbnail = "";
      try {
        const viewport = document.querySelector(
          ".react-flow__viewport",
        ) as HTMLElement | null;
        if (viewport) {
          thumbnail = await toPng(viewport, {
            pixelRatio: 0.5,
            backgroundColor: "#ffffff",
            quality: 0.7,
          });
        }
      } catch (err) {
        console.warn("Thumbnail generation failed:", err);
      }

      const payload = {
        name: diagramName.trim(),
        description: diagramDescription.trim(),
        type: diagramType,
        tags: tagArray,
        diagramData,
        thumbnail,
      };

      const API_BASE = import.meta.env.VITE_API_BASE_URL;
      const token = localStorage.getItem("auth-token");

      const isUpdate = !!savedDiagramId;
      const url = isUpdate
        ? `${API_BASE}/api/diagrams/${savedDiagramId}`
        : `${API_BASE}/api/save-diagram`;
      const method = isUpdate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "auth-token": token || "",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        notify("A diagram with this name already exists", "error");
        setIsSaving(false);
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save diagram");
      }

      const result = await response.json();
      console.log("Diagram saved:", result);

      if (!isUpdate && result.diagram?._id) {
        setSavedDiagramId(result.diagram._id);
      }

      notify(
        `✅ "${diagramName.trim()}" ${isUpdate ? "updated" : "saved"} with ${diagramData.nodes.length} elements!`,
        "success",
      );
      onSave?.();
    } catch (error) {
      console.error("Save error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      notify(`${errorMessage}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="ppSection">
        <div style={{ marginTop: "12px" }}>
          <label className="ppLabel">Diagram Name *</label>
          <input
            type="text"
            placeholder="Enter diagram name"
            value={diagramName}
            onChange={(e) => setDiagramName(e.target.value)}
            className="ppInput"
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label className="ppLabel">Description</label>
          <textarea
            placeholder="Describe your diagram"
            value={diagramDescription}
            onChange={(e) => setDiagramDescription(e.target.value)}
            className="ppInput"
            style={{ height: "60px", resize: "none" }}
          />
        </div>

        <div style={{ marginTop: "12px" }}>
          <label className="ppLabel">Diagram Type</label>
          <select
            value={diagramType}
            onChange={(e) => setDiagramType(e.target.value)}
            className="ppSelect"
          >
            <option>Architecture Diagram</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleSaveToDatabase}
        className="ppBtn primary ppSaveImageBtn"
        style={{ width: "100%", marginTop: "12px" }}
        disabled={isSaving || !diagramName.trim()}
        title={
          !diagramName.trim()
            ? "Please enter a diagram name"
            : "Save diagram to database"
        }
      >
        {isSaving
          ? "Saving.."
          : savedDiagramId
            ? "Update Diagram"
            : "Save to My Diagrams"}
      </button>

      {model && model.nodes && (
        <div className="ppHint" style={{ marginTop: "12px" }}>
          Canvas: {model.nodes.length} element(s), {model.edges?.length || 0}{" "}
          connection(s)
        </div>
      )}
    </div>
  );
}

// Export Tab Component (same behavior, replaces alert with notify)
function ExportTab({
  model,
  notify,
  onImport,
}: {
  model: ModelSnapshot;
  notify: NotifyFn;
  onImport?: (diagram: any) => void;
}) {
  const { user } = useAuth();
  const [exportFormat, setExportFormat] = useState("json");
  const [filename, setFilename] = useState("diagram");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFreePlan = user?.subscription?.plan === "developer";
  const restrictedFormats = ["csv", "xml", "turtle", "json-ld"];

  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      notify("Please select a valid JSON file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        // Basic validation for diagram json structure
        if (
          parsed &&
          Array.isArray(parsed.nodes) &&
          Array.isArray(parsed.edges)
        ) {
          if (onImport) {
            onImport(parsed);
            notify("Diagram imported successfully!", "success");
          } else {
            notify("Import is not supported in this view.", "error");
          }
        } else {
          notify("Invalid diagram JSON structure format.", "error");
        }
      } catch (err) {
        console.error("JSON parsing error:", err);
        notify("Failed to parse JSON file.", "error");
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be selected again
    event.target.value = "";
  };

  const handleExport = () => {
    if (isFreePlan && restrictedFormats.includes(exportFormat)) {
      notify(
        "This format is only available in Standard and Premium plans.",
        "error",
      );
      return;
    }
    try {
      let dataStr = "";
      let downloadFilename = "";
      let mimeType = "text/plain";

      if (exportFormat === "json") {
        const exportData = buildExportJSON(model);
        dataStr = JSON.stringify(exportData, null, 2);
        downloadFilename = `${filename}.json`;
        mimeType = "application/json";

        downloadText(downloadFilename, dataStr, mimeType);
        notify(`File exported as ${downloadFilename}`, "success");
        return;
      }

      if (exportFormat === "csv") {
        let csvContent = "Node ID,Type,Label,Description\n";
        model.nodes
          .filter((n) => n?.type === "wam")
          .forEach((n) => {
            csvContent += `"${n.id}","${n.data?.wamType || ""}","${n.data?.label || ""}","${
              n.data?.description || ""
            }"\n`;
          });
        csvContent += "\nEdge ID,Type,From,To,Description\n";
        model.edges.forEach((e) => {
          csvContent += `"${e.id}","${e.data?.linkType || ""}","${e.source}","${e.target}","${
            e.data?.description || ""
          }"\n`;
        });

        dataStr = csvContent;
        downloadFilename = `${filename}.csv`;
        mimeType = "text/csv";

        downloadText(downloadFilename, dataStr, mimeType);
        notify(`File exported as ${downloadFilename}`, "success");
        return;
      }

      if (exportFormat === "xml") {
        const xmlData = buildExportJSON(model);
        let xmlStr = '<?xml version="1.0" encoding="UTF-8"?>\n<diagram>\n';
        xmlStr += `  <filename>${filename}</filename>\n`;
        xmlStr += `  <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
        xmlStr += `  <nodes count="${xmlData.nodes.length}">\n`;
        xmlData.nodes.forEach((n: any) => {
          xmlStr += `    <node id="${n.id}" type="${n.type}" label="${n.label}" />\n`;
        });
        xmlStr += "  </nodes>\n";
        xmlStr += `  <edges count="${xmlData.edges.length}">\n`;
        xmlData.edges.forEach((e: any) => {
          xmlStr += `    <edge id="${e.id}" from="${e.from}" to="${e.to}" type="${e.type}" />\n`;
        });
        xmlStr += "  </edges>\n</diagram>";

        dataStr = xmlStr;
        downloadFilename = `${filename}.xml`;
        mimeType = "application/xml";

        downloadText(downloadFilename, dataStr, mimeType);
        notify(`File exported as ${downloadFilename}`, "success");
        return;
      }

      if (exportFormat === "turtle") {
        dataStr = buildExportTurtle(model);
        downloadFilename = `${filename}.ttl`;
        mimeType = "text/turtle";

        downloadText(downloadFilename, dataStr, mimeType);
        notify(`File exported as ${downloadFilename}`, "success");
        return;
      }

      if (exportFormat === "json-ld") {
        const exportData = buildExportJSONLD(model);
        dataStr = JSON.stringify(exportData, null, 2);
        downloadFilename = `${filename}.jsonld`;
        mimeType = "application/ld+json";

        downloadText(downloadFilename, dataStr, mimeType);
        notify(`File exported as ${downloadFilename}`, "success");
        return;
      }

      if (exportFormat === "png") {
        const viewport = document.querySelector(
          ".react-flow__viewport",
        ) as HTMLElement | null;

        if (!viewport) {
          notify("Diagram viewport not found", "error");
          return;
        }

        toPng(viewport, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        })
          .then((dataUrl) => {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `${filename}.png`;
            a.click();
            notify(`PNG exported as ${filename}.png`, "success");
          })
          .catch((err) => {
            console.error("PNG export failed:", err);
            notify("Failed to export PNG", "error");
          });

        return;
      }
    } catch (error) {
      console.error("Export error:", error);
      notify("Error during export", "error");
    }
  };

  return (
    <div>
      <div className="ppSection">
        <label className="ppLabel">Format</label>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value)}
          className="ppSelect"
        >
          <option value="json">JSON</option>
          <option value="csv" disabled={isFreePlan}>
            CSV {isFreePlan ? "🔒" : ""}
          </option>
          <option value="xml" disabled={isFreePlan}>
            XML {isFreePlan ? "🔒" : ""}
          </option>
          <option value="turtle" disabled={isFreePlan}>
            Turtle/N3 {isFreePlan ? "🔒" : ""}
          </option>
          <option value="json-ld" disabled={isFreePlan}>
            JSON-LD {isFreePlan ? "🔒" : ""}
          </option>
          <option value="png">PNG</option>
        </select>
        {isFreePlan && (
          <div
            className="ppHint"
            style={{ marginTop: "6px", color: "#a855f7" }}
          >
            🔒 Upgrade to unlock advanced formats.
          </div>
        )}
      </div>

      <div className="ppSection">
        <label className="ppLabel">Filename</label>
        <input
          type="text"
          placeholder="Enter filename"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          className="ppInput"
        />
      </div>

      <button
        onClick={handleExport}
        className="ppBtn primary"
        style={{ width: "100%" }}
      >
        ⬇ Export
      </button>

      <div style={{ marginTop: "24px" }}>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleImport}
        />
        <button
          onClick={triggerImport}
          className="ppBtn secondary"
          style={{ width: "100%", background: "#f3f4f6", color: "#374151" }}
        >
          ⬆ Import JSON
        </button>
      </div>

      <div
        className="ppHint"
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "rgba(108, 77, 255, 0.1)",
        }}
      >
        <strong>Formats:</strong>
        <ul style={{ marginTop: "8px", paddingLeft: "16px", fontSize: "12px" }}>
          <li>
            <strong>JSON</strong> - Full diagram data with all nodes & edges
          </li>
          <li>
            <strong>CSV</strong> - Spreadsheet format (nodes and edges tables)
          </li>
          <li>
            <strong>XML</strong> - Structured hierarchical format
          </li>
          <li>
            <strong>Turtle/N3</strong> - RDF format for semantic web
          </li>
          <li>
            <strong>JSON-LD</strong> - Linked data JSON format
          </li>
          <li>
            <strong>PNG</strong> - Visual diagram screenshot
          </li>
        </ul>
      </div>
    </div>
  );
}

// Main Component
export default function PropertyMngPanel({
  selected,
  model,
  externalDiagram,
  onValidateBeforeSave,
  onImport,
  onSave,
}: PropertyMngPanelProps) {
  const [activeTab, setActiveTab] = useState<"element" | "diagram" | "export">(
    "element",
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const notify: NotifyFn = (message, type = "success") => {
    if (type === "error") {
      toast.error(message);
    } else {
      toast.success(message);
    }
  };

  return (
    <div ref={panelRef} className="ppContainer">
      <div className="ppContent">
        <h2 className="ppTitle">Properties</h2>

        <div className="ppTabs">
          <button
            className={`ppTab ${activeTab === "element" ? "active" : ""}`}
            onClick={() => setActiveTab("element")}
          >
            Element
          </button>
          <button
            className={`ppTab ${activeTab === "diagram" ? "active" : ""}`}
            onClick={() => setActiveTab("diagram")}
          >
            Save
          </button>
          <button
            className={`ppTab ${activeTab === "export" ? "active" : ""}`}
            onClick={() => setActiveTab("export")}
          >
            Export
          </button>
        </div>

        {activeTab === "element" && <ElementTab selected={selected} />}
        {activeTab === "diagram" && (
          <DiagramTab
            notify={notify}
            model={model}
            externalDiagram={externalDiagram}
            onValidateBeforeSave={onValidateBeforeSave}
            onSave={onSave}
          />
        )}
        {activeTab === "export" && (
          <ExportTab model={model} notify={notify} onImport={onImport} />
        )}
      </div>
    </div>
  );
}
