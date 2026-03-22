import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { toPng } from "html-to-image";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  ConnectionLineType,
  type Connection,
  type Edge,
  type Node,
  Panel,
} from "reactflow";
import { CanvasToolbar } from "./CanvasToolbar";
import "reactflow/dist/style.css";

import WamNode, { type WamNodeData } from "../Palette/WamNode";
import EditableEdge from "./EditableEdge";
import "../Palette/WamNode.css";
import "./MainCanvas.css";
import type { WamElementType } from "../Palette/WamPalette";
import PublishToConfluenceModal from "../Integrations/PublishToConfluenceModal";
import "../Integrations/PublishToConfluenceModal.css";

export type LinkTool = "legacy" | "invocation" | "trust";

export type SelectedItem =
  | null
  | {
      kind: "wam";
      id: string;
      wamType: WamElementType;
      label: string;
      rotation: number;
      description: string;
      props: Record<string, any>;
      setLabel: (v: string) => void;
      setRotation: (deg: number) => void;
      setDescription: (v: string) => void;
      setProp: (k: string, v: any) => void;
    }
  | {
      kind: "link";
      id: string;
      linkType: LinkTool;
      description: string;
      props: Record<string, any>;
      sourceHandle?: string;
      targetHandle?: string;
      setDescription: (v: string) => void;
      setProp: (k: string, v: any) => void;
      setSourceHandle: (handle: string) => void;
      setTargetHandle: (handle: string) => void;
    };

// ---- expected AI diagram shape (matches your ChatWidget usage) ----
// NOTE: edge.type is string because AI may return "Invocation"/"Contains"/etc.
export type AiDiagram = {
  _id?: string;
  name?: string;
  description?: string;
  type?: string;
  tags?: string[];
  nodes: Array<{
    id: string;
    type: string;
    name?: string;
    label?: string;
    description?: string;
    props?: Record<string, any>;
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    id?: string;
    type: string;
    from: string;
    to: string;
    description?: string;
    props?: Record<string, any>;
  }>;
};

type MainCanvasProps = {
  activeLinkTool?: LinkTool;
  onActivateLinkTool?: (tool: LinkTool) => void;
  onSelectionChange?: (sel: SelectedItem) => void;
  onModelChange?: (model: { nodes: Node[]; edges: Edge[] }) => void;
  externalDiagram?: AiDiagram | null;
  onGitHubPush?: () => void;
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Registered custom components
// const nodeTypes = { wam: WamNode }; // used via useMemo below

/** Default machine-readable descriptive language for nodes */
function defaultPropsFor(wamType: WamElementType): Record<string, any> {
  switch (wamType) {
    case "service":
      return { endpoint: "", apiStyle: "REST", version: "1.0" };
    case "aiService":
      return {
        endpoint: "",
        apiStyle: "REST",
        version: "1.0",
        functionality: "Inference",
        modelProvider: "",
        modelName: "",
        inputs: "",
        outputs: "",
        dataset: "",
        biasConsiderations: "",
        dataSensitivity: "medium",
      };
    case "application":
      return { url: "", ownerTeam: "", technology: "" };
    case "aiApplication":
      return {
        url: "",
        ownerTeam: "",
        technology: "",
        aiFeatures: "",
        functionality: "Inference",
        inputs: "",
        outputs: "",
        modelName: "",
        dataSensitivity: "medium",
        humanInTheLoop: false,
      };
    case "securityRealm":
      return { ownerOrg: "", domain: "", publicFacing: false };
    case "identityProvider":
      return { tokenType: "SAML", issuer: "" };
    case "dataProvider":
      return { system: "", storageType: "" };
    case "dataset":
      return {
        system: "",
        storageType: "",
        classification: "internal",
        inputs: "",
        outputs: "",
      };
    case "processUnit":
      return { runtime: "", purpose: "" };
    case "aiProcess":
      return {
        runtime: "",
        purpose: "",
        pipelineType: "inference",
        functionality: "Inference",
        inputs: "",
        outputs: "",
        modelName: "",
      };
    default:
      return {};
  }
}

/** Default machine-readable descriptive language for edges */
function defaultEdgePropsFor(linkType: LinkTool): Record<string, any> {
  switch (linkType) {
    case "invocation":
      return { protocol: "HTTPS", auth: "None", encrypted: true };
    case "trust":
      return { trustType: "tokenAcceptance", notes: "" };
    case "legacy":
      return { adapter: "", notes: "" };
    default:
      return {};
  }
}

function makeEdge(
  linkType: LinkTool,
  source: string,
  target: string,
  sourceHandle?: string | null,
  targetHandle?: string | null,
  _offset?: number, // keep param so call sites don't change
  idOverride?: string,
): Edge {
  const isTrust = linkType === "trust";
  const isInvocation = linkType === "invocation";

  return {
    id: idOverride ?? `e_${crypto.randomUUID()}`,
    source,
    target,
    sourceHandle: sourceHandle ?? undefined,
    targetHandle: targetHandle ?? undefined,
    type: "editable",

    markerEnd: isInvocation
      ? { type: MarkerType.ArrowClosed, color: "#111827" }
      : isTrust
        ? { type: MarkerType.Arrow, color: "#111827" }
        : undefined,

    label: isTrust ? "Trust" : undefined,
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 6,
    labelBgStyle: { fill: "rgba(255,255,255,0.9)" },
    labelStyle: { fill: "#111827", fontSize: 8, fontWeight: 200 },

    style: { strokeWidth: 2, stroke: "#111827" },

    data: {
      linkType,
      description: "",
      props: defaultEdgePropsFor(linkType),
      waypoints: [],
    },

    className: `edge-${linkType}`,
  };
}

function getNodeIdUnderPointer(
  clientX: number,
  clientY: number,
): string | null {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (!el) return null;
  const nodeEl = el.closest?.(".react-flow__node") as HTMLElement | null;
  return nodeEl?.dataset?.id ?? null;
}

function pickHandlesForEdge(
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number },
  sourceEdgeIndex = 0,
  targetEdgeIndex = 0,
): { sourceHandle: string; targetHandle: string } {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;

  // Available handles per side (center + corners)
  const rightHandles = ["sRight", "sTR", "sBR"];
  const leftHandles = ["sLeft", "sTL", "sBL"];
  const bottomHandles = ["sBottom", "sBL", "sBR"];
  const topHandles = ["sTop", "sTL", "sTR"];

  const targetRightHandles = ["tRight", "tTR", "tBR"];
  const targetLeftHandles = ["tLeft", "tTL", "tBL"];
  const targetBottomHandles = ["tBottom", "tBL", "tBR"];
  const targetTopHandles = ["tTop", "tTL", "tTR"];

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      return {
        sourceHandle: rightHandles[sourceEdgeIndex % rightHandles.length],
        targetHandle:
          targetLeftHandles[targetEdgeIndex % targetLeftHandles.length],
      };
    }
    return {
      sourceHandle: leftHandles[sourceEdgeIndex % leftHandles.length],
      targetHandle:
        targetRightHandles[targetEdgeIndex % targetRightHandles.length],
    };
  }

  if (dy >= 0) {
    return {
      sourceHandle: bottomHandles[sourceEdgeIndex % bottomHandles.length],
      targetHandle: targetTopHandles[targetEdgeIndex % targetTopHandles.length],
    };
  }
  return {
    sourceHandle: topHandles[sourceEdgeIndex % topHandles.length],
    targetHandle:
      targetBottomHandles[targetEdgeIndex % targetBottomHandles.length],
  };
}

