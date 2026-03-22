import { MousePointer2, Hand, Undo2, Redo2, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./CanvasToolbar.css";
import confluenceIcon from "../../assets/confluence.png";

interface CanvasToolbarProps {
  mode: "select" | "pan";
  setMode: (mode: "select" | "pan") => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onGitHubPush?: () => void;
  onConfluencePublish?: () => void;
}

export function CanvasToolbar({
  mode,
  setMode,
  onUndo,
  onRedo,
  onDelete,
  canUndo,
  canRedo,
  onGitHubPush,
  onConfluencePublish,
}: CanvasToolbarProps) {
  const { user } = useAuth();
  const plan = user?.subscription?.plan || "developer";
  const showConfluence =
    onConfluencePublish && plan !== "developer" && plan !== "professional";
  return (
    <div className="canvas-toolbar">
      <button
        className={`toolbar-btn ${mode === "select" ? "active" : ""}`}
        onClick={() => setMode("select")}
        title="Select Mode"
      >
        <MousePointer2 size={18} />
      </button>
      <button
        className={`toolbar-btn ${mode === "pan" ? "active" : ""}`}
        onClick={() => setMode("pan")}
        title="Pan Mode"
      >
        <Hand size={18} />
      </button>

      <div className="toolbar-divider" />

      <button
        className="toolbar-btn"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
      >
        <Undo2 size={18} />
      </button>
      <button
        className="toolbar-btn"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
      >
        <Redo2 size={18} />
      </button>

      <div className="toolbar-divider" />

      <button
        className="toolbar-btn danger"
        onClick={onDelete}
        title="Delete Selected"
      >
        <Trash2 size={18} />
      </button>

      {onGitHubPush && (
        <>
          <div className="toolbar-divider" />
          <button
            className="toolbar-btn"
            onClick={onGitHubPush}
            title="Push to GitHub"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </button>
        </>
      )}
      {showConfluence && (
        <>
          <div className="toolbar-divider" />
          <button
            className="toolbar-btn"
            onClick={onConfluencePublish}
            title="Publish to Confluence"
          >
            <img src={confluenceIcon} alt="Confluence" width={18} height={18} />
          </button>
        </>
      )}
    </div>
  );
}
