import { useState } from "react";
import type { AiChatResponse } from "./chatApi";

// map wam node categories
const WAM = {
    app: ["application", "aiapplication"],
    service: ["service", "aiservice"],
    data: ["dataprovider", "dataset", "processingunit", "aiprocess"],
    realm: ["realm", "securityrealm"],
    idp: ["identityprovider"],
};
const is = (n: string, cats: string[]) => cats.some(c => n.toLowerCase() === c);
const isAppOrSvc = (n: string) => is(n, [...WAM.app, ...WAM.service]);

// helper to return a human readable rule for a given edge type
function getRule(edgeType: string): string {
    const e = edgeType.toLowerCase();
    if (e === "invocation")
        return "Invocation: Application or AIApplication or Service or AIService → Service or AIService";
    if (e === "legacy")
        return "Legacy: Application, AIApplication, Service, or AIService → DataProvider, Dataset, ProcessingUnit, or AIProcess";
    if (e === "trust")
        return "Trust: Security Realm → Security Realm";
    if (e === "contains")
        return "Contains: Security Realm must contain its nodes";
    return "";
}

// return a quick fix suggestion for the current error
function getFix(from: string, to: string, edgeType: string, raw: string): string {
    const edge = edgeType.toLowerCase();
    const f = from.toLowerCase();
    const t = to.toLowerCase();

    // edge case: disconnected node
    if (raw.toLowerCase().includes("unknown node") || raw.toLowerCase().includes("references unknown"))
        return "Delete this connection — one of its endpoints no longer exists on the canvas.";

    if (edge === "invocation") {
        const fromOk = is(f, [...WAM.app, ...WAM.service]);
        const toOk = is(t, WAM.service);
        if (!fromOk && toOk)
            return `Change ${from} to an Application or Service, or switch this to a Legacy connection.`;
        if (fromOk && !toOk && is(t, WAM.data))
            return `Switch this to a Legacy connection — that's the correct way to reach ${to}.`;
        if (fromOk && !toOk)
            return `Change ${to} to a Service, or change the connection type.`;
        if (is(f, WAM.app) && is(t, WAM.app))
            return `The target must be a Service, not another Application. Change ${to} to a Service.`;
        if (!fromOk && !toOk)
            return `Replace ${from} and ${to} with Application/Service types, or use a different connection type.`;
    }

    if (edge === "legacy") {
        const fromOk = is(f, [...WAM.app, ...WAM.service]);
        const toOk = is(t, WAM.data);
        // backwards legacy edge check
        if (!fromOk && is(f, WAM.data) && isAppOrSvc(t))
            return `The arrow is backwards — reverse it: connect ${to} → ${from} instead.`;
        if (!fromOk)
            return `${from} cannot initiate a Legacy connection. Change ${from} to an Application, AIApplication, Service, or AIService.`;
        if (!toOk)
            return `${to} cannot be the target of Legacy. Change ${to} to a DataProvider, Dataset, ProcessingUnit, or AIProcess.`;
    }

    if (edge === "trust")
        return `Make both ${from} and ${to} Security Realms, or change the connection type.`;

    if (raw.toLowerCase().includes("must be contained"))
        return `Drag ${from || "this element"} inside a Security Realm on the canvas.`;
    if (raw.toLowerCase().includes("must contain at least one"))
        return "Add at least one node inside this Security Realm.";
    if (raw.toLowerCase().includes("identityprovider"))
        return `Remove the ${edgeType} connection to/from Identity Provider (Contains edges are allowed).`;

    return "Update the connection type or element types to match the allowed rule above.";
}


// violation error message formatter
type ParsedViolation = {
    title: string;
    what: string;
    from: string;
    to: string;
    edgeType: string;
    rule: string;   // what IS allowed
    fix: string;    // specific action to take
};