/**
 * Normalize AI edge types into your UI LinkTool values.
 * AI may return "Invocation"/"Trust"/"Legacy" (capitalized) or unknown strings.
 */
function normalizeAiEdgeType(raw: unknown): LinkTool {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (t === "invocation") return "invocation";
  if (t === "trust") return "trust";
  if (t === "legacy") return "legacy";
  return "legacy";
}

/**
 * Normalize AI node types into your supported WamElementType values.
 * - Realm/Relam -> securityRealm
 * - DataUnit/Database/DB -> dataset (label keeps original)
 * - Unknown -> application (fallback) but label will show the unknown type
 */
function normalizeAiType(rawType: unknown): {
  wamType: WamElementType;
  labelIfUnknown?: string;
} {
  const original = String(rawType ?? "").trim();
  const t = original.toLowerCase();

  if (
    t === "realm" ||
    t === "relam" ||
    t === "securityrealm" ||
    t.includes("security realm")
  ) {
    return { wamType: "securityRealm" };
  }

  if (
    t === "dataunit" ||
    t === "data unit" ||
    t.includes("data unit") ||
    t === "database" ||
    t === "db"
  ) {
    return { wamType: "dataset", labelIfUnknown: original };
  }

  if (t === "dataprovider" || t === "data provider")
    return { wamType: "dataProvider" };
  if (t === "identityprovider" || t === "identity provider" || t === "idp")
    return { wamType: "identityProvider" };

  if (t === "service") return { wamType: "service" };
  if (t === "aiservice" || t === "ai service") return { wamType: "aiService" };
  if (t === "application") return { wamType: "application" };
  if (t === "aiapplication" || t === "ai application")
    return { wamType: "aiApplication" };
  if (t === "dataset") return { wamType: "dataset" };
  if (
    t === "processunit" ||
    t === "process unit" ||
    t === "processingunit" ||
    t === "processing unit"
  )
    return { wamType: "processUnit" };
  if (t === "aiprocess" || t === "ai process") return { wamType: "aiProcess" };

  return { wamType: "application", labelIfUnknown: original || "Unknown" };
}

