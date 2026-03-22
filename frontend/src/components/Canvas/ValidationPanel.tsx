import "./ValidationPanel.css";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  result: ValidationResult | null;
  loading: boolean;
};

// ── Violation parser ─────────────────────────────────────────────────────────
type ParsedViolation = {
  what: string;
  from: string;
  to: string;
  edgeType: string;
  rule: string;  // what IS allowed
  fix: string;   // specific action
};

function parseViolation(raw: string): ParsedViolation {
  // Dangling edge
  if (raw.toLowerCase().includes("unknown node") || raw.toLowerCase().includes("references unknown")) {
    return {
      what: "A connection points to an element that no longer exists.",
      from: "", to: "", edgeType: "",
      rule: "",
      fix: "Delete this connection — one of its endpoints no longer exists on the canvas.",
    };
  }

  // Strip node id noise: Node "node_xxx" (Type) → Type
  let s = raw
    .replace(/Node\s+"[^"]+"\s+\(([^)]+)\)/g, "$1")
    .replace(/Element\s+"[^"]+"\s+\(([^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  // Extract (got SOURCE -> TARGET)
  const gotMatch = s.match(/\(got\s+([\w]+)\s*->\s*([\w]+)\)/i);
  // Extract edge type — first word before "cannot" or "must"
  const edgeMatch = s.match(/^([\w]+)\s+(?:cannot|must)/i);

  if (gotMatch) {
    const from = gotMatch[1];
    const to = gotMatch[2];
    const edgeType = edgeMatch ? edgeMatch[1] : "connection";
    return {
      what: `${from} used ${edgeType} to reach ${to} — this isn't allowed.`,
      from, to, edgeType,
      rule: getRule(edgeType),
      fix: bestFix(from, to, edgeType, raw),
    };
  }

  // Fallback
  const cleaned = s.replace(/->/g, "to").replace(/<-/g, "from").replace(/\s+/g, " ").trim();
  return {
    what: cleaned,
    from: "", to: "", edgeType: "",
    rule: "",
    fix: bestFix("", "", "", raw),
  };
}

/** One-line rule: what IS allowed for this edge type */
function getRule(edgeType: string): string {
  const e = edgeType.toLowerCase();
  if (e === "invocation") return "Invocation: Application, AIApplication, Service, or AIService → Service or AIService";
  if (e === "legacy") return "Legacy: Application, AIApplication, Service, or AIService → DataProvider, Dataset, ProcessingUnit, or AIProcess";
  if (e === "trust") return "Trust: Security Realm → Security Realm";
  if (e === "contains") return "Contains: Security Realm must contain its nodes";
  return "";
}

// ── Smart fix advisor ─────────────────────────────────────────────────────
const WAM = {
  app: ["application", "aiapplication"],
  service: ["service", "aiservice"],
  data: ["dataprovider", "dataset", "processingunit", "aiprocess"],
  realm: ["realm", "securityrealm"],
};
const is = (n: string, cats: string[]) => cats.some(c => n.toLowerCase() === c);
const isAppOrSvc = (n: string) => is(n, [...WAM.app, ...WAM.service]);

