import { Handle, Position, NodeResizer, type NodeProps } from "reactflow";
import type { WamElementType } from "./WamPalette";

export type WamNodeData = {
  label: string;
  wamType: WamElementType;
  rotation?: number;

  // Descriptive language
  description?: string; // human-readable
  props?: Record<string, any>; // machine-readable

  // UI-only
  showRelationMenu?: boolean;
  onPickRelation?: (t: "legacy" | "invocation" | "trust") => void;
};

const svgCommon = {
  fill: "none",
  stroke: "#111827",
  strokeWidth: 1.5,
  vectorEffect: "non-scaling-stroke" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Shape({ type }: { type: WamElementType }) {
  // IMPORTANT: use 100% so shape scales with resize
  switch (type) {
    case "service":
      return (
        <svg viewBox="0 0 64 40" width="100%" height="100%">
          <path
            d="M 32 7 Q 34 7 36 10 L 52 32 Q 54 35 50 35 L 14 35 Q 10 35 12 32 L 28 10 Q 30 7 32 7 Z"
            {...svgCommon}
          />
        </svg>
      );
    case "aiService":
      return (
        <svg viewBox="0 0 64 40" width="100%" height="100%">
          <path
            d="M 32 7 Q 34 7 36 10 L 52 32 Q 54 35 50 35 L 14 35 Q 10 35 12 32 L 28 10 Q 30 7 32 7 Z"
            {...svgCommon}
          />
          <circle cx="32" cy="24" r="3.5" fill="#111827" />
        </svg>
      );
    case "application":
    case "aiApplication":
      return (
        <svg viewBox="0 0 64 40" width="100%" height="100%">
          <rect x="10" y="6" width="44" height="28" rx="8" {...svgCommon} />
          {type === "aiApplication" ? (
            <circle cx="32" cy="20" r="3.5" fill="#111827" />
          ) : null}
        </svg>
      );
    case "identityProvider":
      return (
        <svg viewBox="0 0 64 40" width="100%" height="100%">
          <path
            d="M 16 30 Q 16 26 20 24 L 42 10 Q 46 8 48 12 L 48 30 Q 48 34 44 34 L 20 34 Q 16 34 16 30 Z"
            {...svgCommon}
          />
        </svg>
      );
    case "dataProvider":
    case "dataset":
      return (
        <svg viewBox="0 0 64 40" width="100%" height="100%">
          <ellipse cx="32" cy="10" rx="16" ry="6" {...svgCommon} />
          <path d="M16 10 v16 c0 4 7 8 16 8 s16-4 16-8 V10" {...svgCommon} />
          {type === "dataset" ? (
            <circle cx="32" cy="22" r="3.5" fill="#111827" />
          ) : null}
        </svg>
      );
    case "processUnit":
    case "aiProcess":
      return (
        <svg viewBox="0 0 64 40" width="100%" height="100%">
          <circle cx="32" cy="20" r="14" {...svgCommon} />
          {type === "aiProcess" ? (
            <circle cx="32" cy="20" r="3.5" fill="#111827" />
          ) : null}
        </svg>
      );
    case "securityRealm":
      return (
        <svg viewBox="0 0 64 40" width="100%" height="100%">
          <rect x="10" y="6" width="44" height="28" rx="6" {...svgCommon} />
          <path d="M44 6 L54 16" {...svgCommon} />
        </svg>
      );
    default:
      return null;
  }
}

function ArrowIcon({ kind }: { kind: "legacy" | "invocation" | "trust" }) {
  if (kind === "legacy") {
    return (
      <svg width="20" height="10" viewBox="0 0 28 14">
        <path
          d="M2 7 H26"
          stroke="#111827"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (kind === "invocation") {
    return (
      <svg width="20" height="10" viewBox="0 0 28 14">
        <path
          d="M2 7 H20"
          stroke="#111827"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M20 2 L26 7 L20 12 Z" fill="#111827" />
      </svg>
    );
  }

  // Trust: label above + centered arrow
  return (
    <svg width="44" height="18" viewBox="0 0 60 18">
      <text
        x="20"
        y="8"
        textAnchor="middle"
        fontSize="8"
        fontWeight="500"
        fill="#111827"
        fontFamily="Manrope, system-ui, sans-serif"
      >
        Trust
      </text>

      <g transform="translate(9, 0)">
        <path
          d="M2 13 H22"
          stroke="#111827"
          strokeWidth="2"
          strokeLinecap="butt"
        />
        <path
          d="M22 8 L28 13 L22 18"
          fill="none"
          stroke="#111827"
          strokeWidth="2"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      </g>
    </svg>
  );
}

export default function WamNode({ data, selected }: NodeProps<WamNodeData>) {
  const rotation = data.rotation ?? 0;
  const isRealm = data.wamType === "securityRealm";

  return (
    <div className={`wamNode ${isRealm ? "isRealm" : ""}`}>
      {/* Draw.io style resize handles (only when selected) */}
      <NodeResizer
        isVisible={!!selected}
        minWidth={60}
        minHeight={40}
        handleStyle={{ width: 6, height: 6, borderRadius: 9999 }}
        lineStyle={{ strokeWidth: 1 }}
      />

      {/* Rotate inner content only, so resizing stays correct */}
      <div
        className="wamContent"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className="wamShapeBox">
          {data.showRelationMenu && data.onPickRelation && (
            <div
              className="wamRelationMenu"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="wamRelBtn"
                title="Legacy"
                onClick={() => data.onPickRelation?.("legacy")}
              >
                <ArrowIcon kind="legacy" />
              </button>

              <button
                className="wamRelBtn"
                title="Invocation"
                onClick={() => data.onPickRelation?.("invocation")}
              >
                <ArrowIcon kind="invocation" />
              </button>

              <button
                className="wamRelBtn"
                title="Trust"
                onClick={() => data.onPickRelation?.("trust")}
              >
                <ArrowIcon kind="trust" />
              </button>
            </div>
          )}

          {/* SOURCE handles */}
          <Handle
            className="wamHiddenHandle"
            type="source"
            position={Position.Top}
            id="sTop"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle"
            type="source"
            position={Position.Right}
            id="sRight"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle"
            type="source"
            position={Position.Bottom}
            id="sBottom"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle"
            type="source"
            position={Position.Left}
            id="sLeft"
            isConnectable
          />

          <Handle
            className="wamHiddenHandle wamCornerHandle tl"
            type="source"
            position={Position.Top}
            id="sTL"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle wamCornerHandle tr"
            type="source"
            position={Position.Top}
            id="sTR"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle wamCornerHandle br"
            type="source"
            position={Position.Bottom}
            id="sBR"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle wamCornerHandle bl"
            type="source"
            position={Position.Bottom}
            id="sBL"
            isConnectable
          />

          {/* TARGET handles */}
          <Handle
            className="wamHiddenHandle"
            type="target"
            position={Position.Top}
            id="tTop"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle"
            type="target"
            position={Position.Right}
            id="tRight"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle"
            type="target"
            position={Position.Bottom}
            id="tBottom"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle"
            type="target"
            position={Position.Left}
            id="tLeft"
            isConnectable
          />

          <Handle
            className="wamHiddenHandle wamCornerHandle tl"
            type="target"
            position={Position.Top}
            id="tTL"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle wamCornerHandle tr"
            type="target"
            position={Position.Top}
            id="tTR"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle wamCornerHandle br"
            type="target"
            position={Position.Bottom}
            id="tBR"
            isConnectable
          />
          <Handle
            className="wamHiddenHandle wamCornerHandle bl"
            type="target"
            position={Position.Bottom}
            id="tBL"
            isConnectable
          />

          <div className="wamShape">
            <Shape type={data.wamType} />
          </div>
        </div>
        <div className={`wamLabel ${isRealm ? "isRealmLabel" : ""}`}>
          {data.label}
        </div>
      </div>
    </div>
  );
}
