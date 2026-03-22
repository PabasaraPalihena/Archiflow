import { Handle, Position, type NodeProps } from "reactflow";
import type { LinkTool } from "../Canvas/MainCanvas";

export type RelationshipNodeData = {
  linkType: LinkTool;
  label?: string;
  rotation?: number;
};

export default function RelationshipNode({ data }: NodeProps<RelationshipNodeData>) {
  const isArrow = data.linkType !== "legacy";
  const label = data.label ?? (data.linkType === "trust" ? "Trust" : "");
  const rotation = data.rotation ?? 0;

  return (
    <div className="relationshipNode" style={{ transform: `rotate(${rotation}deg)` }}>
      <Handle type="target" position={Position.Left} id="left" className="relationshipHandle" />

      <div className="relationshipBody">
        <div className="relationshipLine">
          {isArrow && <div className="relationshipArrow" />}
        </div>

        {label ? <div className="relationshipText">{label}</div> : null}
      </div>

      <Handle type="source" position={Position.Right} id="right" className="relationshipHandle" />
    </div>
  );
}