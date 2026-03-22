import React, { useCallback, useRef } from "react";
import { type EdgeProps, useReactFlow, getSmoothStepPath } from "reactflow";
import "./EditableEdge.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface Waypoint {
  x: number;
  y: number;
}

export interface EditableEdgeData {
  linkType?: string;
  description?: string;
  props?: Record<string, any>;
  waypoints?: Waypoint[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build an SVG polyline `d` path through a list of points. */
function buildPolyPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return (
    `M ${first.x},${first.y}` + rest.map((p) => ` L ${p.x},${p.y}`).join("")
  );
}

/** Midpoint between two points. */
function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
  markerStart,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  selected,
}: EdgeProps<EditableEdgeData>) {
  const { setEdges } = useReactFlow();
  const dragRef = useRef<{
    idx: number;
    startMouse: { x: number; y: number };
    startWp: Waypoint;
  } | null>(null);

  const waypoints: Waypoint[] = data?.waypoints ?? [];
  const hasWaypoints = waypoints.length > 0;

  /* ---------- Build path ---------- */
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (hasWaypoints) {
    // Polyline through source → waypoints → target
    const points = [
      { x: sourceX, y: sourceY },
      ...waypoints,
      { x: targetX, y: targetY },
    ];
    edgePath = buildPolyPath(points);
    // Label at midpoint of path
    const midIdx = Math.floor(points.length / 2);
    const m = mid(points[midIdx - 1] ?? points[0], points[midIdx] ?? points[0]);
    labelX = m.x;
    labelY = m.y;
  } else {
    // Default smoothstep when no waypoints
    const [path, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    });
    edgePath = path;
    labelX = lx;
    labelY = ly;
  }

  /* ---------- Waypoint dragging ---------- */
  const onWaypointPointerDown = useCallback(
    (e: React.PointerEvent, idx: number) => {
      e.stopPropagation();
      e.preventDefault();
      const el = e.currentTarget as SVGElement;
      el.setPointerCapture(e.pointerId);

      dragRef.current = {
        idx,
        startMouse: { x: e.clientX, y: e.clientY },
        startWp: { ...waypoints[idx] },
      };
    },
    [waypoints],
  );

  const onWaypointPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      e.stopPropagation();

      const { idx, startMouse, startWp } = dragRef.current;
      // We need to account for the React Flow viewport transform (zoom & pan)
      const rfContainer = (e.currentTarget as SVGElement).closest(
        ".react-flow",
      ) as HTMLElement | null;
      if (!rfContainer) return;

      // Get viewport transform from the React Flow wrapper
      const viewport = rfContainer.querySelector(
        ".react-flow__viewport",
      ) as SVGGElement | null;
      const transform = viewport?.style.transform ?? "";
      const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
      const zoom = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

      const dx = (e.clientX - startMouse.x) / zoom;
      const dy = (e.clientY - startMouse.y) / zoom;

      const newWaypoints = [...waypoints];
      newWaypoints[idx] = { x: startWp.x + dx, y: startWp.y + dy };

      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: { ...(edge.data as any), waypoints: newWaypoints },
              }
            : edge,
        ),
      );
    },
    [id, waypoints, setEdges],
  );

  const onWaypointPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const el = e.currentTarget as SVGElement;
    el.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }, []);

  /* ---------- Add waypoint at segment midpoint ---------- */
  const addWaypoint = useCallback(
    (segmentIdx: number) => {
      const points = [
        { x: sourceX, y: sourceY },
        ...waypoints,
        { x: targetX, y: targetY },
      ];
      const a = points[segmentIdx];
      const b = points[segmentIdx + 1];
      const newWp: Waypoint = mid(a, b);

      const newWaypoints = [...waypoints];
      newWaypoints.splice(segmentIdx, 0, newWp);

      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: { ...(edge.data as any), waypoints: newWaypoints },
              }
            : edge,
        ),
      );
    },
    [id, sourceX, sourceY, targetX, targetY, waypoints, setEdges],
  );

  /* ---------- Remove waypoint on double-click ---------- */
  const removeWaypoint = useCallback(
    (idx: number) => {
      const newWaypoints = waypoints.filter((_, i) => i !== idx);
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: { ...(edge.data as any), waypoints: newWaypoints },
              }
            : edge,
        ),
      );
    },
    [id, waypoints, setEdges],
  );

  /* ---------- Render ---------- */
  const allPoints = [
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ];

  return (
    <g className={`editable-edge-group${selected ? " is-selected" : ""}`}>
      {/* Invisible wider hit area for easier hovering */}
      <path d={edgePath} className="editable-edge-hitarea" />

      {/* Visible edge path */}
      <path
        d={edgePath}
        style={style}
        markerEnd={markerEnd as string}
        markerStart={markerStart as string}
        fill="none"
        className="react-flow__edge-path"
      />

      {/* Label */}
      {label && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          {labelBgStyle && (
            <rect
              x={-(labelBgPadding?.[0] ?? 6) - 12}
              y={-(labelBgPadding?.[1] ?? 3) - 7}
              width={String(label).length * 6 + (labelBgPadding?.[0] ?? 6) * 2}
              height={14 + (labelBgPadding?.[1] ?? 3) * 2}
              rx={labelBgBorderRadius ?? 4}
              ry={labelBgBorderRadius ?? 4}
              style={labelBgStyle as React.CSSProperties}
            />
          )}
          <text
            style={labelStyle as React.CSSProperties}
            textAnchor="middle"
            dominantBaseline="central"
            className="react-flow__edge-text"
          >
            {label}
          </text>
        </g>
      )}

      {/* Waypoint drag handles — always rendered, CSS controls visibility */}
      {waypoints.map((wp, idx) => (
        <circle
          key={`wp-${idx}`}
          cx={wp.x}
          cy={wp.y}
          r={5}
          fill="#3b82f6"
          stroke="#fff"
          strokeWidth={1.5}
          className="editable-edge-waypoint"
          onPointerDown={(e) => onWaypointPointerDown(e, idx)}
          onPointerMove={onWaypointPointerMove}
          onPointerUp={onWaypointPointerUp}
          onDoubleClick={(e) => {
            e.stopPropagation();
            removeWaypoint(idx);
          }}
        />
      ))}

      {/* Add-waypoint "+" buttons — always rendered, CSS controls visibility */}
      {allPoints.slice(0, -1).map((pt, idx) => {
        const m = mid(pt, allPoints[idx + 1]);
        return (
          <g
            key={`add-${idx}`}
            className="editable-edge-add"
            onClick={(e) => {
              e.stopPropagation();
              addWaypoint(idx);
            }}
          >
            <circle
              cx={m.x}
              cy={m.y}
              r={8}
              fill="#e5e7eb"
              stroke="#9ca3af"
              strokeWidth={1}
            />
            <text
              x={m.x}
              y={m.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#6b7280"
              fontSize={12}
              fontWeight={700}
              style={{ pointerEvents: "none" }}
            >
              +
            </text>
          </g>
        );
      })}
    </g>
  );
}