function formatViolation(raw: string): ParsedViolation {
    // catch dangling connections first
    if (raw.toLowerCase().includes("unknown node") || raw.toLowerCase().includes("references unknown")) {
        return {
            title: "Disconnected edge",
            what: "A connection points to an element that no longer exists.",
            from: "", to: "", edgeType: "",
            rule: "",
            fix: "Delete this connection — one of its endpoints no longer exists on the canvas.",
        };
    }

    // parse regex mapping from validation lib
    const gotMatch = raw.match(/\(got\s+([\w]+)\s*->\s*([\w]+)\)/i);
    const edgeMatch = raw.match(/^([\w]+)\s+(?:cannot|must)/i);

    if (gotMatch) {
        const from = gotMatch[1];
        const to = gotMatch[2];
        const edgeType = edgeMatch ? edgeMatch[1] : "connection";
        return {
            title: `Invalid ${edgeType} connection`,
            what: `${from} used ${edgeType} to reach ${to} — this isn't allowed.`,
            from, to, edgeType,
            rule: getRule(edgeType),
            fix: getFix(from, to, edgeType, raw),
        };
    }

    // generic catch-all for unknown errors
    const cleaned = raw.replace(/->/g, "to").replace(/<-/g, "from").replace(/\s+/g, " ").trim();
    return {
        title: "Rule violation",
        what: cleaned,
        from: "", to: "", edgeType: "",
        rule: "",
        fix: getFix("", "", "", raw),
    };
}


type StructuredMessageProps = {
    payload: AiChatResponse;
    onFixDiagram?: () => void;
    onApplyDiagram?: () => void;
    onExplain?: () => void;
    isFixing?: boolean;
};

