import React, { useMemo, useState } from "react";
import "./WamPalette.css";

export type ElementCategory = "core" | "ai" | "links";

export type WamElementType =
  | "securityRealm"
  | "identityProvider"
  | "application"
  | "service"
  | "dataProvider"
  | "processUnit"
  // AI
  | "aiService"
  | "aiApplication"
  | "dataset"
  | "aiProcess"
  // Links
  | "legacy"
  | "invocation"
  | "trust";

type PaletteItem = {
  type: WamElementType;
  label: string;
  category: ElementCategory;
  icon: React.ReactNode;
};

const svgCommon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ITEMS: PaletteItem[] = [
  // ----- WAM Core -----
  {
    type: "service",
    label: "Service",
    category: "core",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <path
          d="
            M 32 7
            Q 34 7 36 10
            L 52 32
            Q 54 35 50 35
            L 14 35
            Q 10 35 12 32
            L 28 10
            Q 30 7 32 7
            Z
          "
          {...svgCommon}
        />
      </svg>
    ),
  },
  {
    type: "application",
    label: "Application",
    category: "core",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <rect x="10" y="6" width="44" height="28" rx="8" {...svgCommon} />
      </svg>
    ),
  },
  {
    type: "dataProvider",
    label: "Data Provider",
    category: "core",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <ellipse cx="32" cy="10" rx="16" ry="6" {...svgCommon} />
        <path d="M16 10 v16 c0 4 7 8 16 8 s16-4 16-8 V10" {...svgCommon} />
      </svg>
    ),
  },
  {
    type: "processUnit",
    label: "Process Unit",
    category: "core",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <circle cx="32" cy="20" r="14" {...svgCommon} />
      </svg>
    ),
  },
  {
    type: "identityProvider",
    label: "Identity Provider",
    category: "core",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <path
          d="
            M 16 30
            Q 16 26 20 24
            L 42 10
            Q 46 8 48 12
            L 48 30
            Q 48 34 44 34
            L 20 34
            Q 16 34 16 30
            Z
          "
          {...svgCommon}
        />
      </svg>
    ),
  },
  {
    type: "securityRealm",
    label: "Security Realm",
    category: "core",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <rect x="10" y="6" width="44" height="28" rx="6" {...svgCommon} />
        <path d="M44 6 L54 16" {...svgCommon} />
      </svg>
    ),
  },

  // ----- WAM AI -----
  {
    type: "aiService",
    label: "AI Service",
    category: "ai",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <path
          d="
            M 32 7
            Q 34 7 36 10
            L 52 32
            Q 54 35 50 35
            L 14 35
            Q 10 35 12 32
            L 28 10
            Q 30 7 32 7
            Z
          "
          {...svgCommon}
        />
        <circle cx="32" cy="24" r="3.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    type: "aiApplication",
    label: "AI Application",
    category: "ai",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <rect x="10" y="6" width="44" height="28" rx="8" {...svgCommon} />
        <circle cx="32" cy="20" r="3.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    type: "dataset",
    label: "Dataset",
    category: "ai",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <ellipse cx="32" cy="10" rx="16" ry="6" {...svgCommon} />
        <path d="M16 10 v16 c0 4 7 8 16 8 s16-4 16-8 V10" {...svgCommon} />
        <circle cx="32" cy="22" r="3.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    type: "aiProcess",
    label: "AI Process",
    category: "ai",
    icon: (
      <svg viewBox="0 0 64 40" className="wap-svg">
        <circle cx="32" cy="20" r="14" {...svgCommon} />
        <circle cx="32" cy="20" r="3.5" fill="currentColor" />
      </svg>
    ),
  },

  // ----- Connections & Links -----
  {
    type: "legacy",
    label: "Legacy",
    category: "links",
    icon: <div className="wap-line legacy" />,
  },
  {
    type: "invocation",
    label: "Invocation",
    category: "links",
    icon: <div className="wap-line invocation" />,
  },
  {
    type: "trust",
    label: "Trust",
    category: "links",
    icon: <div className="wap-line trust" />,
  },
];

function group(items: PaletteItem[]) {
  return items.reduce(
    (acc, it) => {
      acc[it.category].push(it);
      return acc;
    },
    {
      core: [] as PaletteItem[],
      ai: [] as PaletteItem[],
      links: [] as PaletteItem[],
    },
  );
}

function Section({
  title,
  items,
  defaultOpen = true,
}: {
  title: string;
  items: PaletteItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    item: PaletteItem,
  ) => {
    event.dataTransfer.setData("application/reactflow", item.type);
    event.dataTransfer.setData("wam/label", item.label);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="wap-section">
      <button
        className="wap-header"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className={`wap-chevron ${open ? "open" : ""}`}>▾</span>
        <span className="wap-title">{title}</span>
      </button>

      {open && (
        <div className="wap-card">
          <div className="wap-grid">
            {items.map((item) => (
              <div
                key={item.type}
                className="wap-item"
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                title={`Drag: ${item.label}`}
              >
                <div className="wap-icon">{item.icon}</div>
                <div className="wap-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WamPalette() {
  const grouped = useMemo(() => group(ITEMS), []);

  return (
    <aside className="wam-accordion-palette">
      <Section title="WAM Core Elements" items={grouped.core} defaultOpen />
      <Section title="WAM AI Elements" items={grouped.ai} defaultOpen />
      <Section title="Connections & Links" items={grouped.links} defaultOpen />
    </aside>
  );
}
