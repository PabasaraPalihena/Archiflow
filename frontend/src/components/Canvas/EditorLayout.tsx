import { useCallback, useEffect, useRef, useState } from "react";
import WamPalette from "../Palette/WamPalette";
import MainCanvas, {
  type LinkTool,
  type SelectedItem,
  type AiDiagram,
} from "./MainCanvas";
import PropertiesPanel from "../Palette/PropertyMngPanel";
import ValidationPanel, { type ValidationResult } from "./ValidationPanel";
import { CostEstimateModal } from "../CostEstimate";
import { buildExportJSONLD } from "../../utils/exportJSONLD";
import {
  buildExportJSON,
  buildExportTurtle,
  buildExportCSV,
  buildExportXML,
} from "../../utils/exportFormats";
import PushToGitHubModal from "../Integrations/PushToGitHubModal";
import { useAuth } from "../../context/AuthContext";
import "./EditorLayout.css";

type EditorLayoutProps = {
  externalDiagram: AiDiagram | null;
  validateNonce: number; // increments ONLY when header button clicked
  costEstimateNonce: number; // increments when cost estimate button clicked
  onImport?: (diagram: AiDiagram) => void;
  onNodeCountChange?: (count: number) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

type ReactFlowModel = { nodes: any[]; edges: any[] };

function toBackendNodeType(wamType: string): string {
  switch (wamType) {
    case "securityRealm":
      return "Realm";
    case "application":
      return "Application";
    case "service":
      return "Service";
    case "identityProvider":
      return "IdentityProvider";
    case "dataProvider":
      return "DataProvider";
    case "processUnit":
      return "ProcessingUnit";
    case "aiApplication":
      return "AIApplication";
    case "aiService":
      return "AIService";
    case "aiProcess":
      return "AIProcess";
    case "dataset":
      return "Dataset";
    default:
      return "Application";
  }
}

function toBackendEdgeType(linkType: string): string {
  switch (linkType) {
    case "invocation":
      return "Invocation";
    case "trust":
      return "Trust";
    case "legacy":
    default:
      return "Legacy";
  }
}

function toWamPayload(model: ReactFlowModel) {
  const nodes = (model.nodes ?? [])
    .filter((n) => n?.type === "wam")
    .map((n) => {
      const data = n.data ?? {};
      return {
        id: String(n.id),
        type: toBackendNodeType(String(data.wamType ?? "")),
        name: String(data.label ?? n.id),
      };
    });

  const nodeById = new Map(nodes.map((n: any) => [n.id, n]));
  // ── Only keep edges whose both endpoints still exist ─────────────────────
  const nodeIds = new Set(nodes.map((n: any) => n.id));

  const edges = (model.edges ?? [])
    .filter(
      (e: any) =>
        nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)),
    )
    .map((e: any) => {
      const linkType = e?.data?.linkType ?? "legacy";
      return {
        type: toBackendEdgeType(String(linkType)),
        from: String(e.source),
        to: String(e.target),
      };
    });

  // ✅ Contains from Realm -> child using parentNode
  for (const n of model.nodes ?? []) {
    if (n?.type !== "wam") continue;
    if (!n.parentNode) continue;

    const parentBackend = nodeById.get(String(n.parentNode));
    const childBackend = nodeById.get(String(n.id));
    if (!parentBackend || !childBackend) continue;

    if (parentBackend.type === "Realm") {
      edges.push({
        type: "Contains",
        from: parentBackend.id,
        to: childBackend.id,
      });
    }
  }

  return { nodes, edges };
}

