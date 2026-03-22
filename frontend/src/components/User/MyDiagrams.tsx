import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./MyDiagrams.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

type DiagramSummary = {
  _id: string;
  name: string;
  description?: string;
  type?: string;
  tags?: string[];
  thumbnail?: string;
  diagramData?: {
    nodes?: any[];
    edges?: any[];
  };
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

type MyDiagramsProps = {
  onLoadDiagram: (diagramData: { nodes: any[]; edges: any[] }) => void;
};

export default function MyDiagrams({ onLoadDiagram }: MyDiagramsProps) {
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDiagrams = diagrams.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const token = localStorage.getItem("auth-token");
    if (!token) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/my-diagrams?limit=8`, {
      headers: { "auth-token": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch diagrams");
        return res.json();
      })
      .then((data) => {
        setDiagrams(data.diagrams ?? []);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLoad = async (diagramId: string) => {
    setLoadingId(diagramId);
    try {
      const res = await fetch(`${API_BASE}/api/diagrams/${diagramId}`);
      if (!res.ok) throw new Error("Failed to fetch diagram");
      const data = await res.json();

      if (data.diagram?.diagramData) {
        // Construct standard AiDiagram form combining DB metadata with Canvas Nodes
        const fullDiagram = {
          _id: data.diagram._id,
          name: data.diagram.name,
          description: data.diagram.description,
          type: data.diagram.type,
          tags: data.diagram.tags,
          ...data.diagram.diagramData,
        };
        onLoadDiagram(fullDiagram);
        navigate("/maincanvas");
      }
    } catch (err) {
      console.error("Load error:", err);
      toast.error("Failed to load diagram");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = (diagramId: string, diagramName: string) => {
    setConfirmDelete({ id: diagramId, name: diagramName });
  };

  const confirmAndDelete = async () => {
    if (!confirmDelete) return;

    setDeletingId(confirmDelete.id);
    setConfirmDelete(null);
    try {
      const token = localStorage.getItem("auth-token");
      const res = await fetch(`${API_BASE}/api/diagrams/${confirmDelete.id}`, {
        method: "DELETE",
        headers: { "auth-token": token || "" },
      });
      if (!res.ok) throw new Error("Failed to delete diagram");

      setDiagrams((prev) => prev.filter((d) => d._id !== confirmDelete.id));
      toast.success("Diagram deleted");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete diagram");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="myDiagramsPage">
      <div className="mdPageContainer">
        {/* Header */}
        <div className="mdPageHeader">
          <div>
            <h1 className="mdPageTitle">My Diagrams</h1>
            <p className="mdPageSubtitle">Your latest saved diagrams</p>
          </div>
          <div className="mdSearchBox">
            <svg className="mdSearchIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="mdSearchInput"
              type="text"
              placeholder="Search diagrams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="mdPageContent">
          {loading && (
            <div className="mdGrid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="mdSkeleton" />
              ))}
            </div>
          )}

          {!loading && (
            <div className="mdGrid">
              {/* Create New card */}
              <div
                className="mdCard mdCreateNewCard"
                onClick={() => {
                  onLoadDiagram({ nodes: [], edges: [] });
                  navigate("/maincanvas");
                }}
                title="Create a new diagram"
              >
                <div className="mdCreateNewContent">
                  <svg
                    className="mdCreateNewIcon"
                    viewBox="0 0 48 48"
                    fill="none"
                  >
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="#8b5cf6"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                    <line
                      x1="24"
                      y1="14"
                      x2="24"
                      y2="34"
                      stroke="#8b5cf6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <line
                      x1="14"
                      y1="24"
                      x2="34"
                      y2="24"
                      stroke="#8b5cf6"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="mdCreateNewLabel">Create New</span>
                </div>
              </div>

              {filteredDiagrams.map((d) => {
                const nodeCount = d.diagramData?.nodes?.length ?? 0;
                const edgeCount = d.diagramData?.edges?.length ?? 0;
                const isLoadingThis = loadingId === d._id;
                return (
                  <div key={d._id} className="mdCard">
                    <div
                      className={`mdCardThumbnail${isLoadingThis ? " mdCardLoading" : ""}${d.thumbnail ? " mdCardHasImage" : ""}`}
                      onClick={() => handleLoad(d._id)}
                      title="Open diagram"
                    >
                      {d.thumbnail ? (
                        <img
                          className="mdThumbImg"
                          src={d.thumbnail}
                          alt={d.name}
                          draggable={false}
                        />
                      ) : (
                        <>
                          <svg
                            className="mdThumbIcon"
                            viewBox="0 0 64 64"
                            fill="none"
                          >
                            <rect
                              x="4"
                              y="6"
                              width="22"
                              height="14"
                              rx="3"
                              stroke="#8b5cf6"
                              strokeWidth="2"
                            />
                            <rect
                              x="38"
                              y="6"
                              width="22"
                              height="14"
                              rx="3"
                              stroke="#a78bfa"
                              strokeWidth="2"
                            />
                            <rect
                              x="4"
                              y="44"
                              width="22"
                              height="14"
                              rx="3"
                              stroke="#a78bfa"
                              strokeWidth="2"
                            />
                            <rect
                              x="38"
                              y="44"
                              width="22"
                              height="14"
                              rx="3"
                              stroke="#8b5cf6"
                              strokeWidth="2"
                            />
                            <line
                              x1="26"
                              y1="13"
                              x2="38"
                              y2="13"
                              stroke="#c4b5fd"
                              strokeWidth="1.5"
                            />
                            <line
                              x1="15"
                              y1="20"
                              x2="15"
                              y2="44"
                              stroke="#c4b5fd"
                              strokeWidth="1.5"
                            />
                            <line
                              x1="49"
                              y1="20"
                              x2="49"
                              y2="44"
                              stroke="#c4b5fd"
                              strokeWidth="1.5"
                            />
                            <line
                              x1="26"
                              y1="51"
                              x2="38"
                              y2="51"
                              stroke="#c4b5fd"
                              strokeWidth="1.5"
                            />
                          </svg>
                          <div className="mdThumbStats">
                            {nodeCount} nodes &middot; {edgeCount} edges
                          </div>
                        </>
                      )}
                      {isLoadingThis && <div className="mdCardSpinner" />}
                    </div>

                    <div className="mdCardInfo">
                      <div className="mdCardNameRow">
                        <h3 className="mdCardName" title={d.name}>
                          {d.name}
                        </h3>
                        <button
                          className="mdDeleteIconBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(d._id, d.name);
                          }}
                          disabled={!!loadingId || !!deletingId}
                          title="Delete diagram"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                      {d.type && <span className="mdBadge">{d.type}</span>}
                      <span className="mdTime">{timeAgo(d.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="mdConfirmOverlay"
          onClick={() => setConfirmDelete(null)}
        >
          <div className="mdConfirmDialog" onClick={(e) => e.stopPropagation()}>
            <div className="mdConfirmIcon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
            <h3 className="mdConfirmTitle">Delete Diagram</h3>
            <p className="mdConfirmText">
              Are you sure you want to delete{" "}
              <strong>"{confirmDelete.name}"</strong>? This action cannot be
              undone.
            </p>
            <div className="mdConfirmActions">
              <button
                className="mdConfirmCancelBtn"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button className="mdConfirmDeleteBtn" onClick={confirmAndDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