function mapAiDiagramToCanvas(diagram: AiDiagram): {
  nodes: Node<WamNodeData>[];
  edges: Edge[];
} {
  // 1) Normalize all node types first, and keep a lookup
  const normById = new Map<
    string,
    { wamType: WamElementType; labelIfUnknown?: string }
  >();
  for (const n of diagram.nodes ?? []) {
    normById.set(n.id, normalizeAiType(n.type));
  }

  // 2) Build containment map from Contains edges: childId -> realmId
  // Only accept Contains where FROM is a Realm-type node
  const parentByChild = new Map<string, string>();
  for (const e of diagram.edges ?? []) {
    if (String(e.type).trim().toLowerCase() !== "contains") continue;
    if (!e.from || !e.to) continue;

    const fromNorm = normById.get(e.from);
    if (fromNorm?.wamType === "securityRealm") {
      parentByChild.set(e.to, e.from);
    }
  }

  // AUTO-CONTAINMENT: If there's a security realm but no explicit Contains edges,
  // automatically place all non-realm nodes inside the first realm
  const realmNodes = (diagram.nodes ?? []).filter(
    (n) => normById.get(n.id)?.wamType === "securityRealm",
  );
  const nonRealmNodes = (diagram.nodes ?? []).filter(
    (n) => normById.get(n.id)?.wamType !== "securityRealm",
  );

  // If there are realms but no nodes are assigned to them, auto-assign
  if (realmNodes.length > 0 && parentByChild.size === 0) {
    // Use the first realm as the default parent for all non-realm nodes
    const defaultRealm = realmNodes[0];
    for (const n of nonRealmNodes) {
      parentByChild.set(n.id, defaultRealm.id);
    }
  }

  // helper: give children positions inside their realm with proper padding
  const childIndexInRealm = new Map<string, number>();
  const childCountPerRealm = new Map<string, number>();

  // Build ordered list of children per realm based on connections
  const orderedChildrenPerRealm = new Map<string, string[]>();

  // First pass: count children per realm
  for (const n of diagram.nodes ?? []) {
    const parent = parentByChild.get(n.id);
    if (parent) {
      childCountPerRealm.set(parent, (childCountPerRealm.get(parent) ?? 0) + 1);
      if (!orderedChildrenPerRealm.has(parent)) {
        orderedChildrenPerRealm.set(parent, []);
      }
      orderedChildrenPerRealm.get(parent)!.push(n.id);
    }
  }

  // Build connection graph for ordering children
  const childOutgoing = new Map<string, Set<string>>();
  const childIncoming = new Map<string, Set<string>>();

  for (const e of diagram.edges ?? []) {
    if (String(e.type).trim().toLowerCase() === "contains") continue;
    // Only consider edges between nodes in the same realm
    const fromParent = parentByChild.get(e.from);
    const toParent = parentByChild.get(e.to);
    if (fromParent && fromParent === toParent) {
      if (!childOutgoing.has(e.from)) childOutgoing.set(e.from, new Set());
      if (!childIncoming.has(e.to)) childIncoming.set(e.to, new Set());
      childOutgoing.get(e.from)!.add(e.to);
      childIncoming.get(e.to)!.add(e.from);
    }
  }

  // Sort children in each realm by topological order (sources first)
  for (const [_realmId, children] of orderedChildrenPerRealm) {
    children.sort((a, b) => {
      const aIncoming = childIncoming.get(a)?.size ?? 0;
      const bIncoming = childIncoming.get(b)?.size ?? 0;
      const aOutgoing = childOutgoing.get(a)?.size ?? 0;
      const bOutgoing = childOutgoing.get(b)?.size ?? 0;

      // Nodes with no incoming (sources) come first
      // Nodes with no outgoing (sinks) come last
      const aScore = aOutgoing - aIncoming;
      const bScore = bOutgoing - bIncoming;
      return bScore - aScore; // Higher score (more outgoing, less incoming) comes first
    });
  }

  function nextChildPos(realmId: string, nodeId: string) {
    // Find index of this node in the ordered list
    const orderedList = orderedChildrenPerRealm.get(realmId) ?? [];
    const i = orderedList.indexOf(nodeId);
    const actualIndex = i >= 0 ? i : (childIndexInRealm.get(realmId) ?? 0);

    if (i < 0) {
      childIndexInRealm.set(realmId, actualIndex + 1);
    }

    // Use horizontal flow layout for better connection visualization
    const childCount = childCountPerRealm.get(realmId) ?? 1;
    const cols = Math.min(childCount, 3); // Max 3 columns to avoid corner
    const cellW = 200; // Horizontal spacing between nodes
    const cellH = 180; // Vertical spacing between rows
    const paddingLeft = 120; // Left padding inside realm (offset from realm border)
    const paddingTop = 100; // Top padding (avoid top border area)

    // Position based on topological order
    const x = paddingLeft + (actualIndex % cols) * cellW;
    const y = paddingTop + Math.floor(actualIndex / cols) * cellH;
    return { x, y };
  }

  function getRealmSize(realmId: string) {
    const childCount = childCountPerRealm.get(realmId) ?? 0;
    const cols = Math.min(childCount, 3); // Max 3 columns
    const rows = Math.max(1, Math.ceil(childCount / Math.max(cols, 1)));
    const cellW = 200;
    const cellH = 180;
    const paddingLeft = 120; // Match nextChildPos
    const paddingTop = 100;
    const paddingRight = 150; // Extra right padding to avoid corner fold decoration
    const paddingBottom = 60;
    const nodeWidth = 140;
    const nodeHeight = 100;

    // Calculate width: left padding + cells + node width + right padding (extra for corner)
    const width = Math.max(
      500,
      paddingLeft + Math.max(cols - 1, 0) * cellW + nodeWidth + paddingRight,
    );
    // Calculate height: top padding + rows + node height + bottom padding + label space
    const height = Math.max(
      300,
      paddingTop +
        Math.max(rows - 1, 0) * cellH +
        nodeHeight +
        paddingBottom +
        30,
    );

    return { width, height };
  }

  // ========== HIERARCHICAL LAYOUT ALGORITHM ==========
  // Build adjacency for non-contained edges to compute layers
  const nonContainEdges = (diagram.edges ?? []).filter(
    (e) => String(e.type).trim().toLowerCase() !== "contains",
  );

  // Track outgoing and incoming connections
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();

  for (const e of nonContainEdges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, new Set());
    if (!incoming.has(e.to)) incoming.set(e.to, new Set());
    outgoing.get(e.from)!.add(e.to);
    incoming.get(e.to)!.add(e.from);
  }

  // Get all non-realm, non-parented node IDs
  const freeNodeIds = (diagram.nodes ?? [])
    .filter((n) => {
      const norm = normById.get(n.id);
      return norm?.wamType !== "securityRealm" && !parentByChild.has(n.id);
    })
    .map((n) => n.id);

  // Assign layers using topological-like approach
  // Layer 0: nodes with no incoming edges (sources)
  // Each subsequent layer: nodes whose all predecessors are in previous layers
  const nodeLayer = new Map<string, number>();
  const assigned = new Set<string>();

  // Start with sources (no incoming edges)
  const sources = freeNodeIds.filter(
    (id) => !incoming.has(id) || incoming.get(id)!.size === 0,
  );

  if (sources.length > 0) {
    // BFS to assign layers
    let currentLayer = 0;
    let currentNodes = sources;

    while (currentNodes.length > 0) {
      for (const id of currentNodes) {
        if (!assigned.has(id)) {
          nodeLayer.set(id, currentLayer);
          assigned.add(id);
        }
      }

      // Find nodes for next layer (nodes that have all predecessors assigned)
      const nextNodes: string[] = [];
      for (const id of freeNodeIds) {
        if (assigned.has(id)) continue;

        const preds = incoming.get(id);
        if (!preds || preds.size === 0) {
          nextNodes.push(id);
        } else {
          const allPredsAssigned = [...preds].every((p) => assigned.has(p));
          if (allPredsAssigned) {
            nextNodes.push(id);
          }
        }
      }

      currentNodes = nextNodes;
      currentLayer++;

      // Safety break for cycles
      if (currentLayer > 20) break;
    }

    // Assign remaining unassigned nodes (cycles or disconnected)
    for (const id of freeNodeIds) {
      if (!assigned.has(id)) {
        nodeLayer.set(id, currentLayer);
        assigned.add(id);
      }
    }
  } else {
    // No clear sources, use simple index-based assignment
    freeNodeIds.forEach((id, idx) => {
      nodeLayer.set(id, Math.floor(idx / 2));
    });
  }

  // Group nodes by layer
  const layerNodes = new Map<number, string[]>();
  for (const [id, layer] of nodeLayer) {
    if (!layerNodes.has(layer)) layerNodes.set(layer, []);
    layerNodes.get(layer)!.push(id);
  }

  // Calculate positions based on layers
  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 100;
  const LAYER_GAP_X = 280; // Horizontal gap between layers
  const NODE_GAP_Y = 160; // Vertical gap between nodes in same layer
  const START_X = 80;
  const START_Y = 80;

  const computedPositions = new Map<string, { x: number; y: number }>();

  // Sort layers and position nodes
  const sortedLayers = [...layerNodes.keys()].sort((a, b) => a - b);

  for (const layerIdx of sortedLayers) {
    const nodesInLayer = layerNodes.get(layerIdx) ?? [];
    const layerHeight = nodesInLayer.length * NODE_GAP_Y;
    const startY =
      START_Y + (layerHeight > 0 ? -layerHeight / 2 + NODE_GAP_Y / 2 : 0);

    nodesInLayer.forEach((nodeId, idx) => {
      computedPositions.set(nodeId, {
        x: START_X + layerIdx * LAYER_GAP_X,
        y: startY + idx * NODE_GAP_Y + 200, // Offset to keep positive Y
      });
    });
  }

  // 3) Create nodes with computed positions
  const nodes: Node<WamNodeData>[] = (diagram.nodes ?? []).map((n) => {
    const norm = normById.get(n.id) ?? normalizeAiType(n.type);

    const label =
      n.label ?? n.name ?? norm.labelIfUnknown ?? String(n.type ?? "");

    const isRealm = norm.wamType === "securityRealm";
    const parent = parentByChild.get(n.id);

    let position: { x: number; y: number };

    if (n.position) {
      // Use explicit position if provided
      position = n.position;
    } else if (parent && !isRealm) {
      // Child inside realm
      position = nextChildPos(parent, n.id);
    } else if (computedPositions.has(n.id)) {
      // Use computed hierarchical position
      position = computedPositions.get(n.id)!;
    } else if (isRealm) {
      // Realm nodes - position them at the bottom or separate area
      const realmIndex = (diagram.nodes ?? [])
        .filter((x) => normById.get(x.id)?.wamType === "securityRealm")
        .findIndex((x) => x.id === n.id);
      position = {
        x: START_X + realmIndex * 750,
        y: START_Y + (sortedLayers.length + 1) * NODE_GAP_Y + 100,
      };
    } else {
      // Fallback
      position = { x: START_X, y: START_Y };
    }

    return {
      id: n.id,
      type: "wam",
      position,

      parentNode: parent && !isRealm ? parent : undefined,
      extent: parent && !isRealm ? ("parent" as const) : undefined,

      data: {
        label,
        wamType: norm.wamType,
        rotation: 0,
        description: n.description ?? "",
        props: { ...defaultPropsFor(norm.wamType), ...(n.props ?? {}) },
      },

      style: isRealm
        ? getRealmSize(n.id)
        : { width: NODE_WIDTH, height: NODE_HEIGHT },

      // Z-index: realms behind, children on top
      zIndex: isRealm ? -1 : parent ? 10 : 0,
      className: isRealm ? "wam-realm" : parent ? "wam-child" : undefined,

      connectable: true,
    };
  });

  // ReactFlow requires parent nodes before children
  nodes.sort((a, b) => {
    const aIsChild = !!a.parentNode;
    const bIsChild = !!b.parentNode;
    if (aIsChild === bIsChild) return 0;
    return aIsChild ? 1 : -1;
  });

  // 4) Build edges (hide Contains edges)
  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => pos.set(n.id, n.position));

  // Track edge counts per node to distribute handles
  const sourceEdgeCount = new Map<string, number>();
  const targetEdgeCount = new Map<string, number>();

  const edges: Edge[] = nonContainEdges.map((e) => {
    const linkType = normalizeAiEdgeType(e.type);

    const fromPos = pos.get(e.from) ?? { x: 0, y: 0 };
    const toPos = pos.get(e.to) ?? { x: 0, y: 0 };

    // Get current edge index for this source/target pair
    const sourceIdx = sourceEdgeCount.get(e.from) ?? 0;
    const targetIdx = targetEdgeCount.get(e.to) ?? 0;

    // Increment counters for next edge
    sourceEdgeCount.set(e.from, sourceIdx + 1);
    targetEdgeCount.set(e.to, targetIdx + 1);

    const { sourceHandle, targetHandle } = pickHandlesForEdge(
      fromPos,
      toPos,
      sourceIdx,
      targetIdx,
    );

    return {
      ...makeEdge(
        linkType,
        e.from,
        e.to,
        sourceHandle,
        targetHandle,
        undefined,
        e.id,
      ),
      data: {
        linkType,
        description: e.description ?? "",
        props: { ...defaultEdgePropsFor(linkType), ...(e.props ?? {}) },
      },
    };
  });

  return { nodes, edges };
}

