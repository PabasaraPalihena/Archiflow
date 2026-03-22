import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "./PublishToConfluenceModal.css";
import confluenceIcon from "../../assets/confluence.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
}

interface PublishToConfluenceModalProps {
  open: boolean;
  onClose: () => void;
  diagramData?: {
    nodes: any[];
    edges: any[];
    imageData?: string;
  } | null;
}

export default function PublishToConfluenceModal({
  open,
  onClose,
  diagramData,
}: PublishToConfluenceModalProps) {
  const { token } = useAuth();

  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageDescription, setPageDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    url?: string;
    title?: string;
  } | null>(null);

  const hasInitialized = useRef(false);

  // Pre-fill title and description when modal first opens
  useEffect(() => {
    if (open && diagramData && !hasInitialized.current) {
      hasInitialized.current = true;
      setPageTitle(`Architecture Diagram — ${new Date().toLocaleDateString()}`);
      setPageDescription("");
      setResult(null);
    }
    if (!open) {
      hasInitialized.current = false;
    }
  }, [open, diagramData]);

  // Fetch spaces when modal opens
  const fetchSpaces = useCallback(async () => {
    if (!token) return;
    setLoadingSpaces(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/integrations/confluence/spaces`,
        {
          headers: { "auth-token": token },
        },
      );
      const data = await res.json();
      setSpaces(data.spaces || []);
    } catch (error) {
      console.error("Failed to fetch spaces:", error);
    } finally {
      setLoadingSpaces(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      fetchSpaces();
      setSelectedSpace("");
    }
  }, [open, fetchSpaces]);

  const handleSubmit = async () => {
    if (!token || !selectedSpace || !pageTitle) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/integrations/confluence/pages`, {
        method: "POST",
        headers: {
          "auth-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spaceId: selectedSpace,
          title: pageTitle,
          description: pageDescription,
          imageData: diagramData?.imageData,
          diagramData: diagramData
            ? {
                nodes: diagramData.nodes.map((n) => ({
                  id: n.id,
                  label: n.data?.label,
                  type: n.data?.wamType,
                  description: n.data?.description,
                })),
                edges: diagramData.edges.map((e) => ({
                  id: e.id,
                  from: e.source,
                  to: e.target,
                  label: e.label,
                  type: e.data?.linkType,
                })),
              }
            : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Page "${data.page.title}" created successfully!`);
        setResult({
          success: true,
          message: `Page "${data.page.title}" created successfully!`,
          url: data.page.url,
          title: data.page.title,
        });
      } else {
        toast.error(data.error || "Failed to create page.");
        setResult({
          success: false,
          message: data.error || "Failed to create page.",
        });
      }
    } catch (error) {
      console.error("Create page error:", error);
      toast.error("Failed to create Confluence page. Please try again.");
      setResult({
        success: false,
        message: "Failed to create Confluence page. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="confluence-modal-overlay" onClick={onClose}>
      <div className="confluence-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="confluence-modal-header">
          <div className="confluence-modal-header-left">
            <div className="confluence-modal-icon">
              <img
                src={confluenceIcon}
                alt="Confluence"
                width={20}
                height={20}
              />
            </div>
            <h2>Publish to Confluence</h2>
          </div>
          <button className="confluence-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Result banner */}
        {result && (
          <div
            className={`confluence-modal-result ${result.success ? "success" : "error"}`}
          >
            {result.success ? "✅" : "⚠️"} {result.message}
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="confluence-page-link"
              >
                Open in Confluence →
              </a>
            )}
          </div>
        )}

        {/* Form */}
        <div className="confluence-modal-body">
          {/* Space */}
          <div className="confluence-field">
            <label>Space *</label>
            {loadingSpaces ? (
              <div className="confluence-field-loading">Loading spaces...</div>
            ) : (
              <select
                value={selectedSpace}
                onChange={(e) => setSelectedSpace(e.target.value)}
              >
                <option value="">Select a space...</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.key} — {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Page Title */}
          <div className="confluence-field">
            <label>Page Title *</label>
            <input
              type="text"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="Enter page title..."
            />
          </div>

          {/* Description */}
          <div className="confluence-field">
            <label>Description</label>
            <textarea
              value={pageDescription}
              onChange={(e) => setPageDescription(e.target.value)}
              placeholder="Add more details..."
              rows={4}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="confluence-modal-footer">
          <button className="confluence-btn-cancel" onClick={onClose}>
            {result?.success ? "Close" : "Cancel"}
          </button>
          {!result?.success && (
            <button
              className="confluence-btn-create"
              onClick={handleSubmit}
              disabled={loading || !selectedSpace || !pageTitle}
            >
              {loading ? (
                <>
                  <span className="confluence-btn-spinner" /> Publishing...
                </>
              ) : (
                "Publish Page"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
