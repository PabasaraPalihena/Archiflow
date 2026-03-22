import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { docsContent } from "./docsContent";
import "./DocsPage.css";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      items.push({
        id: slugify(match[2]),
        text: match[2],
        level: match[1].length,
      });
    }
  }
  return items;
}

export default function DocsPage() {
  const toc = useMemo(() => parseToc(docsContent), []);
  const [activeId, setActiveId] = useState<string>(toc[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const HEADER_OFFSET = 100;

    const handleScroll = () => {
      if (!contentRef.current) return;

      const headings = contentRef.current.querySelectorAll("h2[id], h3[id]");
      let current = "";

      for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= HEADER_OFFSET) {
          current = heading.id;
        } else {
          break;
        }
      }

      if (current) {
        setActiveId(current);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Run once on mount to set initial active
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTocClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveId(id);
    }
    setMobileOpen(false);
  };

  const components = {
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
      const text = String(children);
      const id = slugify(text);
      return (
        <h2 id={id} {...props}>
          {children}
        </h2>
      );
    },
    h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
      const text = String(children);
      const id = slugify(text);
      return (
        <h3 id={id} {...props}>
          {children}
        </h3>
      );
    },
  };

  return (
    <div className="docs-container">
      {/* Mobile TOC toggle */}
      <button
        className="docs-toc-toggle"
        onClick={() => setMobileOpen((v) => !v)}
      >
        Table of Contents
        <span className={`docs-toc-toggle-icon ${mobileOpen ? "open" : ""}`}>
          ▼
        </span>
      </button>

      {/* Sidebar TOC */}
      <nav className={`docs-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="docs-sidebar-title">Contents</div>
        {toc.map((item) => (
          <button
            key={item.id}
            className={`docs-toc-item${item.level === 3 ? " sub" : ""}${
              activeId === item.id ? " active" : ""
            }`}
            onClick={() => handleTocClick(item.id)}
          >
            {item.text}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <div className="docs-content" ref={contentRef}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {docsContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
