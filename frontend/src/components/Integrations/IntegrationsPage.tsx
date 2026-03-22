import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "./IntegrationsPage.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

interface ConfluenceStatus {
  connected: boolean;
  siteUrl?: string;
  connectedAt?: string;
  message?: string;
}

interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
}

interface ConfluencePage {
  id: string;
  title: string;
  status: string;
  spaceId: string;
  _links?: { webui?: string };
}

interface GitHubStatus {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  connectedAt?: string;
  message?: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  url: string;
  defaultBranch: string;
  updatedAt: string;
}

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const toastShown = useRef(false);

  // State
  const [confluenceStatus, setConfluenceStatus] =
    useState<ConfluenceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Confluence Spaces & Pages
  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>("");
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // GitHub State
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [connectingGithub, setConnectingGithub] = useState(false);

  // Check for callback messages
  useEffect(() => {
    const confluenceParam = searchParams.get("confluence");
    const githubParam = searchParams.get("github");
    const errorParam = searchParams.get("error");

    if (toastShown.current) return;

    if (confluenceParam === "connected") {
      toast.success("Confluence connected successfully!");
      toastShown.current = true;
      navigate("/integrations", { replace: true });
    } else if (githubParam === "connected") {
      toast.success("GitHub connected successfully!");
      toastShown.current = true;
      navigate("/integrations", { replace: true });
    } else if (errorParam) {
      const errorMessages: Record<string, string> = {
        no_confluence_sites: "No Confluence sites found for your account.",
        callback_failed: "Failed to connect. Please try again.",
        missing_params: "Invalid callback. Please try again.",
        no_token: "Failed to get access token. Please try again.",
      };
      toast.error(
        errorMessages[errorParam] || "Connection failed. Please try again.",
      );
      toastShown.current = true;
      navigate("/integrations", { replace: true });
    }
  }, [searchParams, navigate]);

  // Fetch Confluence status
  const fetchConfluenceStatus = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/integrations/confluence/status`,
        {
          headers: { "auth-token": token },
        },
      );
      const data = await res.json();
      setConfluenceStatus(data);

      if (data.connected) {
        fetchSpaces();
      }
    } catch (error) {
      console.error("Failed to fetch Confluence status:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfluenceStatus();
  }, [fetchConfluenceStatus]);

  // Fetch Confluence spaces
  const fetchSpaces = async () => {
    if (!token) return;

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
    }
  };

  // Fetch pages for selected space
  const fetchPages = async (spaceId: string) => {
    if (!token || !spaceId) return;

    setLoadingPages(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/integrations/confluence/spaces/${spaceId}/pages`,
        { headers: { "auth-token": token } },
      );
      const data = await res.json();
      setPages(data.pages || []);
    } catch (error) {
      console.error("Failed to fetch pages:", error);
    } finally {
      setLoadingPages(false);
    }
  };

  // Connect to Confluence
  const handleConnectConfluence = async () => {
    if (!token) return;

    setConnecting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/integrations/confluence/auth-url`,
        {
          headers: { "auth-token": token },
        },
      );
      const data = await res.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error(data.error || "Failed to start Confluence connection.");
        setConnecting(false);
      }
    } catch (error) {
      console.error("Connect error:", error);
      toast.error("Failed to connect to Confluence.");
      setConnecting(false);
    }
  };

  // Disconnect Confluence
  const handleDisconnectConfluence = async () => {
    if (!token) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/integrations/confluence/disconnect`,
        {
          method: "POST",
          headers: { "auth-token": token },
        },
      );
      const data = await res.json();

      if (data.success) {
        setConfluenceStatus({ connected: false });
        setSpaces([]);
        setPages([]);
        toast.success("Confluence disconnected successfully.");
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect Confluence.");
    }
  };

  // Handle space selection
  const handleSpaceChange = (spaceId: string) => {
    setSelectedSpace(spaceId);
    if (spaceId) {
      fetchPages(spaceId);
    } else {
      setPages([]);
    }
  };

  // ============ GitHub Functions ============

  // Fetch GitHub status
  const fetchGithubStatus = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/status`, {
        headers: { "auth-token": token },
      });
      const data = await res.json();
      setGithubStatus(data);

      if (data.connected) {
        fetchGithubRepos();
      }
    } catch (error) {
      console.error("Failed to fetch GitHub status:", error);
    }
  }, [token]);

  // Fetch GitHub repos
  const fetchGithubRepos = async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/repos`, {
        headers: { "auth-token": token },
      });
      const data = await res.json();
      setGithubRepos(data.repos || []);
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    }
  };

  // Connect GitHub
  const handleConnectGithub = async () => {
    if (!token) return;

    setConnectingGithub(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/auth-url`, {
        headers: { "auth-token": token },
      });
      const data = await res.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error(data.error || "Failed to start GitHub connection.");
        setConnectingGithub(false);
      }
    } catch (error) {
      console.error("Connect error:", error);
      toast.error("Failed to connect to GitHub.");
      setConnectingGithub(false);
    }
  };

  // Disconnect GitHub
  const handleDisconnectGithub = async () => {
    if (!token) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/integrations/github/disconnect`,
        {
          method: "POST",
          headers: { "auth-token": token },
        },
      );
      const data = await res.json();

      if (data.success) {
        setGithubStatus({ connected: false });
        setGithubRepos([]);
        toast.success("GitHub disconnected successfully.");
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect GitHub.");
    }
  };

  // Fetch GitHub status on mount
  useEffect(() => {
    fetchGithubStatus();
  }, [fetchGithubStatus]);

  if (loading) {
    return (
      <div className="integrations-page">
        <div className="integrations-loading">
          <div className="loading-spinner" />
          <p>Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="integrations-page">
      <div className="integrations-container">
        {/* Back Button */}
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>

        {/* Header */}
        <div className="integrations-header">
          <h1 className="integrations-title">
            <span className="gradient-text">Integrations</span>
          </h1>
          <p className="integrations-subtitle">
            Connect ArchiFlow with your favorite tools to streamline your
            workflow
          </p>
        </div>

        {/* Integration Cards */}
        <div className="integrations-grid">
          {/* Confluence Card */}
          <div
            className={`integration-card ${confluenceStatus?.connected ? "connected" : ""}`}
          >
            <div className="card-header">
              <div className="integration-logo confluence">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.996 23.951c-4.48-2.618-9.362-7.238-11.884-11.603a1.077 1.077 0 0 1 .521-1.488 1.082 1.082 0 0 1 .414-.083c3.085 0 8.01 4.542 10.95 7.155a1.037 1.037 0 0 0 1.34 0c2.94-2.613 7.846-7.155 10.95-7.155.141 0 .28.028.414.083a1.08 1.08 0 0 1 .697 1.134c-.116.326-.356.592-.66.745-.044.02-3.35 1.706-6.426 5.86-1.554 2.1-3.645 4.305-6.316 5.352zm0-23.902C16.476 2.667 21.36 7.287 23.88 11.652a1.076 1.076 0 0 1-.52 1.487 1.081 1.081 0 0 1-.415.083c-3.084 0-8.01-4.542-10.949-7.155a1.038 1.038 0 0 0-1.34 0C7.717 8.68 2.81 13.222-.29 13.222a1.088 1.088 0 0 1-.413-.083 1.08 1.08 0 0 1-.698-1.134 1.085 1.085 0 0 1 .661-.745c.045-.02 3.35-1.706 6.426-5.86C7.24 3.298 9.332 1.093 12.003.048h-.008z" />
                </svg>
              </div>
              <div className="integration-info">
                <h3>Confluence</h3>
                <p>Documentation & Wiki</p>
              </div>
              <div
                className={`status-badge ${confluenceStatus?.connected ? "connected" : "disconnected"}`}
              >
                {confluenceStatus?.connected ? "Connected" : "Not Connected"}
              </div>
            </div>

            <div className="card-body">
              {confluenceStatus?.connected ? (
                <>
                  <div className="connection-info">
                    <span className="info-label">Connected to:</span>
                    <a
                      href={confluenceStatus.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="info-value"
                    >
                      {confluenceStatus.siteUrl?.replace("https://", "")}
                    </a>
                  </div>

                  {/* Space Selector */}
                  <div className="project-selector">
                    <label>Select Space:</label>
                    <select
                      value={selectedSpace}
                      onChange={(e) => handleSpaceChange(e.target.value)}
                    >
                      <option value="">Choose a space...</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.key} — {space.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pages List */}
                  {selectedSpace && (
                    <div className="issues-section">
                      <h4>Recent Pages</h4>
                      {loadingPages ? (
                        <div className="issues-loading">Loading pages...</div>
                      ) : pages.length > 0 ? (
                        <div className="issues-list">
                          {pages.slice(0, 5).map((page) => (
                            <div key={page.id} className="issue-item">
                              <span className="issue-key">📄</span>
                              <span className="issue-summary">
                                {page.title}
                              </span>
                              <span className="issue-status blue-gray">
                                {page.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-issues">
                          No pages found in this space.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    className="disconnect-button"
                    onClick={handleDisconnectConfluence}
                  >
                    Disconnect Confluence
                  </button>
                </>
              ) : (
                <>
                  <p className="feature-description">
                    Connect your Confluence account to:
                  </p>
                  <ul className="features-list">
                    <li>✓ Publish diagrams as Confluence pages</li>
                    <li>✓ Create architecture documentation</li>
                    <li>✓ Browse spaces and pages</li>
                  </ul>
                  <button
                    className="connect-button"
                    onClick={handleConnectConfluence}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <>
                        <span className="btn-spinner" /> Connecting...
                      </>
                    ) : (
                      "Connect Confluence"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* GitHub Card */}
          <div
            className={`integration-card ${githubStatus?.connected ? "connected" : ""}`}
          >
            <div className="card-header">
              <div className="integration-logo github">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <div className="integration-info">
                <h3>GitHub</h3>
                <p>Version Control & Repos</p>
              </div>
              <div
                className={`status-badge ${githubStatus?.connected ? "connected" : "disconnected"}`}
              >
                {githubStatus?.connected ? "Connected" : "Not Connected"}
              </div>
            </div>

            <div className="card-body">
              {githubStatus?.connected ? (
                <>
                  <div className="connection-info">
                    <span className="info-label">Connected as:</span>
                    <a
                      href={`https://github.com/${githubStatus.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="info-value"
                    >
                      @{githubStatus.username}
                    </a>
                  </div>

                  {/* Repos List */}
                  {githubRepos.length > 0 && (
                    <div className="issues-section">
                      <h4>Recent Repositories</h4>
                      <div className="issues-list">
                        {githubRepos.slice(0, 5).map((repo) => (
                          <a
                            key={repo.id}
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="issue-item"
                          >
                            <span className="issue-key">
                              {repo.private ? "🔒" : "📂"}
                            </span>
                            <span className="issue-summary">{repo.name}</span>
                            <span className="issue-status blue-gray">
                              {repo.defaultBranch}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className="disconnect-button"
                    onClick={handleDisconnectGithub}
                  >
                    Disconnect GitHub
                  </button>
                </>
              ) : (
                <>
                  <p className="feature-description">
                    Connect your GitHub account to:
                  </p>
                  <ul className="features-list">
                    <li>✓ View your repositories in ArchiFlow</li>
                    <li>✓ Store diagrams in repos</li>
                    <li>✓ Version control architectures</li>
                  </ul>
                  <button
                    className="connect-button"
                    onClick={handleConnectGithub}
                    disabled={connectingGithub}
                  >
                    {connectingGithub ? (
                      <>
                        <span className="btn-spinner" /> Connecting...
                      </>
                    ) : (
                      "Connect GitHub"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