export default function StructuredMessage({
    payload,
    onFixDiagram,
    onApplyDiagram,
    onExplain,
    isFixing,
}: StructuredMessageProps) {
    const [boundariesOpen, setBoundariesOpen] = useState(false);
    const [relationshipsOpen, setRelationshipsOpen] = useState(false);

    const diagram = payload.diagram || { nodes: [], edges: [] };
    const validation = payload.validation || { valid: true, errors: [] };
    const hasViolations = !validation.valid && validation.errors.length > 0;
    const canFix = hasViolations && onFixDiagram;
    const canApply = validation.valid && onApplyDiagram && diagram.nodes.length > 0;

    // parse payload
    const realms = diagram.nodes.filter((n: any) => n.type === "Realm");
    const edges = diagram.edges || [];

    // group them so we can show them nicely by realm
    const nodesByRealm = new Map<string, any[]>();
    edges
        .filter((e: any) => e.type === "Contains")
        .forEach((e: any) => {
            const realm = realms.find((r: any) => r.id === e.from);
            if (realm) {
                if (!nodesByRealm.has(realm.id)) {
                    nodesByRealm.set(realm.id, []);
                }
                const node = diagram.nodes.find((n: any) => n.id === e.to);
                if (node) {
                    nodesByRealm.get(realm.id)!.push(node);
                }
            }
        });

    // filter out contains for the logic connections
    const relationshipEdges = edges.filter((e: any) => e.type !== "Contains");

    return (
        <div>
            {/* success state */}
            {!hasViolations && validation.valid && (
                <div className="warningBanner" style={{ background: "#d1fae5", borderColor: "#10b981" }}>
                    <div className="warningIcon" style={{ color: "#059669" }}>✅</div>
                    <div className="warningContent">
                        <div className="warningTitle" style={{ color: "#065f46" }}>
                            Diagram is valid!
                        </div>
                        <div className="warningText" style={{ color: "#047857" }}>
                            All WAM rules are satisfied. You can view it on the canvas or get an explanation.
                        </div>
                    </div>
                </div>
            )}

            {/* warning state */}
            {hasViolations && (
                <div className="warningBanner">
                    <div className="warningIcon">⚠️</div>
                    <div className="warningContent">
                        <div className="warningTitle">
                            Extracted diagram — {validation.errors.length} rule violation{validation.errors.length > 1 ? "s" : ""}
                        </div>
                        <div className="warningText">
                            You can fix automatically or review details below.
                        </div>
                    </div>
                </div>
            )}

            {/* primary actions */}
            <div className="actionButtons">
                {canFix && (
                    <button
                        className="actionBtn primary"
                        onClick={onFixDiagram}
                        disabled={isFixing}
                    >
                        {isFixing ? "Fixing..." : "Fix diagram"}
                    </button>
                )}
                {canApply && (
                    <button
                        className="actionBtn secondary"
                        onClick={onApplyDiagram}
                    >
                        View on canvas
                    </button>
                )}
                {onExplain && !hasViolations && (
                    <button
                        className="actionBtn secondary"
                        onClick={onExplain}
                    >
                        Explain
                    </button>
                )}
            </div>

            {/* errors list */}
            {hasViolations && (
                <div className="violationSection">
                    {validation.errors.map((error: string, i: number) => {
                        const v = formatViolation(error);
                        return (
                            <div key={i} className="violationCard">
                                {/* card header */}
                                <div className="violationCardHeader">
                                    <span className="violationBadge">⚠ Violation</span>
                                    <span className="violationNum">#{i + 1}</span>
                                </div>

                                {/* description */}
                                <div className="violationWhat">{v.what}</div>

                                {/* targets */}
                                {v.from && v.to && (
                                    <div className="violationElements">
                                        <span className="violationElementLabel">Elements involved</span>
                                        <div className="violationElementRow">
                                            <span className="violationChip violationChipFrom">{v.from}</span>
                                            <span className="violationArrow">used {v.edgeType} to reach</span>
                                            <span className="violationChip violationChipTo">{v.to}</span>
                                        </div>
                                    </div>
                                )}

                                {/* fix suggestion */}
                                <div className="violationFix">
                                    {v.rule && (
                                        <div className="violationFixRule">✅ Allowed: {v.rule}</div>
                                    )}
                                    <div className="violationFixLabel">💡 Fix</div>
                                    <div className="violationFixText">{v.fix}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* realms dropdown */}
            {realms.length > 0 && (
                <div className="collapsibleSection">
                    <div
                        className="collapsibleHeader"
                        onClick={() => setBoundariesOpen(!boundariesOpen)}
                    >
                        <div className="collapsibleHeaderLeft">
                            <span className="collapsibleIcon">🔒</span>
                            <span className="collapsibleTitle">Zones</span>
                            <span className="collapsibleBadge success">{realms.length}</span>
                        </div>
                        <span className={`collapsibleChevron ${boundariesOpen ? "open" : ""}`}>
                            ▼
                        </span>
                    </div>
                    {boundariesOpen && (
                        <div className="collapsibleContent">
                            {realms.map((realm: any) => {
                                const contained = nodesByRealm.get(realm.id) || [];
                                return (
                                    <div key={realm.id} className="ruleItem">
                                        <div className="ruleLabel">{realm.name || realm.id}:</div>
                                        <div className="ruleText">
                                            {contained.length > 0
                                                ? contained.map((n: any) => n.type).join(", ")
                                                : "Empty"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* connections dropdown */}
            {relationshipEdges.length > 0 && (
                <div className="collapsibleSection">
                    <div
                        className="collapsibleHeader"
                        onClick={() => setRelationshipsOpen(!relationshipsOpen)}
                    >
                        <div className="collapsibleHeaderLeft">
                            <span className="collapsibleIcon">🔗</span>
                            <span className="collapsibleTitle">Relationships</span>
                            <span className="collapsibleBadge success">{relationshipEdges.length}</span>
                        </div>
                        <span className={`collapsibleChevron ${relationshipsOpen ? "open" : ""}`}>
                            ▼
                        </span>
                    </div>
                    {relationshipsOpen && (
                        <div className="collapsibleContent">
                            {relationshipEdges.map((edge: any, i: number) => {
                                const fromNode = diagram.nodes.find((n: any) => n.id === edge.from);
                                const toNode = diagram.nodes.find((n: any) => n.id === edge.to);
                                return (
                                    <div key={i} className="ruleItem">
                                        <div className="ruleLabel">{edge.type}:</div>
                                        <div className="ruleText">
                                            {fromNode?.type || edge.from} → {toNode?.type || edge.to}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
