import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "./PushToGitHubModal.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  url: string;
  defaultBranch: string;
}

interface GitHubBranch {
  name: string;
  protected: boolean;
}

type ExportFormat = "json" | "csv" | "xml" | "turtle" | "jsonld";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; ext: string }[] = [
  { value: "json", label: "JSON (WAM Export)", ext: ".json" },
  { value: "csv", label: "CSV (Spreadsheet)", ext: ".csv" },
  { value: "xml", label: "XML", ext: ".xml" },
  { value: "turtle", label: "Turtle (RDF/TTL)", ext: ".ttl" },
  { value: "jsonld", label: "JSON-LD", ext: ".jsonld" },
];

interface PushToGitHubModalProps {
  open: boolean;
  onClose: () => void;
  model: { nodes: any[]; edges: any[] };
  diagramName?: string;
  exportJSON: (m: { nodes: any[]; edges: any[] }) => any;
  exportCSV: (m: { nodes: any[]; edges: any[] }) => string;
  exportXML: (m: { nodes: any[]; edges: any[] }) => string;
  exportTurtle: (m: { nodes: any[]; edges: any[] }) => string;
  exportJSONLD: (m: { nodes: any[]; edges: any[] }) => any;
}

export default function PushToGitHubModal({
  open,
  onClose,
  model,
  diagramName,
  exportJSON,
  exportCSV,
  exportXML,
  exportTurtle,
  exportJSONLD,
}: PushToGitHubModalProps) {
  const { token } = useAuth();

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [filePath, setFilePath] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [format, setFormat] = useState<ExportFormat>("json");
  const [loading, setLoading] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    url?: string;
    commitUrl?: string;
  } | null>(null);

  // Searchable repo dropdown state
  const [repoSearch, setRepoSearch] = useState("");
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  const hasInitialized = useRef(false);

  // Pre-fill file path from diagram name
  useEffect(() => {
    if (open && !hasInitialized.current) {
      hasInitialized.current = true;
      const name = diagramName || "architecture-diagram";
      const safeName = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
      const ext =
        FORMAT_OPTIONS.find((f) => f.value === format)?.ext || ".json";
      setFilePath(`diagrams/${safeName}${ext}`);
      setCommitMessage("");
      setResult(null);
    }
    if (!open) {
      hasInitialized.current = false;
    }
  }, [open, diagramName, format]);

  // Update file extension when format changes
  const handleFormatChange = (newFormat: ExportFormat) => {
    setFormat(newFormat);
    const oldExt = FORMAT_OPTIONS.find((f) => f.value === format)?.ext || "";
    const newExt = FORMAT_OPTIONS.find((f) => f.value === newFormat)?.ext || "";
    if (oldExt && filePath.endsWith(oldExt)) {
      setFilePath(filePath.slice(0, -oldExt.length) + newExt);
    }
  };

  // Fetch repos when modal opens
  const fetchRepos = useCallback(async () => {
    if (!token) return;
    setLoadingRepos(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/repos`, {
        headers: { "auth-token": token },
      });
      const data = await res.json();
      setRepos(data.repos || []);
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    } finally {
      setLoadingRepos(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      fetchRepos();
      setSelectedRepo("");
      setSelectedBranch("");
      setBranches([]);
      setRepoSearch("");
      setRepoDropdownOpen(false);
    }
  }, [open, fetchRepos]);

  // Close repo dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        repoDropdownRef.current &&
        !repoDropdownRef.current.contains(e.target as HTMLElement)
      ) {
        setRepoDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredRepos = repos.filter(
    (r) =>
      r.fullName.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(repoSearch.toLowerCase()),
  );

  // Fetch branches when repo is selected
  const fetchBranches = useCallback(
    async (fullName: string) => {
      if (!token || !fullName) return;
      setLoadingBranches(true);
      try {
        const [owner, repo] = fullName.split("/");
        const res = await fetch(
          `${API_BASE}/api/integrations/github/repos/${owner}/${repo}/branches`,
          { headers: { "auth-token": token } },
        );
        const data = await res.json();
        setBranches(data.branches || []);

        // Auto-select default branch
        const selectedRepoObj = repos.find((r) => r.fullName === fullName);
        if (selectedRepoObj) {
          setSelectedBranch(selectedRepoObj.defaultBranch);
        } else if (data.branches?.length > 0) {
          setSelectedBranch(data.branches[0].name);
        }
      } catch (error) {
        console.error("Failed to fetch branches:", error);
      } finally {
        setLoadingBranches(false);
      }
    },
    [token, repos],
  );

  const handleRepoSelect = (repo: GitHubRepo) => {
    setSelectedRepo(repo.fullName);
    setRepoSearch(repo.fullName);
    setRepoDropdownOpen(false);
    setSelectedBranch("");
    setBranches([]);
    fetchBranches(repo.fullName);
  };

  const handleSubmit = async () => {
    if (!token || !selectedRepo || !filePath) return;

    setLoading(true);
    setResult(null);

    const [owner, repo] = selectedRepo.split("/");

    // Generate content based on selected format
    let content: string;
    try {
      if (format === "csv") {
        content = exportCSV(model);
      } else if (format === "xml") {
        content = exportXML(model);
      } else if (format === "turtle") {
        content = exportTurtle(model);
      } else if (format === "jsonld") {
        content = JSON.stringify(exportJSONLD(model), null, 2);
      } else {
        content = JSON.stringify(exportJSON(model), null, 2);
      }
    } catch (err) {
      toast.error("Failed to export diagram data.");
      setResult({ success: false, message: "Failed to export diagram data." });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/push`, {
        method: "POST",
        headers: {
          "auth-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner,
          repo,
          branch: selectedBranch || undefined,
          path: filePath,
          content,
          commitMessage: commitMessage || `Update ${filePath} from ArchiFlow`,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Pushed to ${selectedRepo}/${filePath}`);
        setResult({
          success: true,
          message: `Pushed to ${selectedRepo}/${filePath}`,
          url: data.file.url,
          commitUrl: data.file.commitUrl,
        });
      } else {
        toast.error(data.error || data.details || "Failed to push.");
        setResult({
          success: false,
          message: data.error || data.details || "Failed to push.",
        });
      }
    } catch (error) {
      console.error("Push error:", error);
      toast.error("Failed to push to GitHub. Please try again.");
      setResult({
        success: false,
        message: "Failed to push to GitHub. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const nodeCount =
    model?.nodes?.filter((n: any) => n?.type === "wam")?.length ?? 0;
  const edgeCount = model?.edges?.length ?? 0;

  return (
    <div className="gh-push-overlay" onClick={onClose}>
      <div className="gh-push-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="gh-push-header">
          <div className="gh-push-header-left">
            <div className="gh-push-icon">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                width="20"
                height="20"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <h2>Push to GitHub</h2>
          </div>
          <button className="gh-push-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Result banner */}
        {result && (
          <div
            className={`gh-push-result ${result.success ? "success" : "error"}`}
          >
            <span>
              {result.success ? "✅" : "⚠️"} {result.message}
            </span>
            {result.success && (
              <div className="gh-push-result-links">
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View File →
                  </a>
                )}
                {result.commitUrl && (
                  <a
                    href={result.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Commit →
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Diagram preview chip */}
        <div className="gh-push-chip">
          <span className="chip-label">Diagram:</span>
          <span className="chip-stat">{nodeCount} nodes</span>
          <span className="chip-stat">{edgeCount} edges</span>
          <span className="chip-size">
            {FORMAT_OPTIONS.find((f) => f.value === format)?.label || "JSON"}
          </span>
        </div>

        {/* Form */}
        <div className="gh-push-body">
          {/* Repository — searchable */}
          <div className="gh-field" ref={repoDropdownRef}>
            <label>Repository *</label>
            {loadingRepos ? (
              <div className="gh-field-loading">Loading repositories...</div>
            ) : (
              <div className="gh-repo-search-wrap">
                <input
                  type="text"
                  value={repoSearch}
                  onChange={(e) => {
                    setRepoSearch(e.target.value);
                    setRepoDropdownOpen(true);
                    if (!e.target.value) {
                      setSelectedRepo("");
                      setSelectedBranch("");
                      setBranches([]);
                    }
                  }}
                  onFocus={() => setRepoDropdownOpen(true)}
                  placeholder="Search repositories..."
                  autoComplete="off"
                />
                {repoDropdownOpen && (
                  <ul className="gh-repo-dropdown">
                    {filteredRepos.length === 0 ? (
                      <li className="gh-repo-empty">No repositories found</li>
                    ) : (
                      filteredRepos.map((r) => (
                        <li
                          key={r.id}
                          className={`gh-repo-item ${
                            selectedRepo === r.fullName ? "selected" : ""
                          }`}
                          onClick={() => handleRepoSelect(r)}
                        >
                          <span className="gh-repo-name">
                            {r.private ? "🔒 " : ""}
                            {r.fullName}
                          </span>
                          {r.description && (
                            <span className="gh-repo-desc">
                              {r.description}
                            </span>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Branch */}
          {selectedRepo && (
            <div className="gh-field">
              <label>Branch</label>
              {loadingBranches ? (
                <div className="gh-field-loading">Loading branches...</div>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} {b.protected ? "🔒" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Export Format */}
          <div className="gh-field">
            <label>Export Format *</label>
            <select
              value={format}
              onChange={(e) =>
                handleFormatChange(e.target.value as ExportFormat)
              }
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* File Path */}
          <div className="gh-field">
            <label>File Path *</label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="diagrams/my-architecture.json"
            />
          </div>

          {/* Commit Message */}
          <div className="gh-field">
            <label>Commit Message</label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="e.g. your commit message"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="gh-push-footer">
          <button className="gh-btn-cancel" onClick={onClose}>
            {result?.success ? "Close" : "Cancel"}
          </button>
          {!result?.success && (
            <button
              className="gh-btn-push"
              onClick={handleSubmit}
              disabled={loading || !selectedRepo || !filePath}
            >
              {loading ? (
                <>
                  <span className="gh-btn-spinner" /> Pushing...
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="currentColor"
                  >
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.78 4.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 011.06-1.06L7 7.94l3.72-3.72a.75.75 0 011.06 0z" />
                  </svg>
                  Push to Repository
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