function bestFix(from: string, to: string, edgeType: string, raw: string): string {
  const edge = edgeType.toLowerCase();
  const f = from.toLowerCase();
  const t = to.toLowerCase();

  if (edge === "invocation") {
    const fromOk = is(f, [...WAM.app, ...WAM.service]);
    const toOk = is(t, WAM.service);
    if (!fromOk && toOk)
      return `${from} cannot start an Invocation. Change ${from} to an Application or Service, or switch to a Legacy connection.`;
    if (fromOk && !toOk && is(t, WAM.data))
      return `${to} cannot receive Invocation. Use a Legacy connection to reach ${to} instead.`;
    if (fromOk && !toOk)
      return `${to} cannot receive Invocation. Change ${to} to a Service, or pick a different connection type.`;
    if (!fromOk && !toOk)
      return `Neither ${from} nor ${to} can use Invocation. Replace them with Application/Service types, or use a different connection.`;
    if (is(f, WAM.app) && is(t, WAM.app))
      return `Invocation cannot go from ${from} to another Application. The target must be a Service.`;
  }

  if (edge === "legacy") {
    const fromOk = is(f, [...WAM.app, ...WAM.service]);
    const toOk = is(t, WAM.data);
    // Reversed: source is a data node, target is an app/service
    if (!fromOk && is(f, WAM.data) && isAppOrSvc(t))
      return `The arrow is backwards — reverse it: connect ${to} → ${from} instead.`;
    if (!fromOk)
      return `${from} cannot initiate a Legacy connection. Change ${from} to an Application, AIApplication, Service, or AIService.`;
    if (!toOk)
      return `${to} cannot be the target of Legacy. Change ${to} to a DataProvider, Dataset, ProcessingUnit, or AIProcess.`;
  }

  if (edge === "trust") {
    if (!is(f, WAM.realm) || !is(t, WAM.realm))
      return `Trust can only connect Security Realms. Change the connection type, or make both ${from} and ${to} Security Realms.`;
  }

  // Case 1: the whole diagram has no Realm at all
  if (raw.toLowerCase().includes("must contain at least one realm") || raw.toLowerCase().includes("at least one realm"))
    return "Add a Security Realm element to the canvas. Every WAM diagram requires at least one Realm.";
  // Case 2: an element exists outside any Realm
  if (raw.toLowerCase().includes("must be contained") || raw.toLowerCase().includes("must contain at least one"))
    return `Move ${from || "this element"} inside a Security Realm on the canvas (drag it into the realm boundary).`;
  if (raw.toLowerCase().includes("identityprovider"))
    return `Identity Provider must not be connected with ${edgeType || "this edge type"}. Remove this connection (Contains edges are fine).`;

  return "Review the WAM rules and update the elements or connection type involved.";
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ValidationPanel({ open, onClose, result, loading }: Props) {
  if (!open) return null;

  return (
    <div className="valOverlay" role="dialog" aria-modal="true">
      <div className="valPanel">
        <div className="valHeader">
          <div>
            <div className="valTitle">Validation</div>
            <div className="valSubtitle">
              {loading
                ? "Running rule checks…"
                : !result
                  ? "Click Validation to run checks."
                  : result.valid
                    ? "✅ WAM-compliant"
                    : `❌ ${result.errors.length} issue(s) found`}
            </div>
          </div>

          <button className="valClose" onClick={onClose} aria-label="Close validation panel">
            ✕
          </button>
        </div>

        <div className="valBody">
          {loading ? (
            <div className="valLoading">Validating…</div>
          ) : !result ? (
            <div className="valEmpty">No results yet.</div>
          ) : result.valid ? (
            <div className="valSuccessWrap">
              {/* Animated ring + check */}
              <div className="valSuccessRing">
                <svg viewBox="0 0 80 80" width="80" height="80" className="valSuccessSvg">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="#d1fae5" strokeWidth="6" />
                  <circle cx="40" cy="40" r="36" fill="none" stroke="#22c55e" strokeWidth="6"
                    strokeDasharray="226" strokeDashoffset="226"
                    className="valSuccessCircle"
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                  />
                  <polyline points="26,40 36,51 54,30" fill="none" stroke="#22c55e" strokeWidth="5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className="valSuccessCheck"
                  />
                </svg>
              </div>

              {/* Title */}
              <div className="valSuccessTitle">All checks passed!</div>
              <div className="valSuccessSubtitle">Your diagram is fully WAM-compliant.</div>

              <div className="valSuccessBadge">WAM-Compliant ✓</div>
            </div>
          ) : (
            <div className="valList">
              {result.errors.map((err: string, idx: number) => {
                const v = parseViolation(err);
                return (
                  <div className="valCard" key={idx}>
                    {/* Header */}
                    <div className="valCardTop">
                      <div className="valBadge">⚠ Violation</div>
                      <div className="valIndex">#{idx + 1}</div>
                    </div>

                    {/* What went wrong */}
                    <div className="valMsg">{v.what}</div>

                    {/* Elements involved */}
                    {v.from && v.to && (
                      <div className="valElements">
                        <div className="valElementsLabel">Elements involved</div>
                        <div className="valElementsRow">
                          <span className="valChip valChipFrom">{v.from}</span>
                          <span className="valChipMiddle">
                            used {v.edgeType} to reach
                          </span>
                          <span className="valChip valChipTo">{v.to}</span>
                        </div>
                      </div>
                    )}

                    {/* How to fix */}
                    <div className="valFixBox">
                      {v.rule && (
                        <div className="valFixRule">✅ Allowed: {v.rule}</div>
                      )}
                      <div className="valFixTitle">💡 Fix</div>
                      <div className="valFix">{v.fix}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="valFooter">
          <button className="valFooterBtn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