/** Find realm under an absolute position (absolute = flow coords) */
function getRealmAtPosition(
  absPos: { x: number; y: number },
  nodes: Node[],
): { id: string; x: number; y: number; w: number; h: number } | null {
  const realms = nodes
    .filter(
      (n) => n?.type === "wam" && (n as any)?.data?.wamType === "securityRealm",
    )
    .map((r) => {
      const w = ((r.style as any)?.width ?? 720) as number;
      const h = ((r.style as any)?.height ?? 420) as number;
      return { id: r.id, x: r.position.x, y: r.position.y, w, h };
    });

  // top-most first
  for (let i = realms.length - 1; i >= 0; i--) {
    const r = realms[i];
    const inside =
      absPos.x >= r.x &&
      absPos.x <= r.x + r.w &&
      absPos.y >= r.y &&
      absPos.y <= r.y + r.h;
    if (inside) return r;
  }
  return null;
}

/** Convert a node's relative position into absolute flow coords */
function absPosOf(node: Node, all: Node[]): { x: number; y: number } {
  if (!node.parentNode) return { x: node.position.x, y: node.position.y };
  const parent = all.find((n) => n.id === node.parentNode);
  if (!parent) return { x: node.position.x, y: node.position.y };
  return {
    x: parent.position.x + node.position.x,
    y: parent.position.y + node.position.y,
  };
}