/* ─── lightweight export helpers now imported from exportFormats ─── */
export default function EditorLayout({
  externalDiagram,
  validateNonce,
  costEstimateNonce,
  onImport,
  onNodeCountChange,
  onDirtyChange,
}: EditorLayoutProps) {
  const [activeLinkTool, setActiveLinkTool] = useState<LinkTool>("legacy");
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [model, setModel] = useState<ReactFlowModel>({ nodes: [], edges: [] });

  // Track saved snapshot to detect unsaved changes
  const savedModelRef = useRef<string>("");
  const markClean = useCallback(() => {
    savedModelRef.current = JSON.stringify(model);
    onDirtyChange?.(false);
  }, [model, onDirtyChange]);

  // keep latest model without triggering validation
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
    // Notify parent about current node count
    const wamNodeCount = model.nodes.filter((n) => n?.type === "wam").length;
    onNodeCountChange?.(wamNodeCount);
    // Notify parent about dirty state
    const isDirty = JSON.stringify(model) !== savedModelRef.current;
    onDirtyChange?.(isDirty);
  }, [model, onNodeCountChange, onDirtyChange]);

  const [valOpen, setValOpen] = useState(false);
  const [valLoading, setValLoading] = useState(false);
  const [valResult, setValResult] = useState<ValidationResult | null>(null);

  // Clear stale results when the diagram changes — prevents showing old errors
  // after the user has already fixed the issue.
  useEffect(() => {
    if (valResult !== null) {
      setValResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // Cost estimate modal state
  const [costEstimateOpen, setCostEstimateOpen] = useState(false);

  // Right panel collapse state
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Left panel collapse state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // GitHub push modal state
  const [gitHubPushOpen, setGitHubPushOpen] = useState(false);

  // Subscription check
  const { user } = useAuth();
  const isPremium = user?.subscription?.plan === "enterprise";

  // Open cost estimate modal when nonce changes
  useEffect(() => {
    if (costEstimateNonce > 0) {
      setCostEstimateOpen(true);
    }
  }, [costEstimateNonce]);

  // Function to get current diagram as JSON-LD
  const getDiagramJSONLD = useCallback(() => {
    return buildExportJSONLD(modelRef.current);
  }, []);

  // run validation ONLY when validateNonce changes (header click)
  useEffect(() => {
    if (!validateNonce) return;

    let cancelled = false;

    async function run() {
      setValOpen(true);
      setValLoading(true);
      setValResult(null);

      const payload = toWamPayload(modelRef.current);

      try {
        const res = await fetch("/api/wam/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await res.json()) as ValidationResult;
        if (!cancelled) setValResult(data);
      } catch {
        if (!cancelled) {
          setValResult({
            valid: false,
            errors: ["Validation request failed. Check backend + proxy."],
          });
        }
      } finally {
        if (!cancelled) setValLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [validateNonce]);

  // Validate-before-save: runs validation and returns the result
  // If invalid, opens the ValidationPanel with errors
  const validateBeforeSave = useCallback(async (): Promise<{
    valid: boolean;
    errors: string[];
  }> => {
    const payload = toWamPayload(modelRef.current);

    try {
      const res = await fetch("/api/wam/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ValidationResult;

      if (!data.valid) {
        // Open validation panel with errors
        setValResult(data);
        setValOpen(true);
      }

      return data;
    } catch {
      const fallback = {
        valid: false,
        errors: ["Validation request failed. Check backend + proxy."],
      };
      setValResult(fallback);
      setValOpen(true);
      return fallback;
    }
  }, []);

  return (
    <div
      className={`editorShell ${!rightPanelOpen ? "rightCollapsed" : ""} ${!leftPanelOpen ? "leftCollapsed" : ""}`}
    >
      <aside className={`leftPanel ${!leftPanelOpen ? "collapsed" : ""}`}>
        <button
          className="lpToggle"
          onClick={() => setLeftPanelOpen((prev) => !prev)}
          title={leftPanelOpen ? "Collapse palette" : "Expand palette"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {leftPanelOpen ? (
              <polyline points="15 18 9 12 15 6" />
            ) : (
              <polyline points="9 18 15 12 9 6" />
            )}
          </svg>
        </button>
        {leftPanelOpen && <WamPalette />}
      </aside>

      <main className="centerCanvas">
        <MainCanvas
          activeLinkTool={activeLinkTool}
          onActivateLinkTool={setActiveLinkTool}
          onSelectionChange={setSelected}
          onModelChange={setModel}
          externalDiagram={externalDiagram}
          onGitHubPush={isPremium ? () => setGitHubPushOpen(true) : undefined}
        />
      </main>

      <aside className={`rightPanel ${!rightPanelOpen ? "collapsed" : ""}`}>
        <button
          className="rpToggle"
          onClick={() => setRightPanelOpen((prev) => !prev)}
          title={rightPanelOpen ? "Collapse panel" : "Expand panel"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {rightPanelOpen ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
        {rightPanelOpen && (
          <PropertiesPanel
            selected={selected}
            model={model}
            externalDiagram={externalDiagram}
            onValidateBeforeSave={validateBeforeSave}
            onImport={onImport}
            onSave={markClean}
          />
        )}
      </aside>

      <ValidationPanel
        open={valOpen}
        onClose={() => setValOpen(false)}
        result={valResult}
        loading={valLoading}
      />

      <CostEstimateModal
        isOpen={costEstimateOpen}
        onClose={() => setCostEstimateOpen(false)}
        getDiagramJSONLD={getDiagramJSONLD}
      />

      <PushToGitHubModal
        open={gitHubPushOpen}
        onClose={() => setGitHubPushOpen(false)}
        model={model}
        diagramName="ArchiFlow Diagram"
        exportJSON={buildExportJSON}
        exportCSV={buildExportCSV}
        exportXML={buildExportXML}
        exportTurtle={buildExportTurtle}
        exportJSONLD={buildExportJSONLD}
      />
    </div>
  );
}