function sortParentsBeforeChildren(list: Node[]): Node[] {
  const next = [...list];
  next.sort((a, b) => {
    const aIsChild = !!(a as any).parentNode;
    const bIsChild = !!(b as any).parentNode;
    if (aIsChild === bIsChild) return 0;
    return aIsChild ? 1 : -1;
  });
  return next;
}

function CanvasInner({
  activeLinkTool = "legacy",
  onActivateLinkTool,
  onSelectionChange,
  onModelChange,
  externalDiagram,
  onGitHubPush,
}: MainCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Restore canvas state from sessionStorage if available (survives navigation)
  const savedCanvas = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("canvasState");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.nodes?.length || parsed.edges?.length) return parsed;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    savedCanvas?.nodes ?? initialNodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    savedCanvas?.edges ?? initialEdges,
  );

  // History & Toolbar
  const [mode, setMode] = useState<"select" | "pan">("select");
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>(
    [],
  );
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  const takeSnapshot = useCallback(() => {
    // Limit history to 20 steps
    setHistory((prev) => [...prev.slice(-19), { nodes, edges }]);
    setFuture([]);
  }, [nodes, edges]);

  const onUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);

    setFuture((prev) => [{ nodes, edges }, ...prev]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setHistory(newHistory);
  }, [history, nodes, edges, setNodes, setEdges]);

  const onRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory((prev) => [...prev, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setFuture(newFuture);
  }, [future, nodes, edges, setNodes, setEdges]);

  const onDelete = useCallback(() => {
    takeSnapshot();
    setNodes((nds) => {
      // Find IDs of selected nodes (nodes being deleted)
      const deletingIds = new Set(
        nds.filter((n) => n.selected).map((n) => n.id),
      );

      // Process nodes: detach children whose parent is being deleted
      const processed = nds.map((n) => {
        // If this node has a parent that is being deleted, detach it
        if (n.parentNode && deletingIds.has(n.parentNode)) {
          // Find the parent to compute absolute position
          const parent = nds.find((p) => p.id === n.parentNode);
          const absPos = parent
            ? {
                x: parent.position.x + n.position.x,
                y: parent.position.y + n.position.y,
              }
            : n.position;

          return {
            ...n,
            parentNode: undefined,
            extent: undefined,
            position: absPos,
          };
        }
        return n;
      });

      // Now filter out the selected nodes
      return processed.filter((n) => !n.selected);
    });
    setEdges((eds) => eds.filter((e) => !e.selected));
  }, [takeSnapshot, setNodes, setEdges]);

  useEffect(() => {
    onModelChange?.({ nodes, edges });
    // Persist canvas state so it survives navigation (e.g. My Diagrams → Back)
    try {
      sessionStorage.setItem("canvasState", JSON.stringify({ nodes, edges }));
    } catch {
      /* quota exceeded – ignore */
    }
  }, [nodes, edges, onModelChange]);

  const hasContent = nodes.length > 0 || edges.length > 0;

  // Warn on browser refresh / tab close when canvas has content
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasContent) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasContent]);

  const nodeTypesInner = useMemo(() => ({ wam: WamNode }), []);
  const edgeTypesInner = useMemo(() => ({ editable: EditableEdge }), []);

  useEffect(() => {
    if (!externalDiagram) return;
    const mapped = mapAiDiagramToCanvas(externalDiagram);
    setNodes(mapped.nodes);
    setEdges(mapped.edges);

    setTimeout(() => {
      try {
        fitView({ padding: 0.01 });
      } catch {
        // ignore
      }
    }, 0);
  }, [externalDiagram, fitView, setEdges, setNodes]);

  const [pendingLink, setPendingLink] = useState<{
    linkType: LinkTool;
    sourceId: string | null;
  } | null>(null);

  const [relationMenuNodeId, setRelationMenuNodeId] = useState<string | null>(
    null,
  );

  // Context menu & Confluence modal state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    nodeDescription: string;
  } | null>(null);
  const [confluenceModalOpen, setConfluenceModalOpen] = useState(false);
  const [confluenceDiagramData, setConfluenceDiagramData] = useState<{
    nodes: Node[];
    edges: Edge[];
    imageData?: string;
  } | null>(null);

  const connectionLineStyle = useMemo(
    () => ({ strokeWidth: 2, stroke: "#111827" }),
    [],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      takeSnapshot();

      setEdges((eds) => {
        // Prevent duplicate edges between same two nodes
        const alreadyConnected = eds.some(
          (x) =>
            (x.source === params.source && x.target === params.target) ||
            (x.source === params.target && x.target === params.source),
        );
        if (alreadyConnected) return eds;

        const parallelCount = eds.filter(
          (x) =>
            (x.source === params.source && x.target === params.target) ||
            (x.source === params.target && x.target === params.source),
        ).length;

        const offset = parallelCount ? 20 * parallelCount : 0;

        return addEdge(
          makeEdge(
            activeLinkTool,
            params.source!,
            params.target!,
            params.sourceHandle,
            params.targetHandle,
            offset,
          ),
          eds,
        );
      });
    },
    [activeLinkTool, setEdges, takeSnapshot],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const wamType = (event.dataTransfer.getData("application/reactflow") as
        | WamElementType
        | "")!;
      if (!wamType) return;

      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) return;

      if (
        wamType === "legacy" ||
        wamType === "invocation" ||
        wamType === "trust"
      ) {
        onActivateLinkTool?.(wamType);

        const hitId = getNodeIdUnderPointer(event.clientX, event.clientY);

        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));

        setPendingLink({
          linkType: wamType,
          sourceId: hitId,
        });

        setRelationMenuNodeId(null);
        return;
      }

      const positionAbs = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const label = event.dataTransfer.getData("wam/label") || wamType;

      setNodes((nds) => {
        const isRealm = wamType === "securityRealm";
        const width = isRealm ? 500 : 100;
        const height = isRealm ? 320 : 80;

        // Offset so the node is centered exactly on the cursor
        const offsetPosition = {
          x: positionAbs.x - width / 2,
          y: positionAbs.y - height / 2,
        };

        const realmStyle = { width, height };

        // Determine if drop is inside a realm using original cursor position
        const hitRealm = !isRealm ? getRealmAtPosition(positionAbs, nds) : null;
        const relPos = hitRealm
          ? {
              x: offsetPosition.x - hitRealm.x,
              y: offsetPosition.y - hitRealm.y,
            }
          : offsetPosition;

        const newNode: Node<WamNodeData> = {
          id: `node_${crypto.randomUUID()}`,
          type: "wam",
          position: relPos,
          parentNode: hitRealm ? hitRealm.id : undefined,
          extent: hitRealm ? ("parent" as const) : undefined,
          style: realmStyle,
          zIndex: isRealm ? -1 : 0,
          className: isRealm ? "wam-realm" : undefined,
          data: {
            label,
            wamType,
            rotation: 0,
            description: "",
            props: defaultPropsFor(wamType),
          },
          connectable: true,
        };

        return sortParentsBeforeChildren(nds.concat(newNode));
      });
    },
    [onActivateLinkTool, screenToFlowPosition, setNodes, setEdges],
  );

  /**
   * FIX containment state when user DRAGS a node into/out of a realm.
   * This is what stops the "must be contained" error after you move elements.
   */
  const onNodeDragStop = useCallback(
    (_evt: any, node: Node) => {
      const nAny = node as any;
      if (nAny?.data?.wamType === "securityRealm") return;

      setNodes((nds) => {
        const current = nds.find((x) => x.id === node.id);
        if (!current) return nds;

        const abs = absPosOf(current, nds);
        const hit = getRealmAtPosition(abs, nds);

        // dropped inside realm => set parent + make position relative
        if (hit) {
          const rel = { x: abs.x - hit.x, y: abs.y - hit.y };

          const updated = nds.map((x) => {
            if (x.id !== node.id) return x;
            return {
              ...x,
              parentNode: hit.id,
              extent: "parent" as const,
              position: rel,
            };
          });

          return sortParentsBeforeChildren(updated as Node[]);
        }

        // dropped outside => remove parent + make absolute
        const updated = nds.map((x) => {
          if (x.id !== node.id) return x;
          return {
            ...x,
            parentNode: undefined,
            extent: undefined,
            position: abs,
          };
        });

        return sortParentsBeforeChildren(updated as Node[]);
      });
    },
    [setNodes],
  );

  const startRelationFromNode = useCallback(
    (nodeId: string, linkType: LinkTool) => {
      onActivateLinkTool?.(linkType);
      setPendingLink({ linkType, sourceId: nodeId });
      setRelationMenuNodeId(null);
    },
    [onActivateLinkTool],
  );

  const onNodeClick = useCallback(
    (_evt: any, node: Node) => {
      if (pendingLink) {
        if (!pendingLink.sourceId) {
          setPendingLink({ ...pendingLink, sourceId: node.id });
          return;
        }

        if (node.id !== pendingLink.sourceId) {
          setEdges((eds) => {
            // 3) Prevent duplicate edges between same two nodes
            const alreadyConnected = eds.some(
              (e) =>
                (e.source === pendingLink.sourceId && e.target === node.id) ||
                (e.source === node.id && e.target === pendingLink.sourceId),
            );
            if (alreadyConnected) return eds;

            // 1) Side-to-side: pick handles based on relative positions
            const srcNode = nodes.find((n) => n.id === pendingLink.sourceId);
            const tgtNode = node;
            const srcPos = srcNode ? absPosOf(srcNode, nodes) : { x: 0, y: 0 };
            const tgtPos = absPosOf(tgtNode, nodes);

            // 2) Count edges already leaving source / arriving at target
            //    so pickHandlesForEdge distributes to different handle spots
            const sourceIdx = eds.filter(
              (e) => e.source === pendingLink.sourceId,
            ).length;
            const targetIdx = eds.filter((e) => e.target === node.id).length;

            const { sourceHandle, targetHandle } = pickHandlesForEdge(
              srcPos,
              tgtPos,
              sourceIdx,
              targetIdx,
            );

            return addEdge(
              makeEdge(
                pendingLink.linkType,
                pendingLink.sourceId!,
                node.id,
                sourceHandle,
                targetHandle,
              ),
              eds,
            );
          });
        }

        setPendingLink(null);
        return;
      }

      setRelationMenuNodeId(node.id);

      if (node.type === "wam") {
        const data = node.data as WamNodeData;
        const label = data.label ?? "";
        const rotation = data.rotation ?? 0;
        const description = data.description ?? "";
        const props = (data.props ?? {}) as Record<string, any>;

        onSelectionChange?.({
          kind: "wam",
          id: node.id,
          wamType: data.wamType,
          label,
          rotation,
          description,
          props,

          setLabel: (v) =>
            setNodes((nds) =>
              nds.map((x) =>
                x.id === node.id ? { ...x, data: { ...x.data, label: v } } : x,
              ),
            ),

          setRotation: (deg) =>
            setNodes((nds) =>
              nds.map((x) =>
                x.id === node.id
                  ? { ...x, data: { ...x.data, rotation: deg } }
                  : x,
              ),
            ),

          setDescription: (v) =>
            setNodes((nds) =>
              nds.map((x) =>
                x.id === node.id
                  ? { ...x, data: { ...x.data, description: v } }
                  : x,
              ),
            ),

          setProp: (k, v) =>
            setNodes((nds) =>
              nds.map((x) =>
                x.id === node.id
                  ? {
                      ...x,
                      data: {
                        ...x.data,
                        props: { ...((x.data as any).props ?? {}), [k]: v },
                      },
                    }
                  : x,
              ),
            ),
        });
      } else {
        onSelectionChange?.(null);
      }
    },
    [pendingLink, onSelectionChange, setEdges, setNodes, nodes],
  );

  const onEdgeClick = useCallback(
    (_evt: any, edge: Edge) => {
      const linkType = (edge.data as any)?.linkType as LinkTool | undefined;
      if (!linkType) return;

      const description = ((edge.data as any)?.description ?? "") as string;
      const props = ((edge.data as any)?.props ?? {}) as Record<string, any>;

      setRelationMenuNodeId(null);

      onSelectionChange?.({
        kind: "link",
        id: edge.id,
        linkType,
        description,
        props,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,

        setDescription: (v) =>
          setEdges((eds) =>
            eds.map((e) =>
              e.id === edge.id
                ? { ...e, data: { ...(e.data as any), description: v } }
                : e,
            ),
          ),

        setProp: (k, v) =>
          setEdges((eds) =>
            eds.map((e) =>
              e.id === edge.id
                ? {
                    ...e,
                    data: {
                      ...(e.data as any),
                      props: {
                        ...(((e.data as any)?.props ?? {}) as any),
                        [k]: v,
                      },
                    },
                  }
                : e,
            ),
          ),

        setSourceHandle: (handle) =>
          setEdges((eds) =>
            eds.map((e) =>
              e.id === edge.id ? { ...e, sourceHandle: handle } : e,
            ),
          ),

        setTargetHandle: (handle) =>
          setEdges((eds) =>
            eds.map((e) =>
              e.id === edge.id ? { ...e, targetHandle: handle } : e,
            ),
          ),
      });
    },
    [onSelectionChange, setEdges],
  );

  const onPaneClick = useCallback(() => {
    if (pendingLink) setPendingLink(null);
    setRelationMenuNodeId(null);
    setContextMenu(null);
    onSelectionChange?.(null);
  }, [pendingLink, onSelectionChange]);

  // Right-click context menu on nodes
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const data = node.data as WamNodeData;
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeLabel: data.label ?? "Untitled",
        nodeType: data.wamType ?? "Unknown",
        nodeDescription: data.description ?? "",
      });
    },
    [],
  );

  const openConfluenceDiagramModal = useCallback(async () => {
    // Hide controls briefly so they don't appear in the image
    const flowEl = wrapperRef.current?.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;
    let dataUrl = "";
    if (flowEl) {
      try {
        dataUrl = await toPng(flowEl, {
          backgroundColor: "#ffffff",
          quality: 0.9,
          pixelRatio: 2,
        });
      } catch (err) {
        console.warn("Failed to capture diagram image:", err);
      }
    }
    setConfluenceDiagramData({ nodes, edges, imageData: dataUrl });
    setConfluenceModalOpen(true);
  }, [nodes, edges]);

  const nodesWithUi = useMemo(() => {
    return nodes.map((n) => {
      if (n.type !== "wam") return n;

      const isMenuOpen = relationMenuNodeId === n.id;

      return {
        ...n,
        className:
          pendingLink?.sourceId && n.id === pendingLink.sourceId
            ? "nodePendingSource"
            : n.className,
        data: {
          ...(n.data as any),
          showRelationMenu: isMenuOpen,
          onPickRelation: (linkType: LinkTool) =>
            startRelationFromNode(n.id, linkType),
        },
      };
    });
  }, [nodes, pendingLink?.sourceId, relationMenuNodeId, startRelationFromNode]);

  return (
    <div ref={wrapperRef} className="rfWrapper">
      {pendingLink && (
        <div className="pendingBadge">
          {pendingLink.linkType.toUpperCase()} selected — click other element
        </div>
      )}

      <ReactFlow
        nodes={nodesWithUi}
        edges={edges}
        nodeTypes={nodeTypesInner}
        edgeTypes={edgeTypesInner}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStart={() => takeSnapshot()}
        nodesConnectable
        fitView
        fitViewOptions={{ padding: 0.01 }}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        panOnDrag={mode === "pan"}
        selectionOnDrag={mode === "select"}
        snapToGrid
        snapGrid={[10, 10]}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={connectionLineStyle}
      >
        <Background gap={16} size={1} />
        <MiniMap pannable zoomable />
        <Controls position="bottom-right" />
        <Panel position="top-center">
          <CanvasToolbar
            mode={mode}
            setMode={setMode}
            onUndo={onUndo}
            onRedo={onRedo}
            onDelete={onDelete}
            canUndo={history.length > 0}
            canRedo={future.length > 0}
            onGitHubPush={onGitHubPush}
            onConfluencePublish={openConfluenceDiagramModal}
          />
        </Panel>
      </ReactFlow>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="node-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="ctx-menu-item"
            onClick={() => {
              onDelete();
              setContextMenu(null);
            }}
          >
            <span className="ctx-icon" style={{ color: "#dc2626" }}>
              🗑️
            </span>
            <span className="ctx-label">Delete Node</span>
            <span className="ctx-shortcut">Del</span>
          </button>
        </div>
      )}

      {/* Confluence Issue Modal */}
      <PublishToConfluenceModal
        open={confluenceModalOpen}
        onClose={() => setConfluenceModalOpen(false)}
        diagramData={confluenceDiagramData}
      />

    </div>
  );
}

export default function MainCanvas(props: MainCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
