const { WAM_NODE_TYPES, WAM_EDGE_TYPES } = require("./wam.types");

function lower(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

const NODE_BY_LOWER = new Map(WAM_NODE_TYPES.map((t) => [lower(t), t]));
const EDGE_BY_LOWER = new Map(WAM_EDGE_TYPES.map((t) => [lower(t), t]));

const CANON_REALM = "Realm";
const CANON_IDP = "IdentityProvider";
const CANON_DATAPROVIDER = "DataProvider";
const CANON_DATASET = "Dataset";
const CANON_PROCESS = "ProcessingUnit";
const CANON_AIPROCESS = "AIProcess";
const CANON_APP = "Application";
const CANON_AIAPP = "AIApplication";
const CANON_SERVICE = "Service";
const CANON_AISERVICE = "AIService";

const CANON_TRUST = "Trust";
const CANON_INVOCATION = "Invocation";
const CANON_LEGACY = "Legacy";
const CANON_CONTAINS = "Contains";

function canonicalizeNodeType(rawType) {
  const raw = (rawType ?? "").toString().trim();
  const k = lower(raw);

  if (NODE_BY_LOWER.has(k)) return NODE_BY_LOWER.get(k);

  // Realm typos
  if (k === "relam" || k === "securityrealm" || k.includes("security realm") || k === "realm") {
    return CANON_REALM;
  }

  // ✅ IMPORTANT: DB / DataUnit synonyms -> DataProvider (core)
  if (
    k === "dataunit" ||
    k === "data unit" ||
    k.includes("data unit") ||
    k === "database" ||
    k === "db" ||
    k.includes("database") ||
    k.includes("datastore") ||
    k.includes("storage")
  ) {
    return CANON_DATAPROVIDER;
  }

  // DataProvider synonyms
  if (k === "dataprovider" || k.includes("data provider")) return CANON_DATAPROVIDER;

  // Dataset synonyms (AI extension)
  if (k === "dataset" || k.includes("training data") || k.includes("data set")) return CANON_DATASET;

  if (k === "idp" || k.includes("identity provider")) return CANON_IDP;

  if (k.includes("service")) return k.includes("ai") ? CANON_AISERVICE : CANON_SERVICE;
  if (k.includes("application") || k === "app") return k.includes("ai") ? CANON_AIAPP : CANON_APP;
  if (k.includes("process") || k.includes("processing")) return k.includes("ai") ? CANON_AIPROCESS : CANON_PROCESS;

  return null;
}

function canonicalizeEdgeType(rawType) {
  const raw = (rawType ?? "").toString().trim();
  const k = lower(raw);

  if (EDGE_BY_LOWER.has(k)) return EDGE_BY_LOWER.get(k);

  if (k === "trust") return CANON_TRUST;
  if (k === "invocation") return CANON_INVOCATION;
  if (k === "legacy") return CANON_LEGACY;
  if (k === "contains" || k === "contain") return CANON_CONTAINS;

  return null;
}

function displayName(node) {
  // Prefer name for nicer errors, fallback to id
  return node?.name ? String(node.name) : String(node?.id ?? "");
}

function validateDiagram(diagram) {
  const errors = [];

  if (!diagram || typeof diagram !== "object") {
    return { valid: false, errors: ["Diagram must be an object."] };
  }

  const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram.edges) ? diagram.edges : [];

  const nodeById = new Map();

  for (const n of nodes) {
    if (!n?.id || typeof n.id !== "string") {
      errors.push("Each node must have a string id.");
      continue;
    }

    const canonType = canonicalizeNodeType(n.type);
    if (!canonType) {
      errors.push(`Element "${n.name ?? n.id}" has invalid/unknown type "${n.type}".`);
      continue;
    }

    if (nodeById.has(n.id)) {
      errors.push(`Duplicate node id "${n.id}". Node ids must be unique.`);
      continue;
    }

    nodeById.set(n.id, { ...n, type: canonType });
  }

  const canonEdges = [];

  for (const e of edges) {
    if (!e || typeof e !== "object") {
      errors.push("Each edge must be an object.");
      continue;
    }

    const canonEdgeType = canonicalizeEdgeType(e.type);
    if (!canonEdgeType) {
      errors.push(`Edge has invalid/unknown type "${e?.type}".`);
    }

    if (!e.from || !e.to) {
      errors.push("Each edge must have 'from' and 'to'.");
      continue;
    }

    if (e.from === e.to) {
      errors.push(`Edge "${e.type}" cannot connect a node to itself.`);
    }

    if (!nodeById.has(e.from)) errors.push(`Edge references unknown node "${e.from}".`);
    if (!nodeById.has(e.to)) errors.push(`Edge references unknown node "${e.to}".`);

    canonEdges.push({ ...e, type: canonEdgeType ?? e.type });
  }

  // Require at least one Realm
  const realmIds = [];
  for (const n of nodeById.values()) {
    if (n?.type === CANON_REALM && typeof n.id === "string") realmIds.push(n.id);
  }
  if (realmIds.length === 0) {
    errors.push(`Diagram must contain at least one ${CANON_REALM}.`);
  }

  // Build containment map: who contains whom
  const containedNodeIds = new Set();
  const containedRealmIds = new Set(); // Track realms that are inside other realms
  for (const e of canonEdges) {
    if (e?.type !== CANON_CONTAINS || !e.from || !e.to) continue;
    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    if (from?.type === CANON_REALM) {
      containedNodeIds.add(e.to);
      // If the target is also a Realm, mark it as a nested/contained realm
      if (to?.type === CANON_REALM) {
        containedRealmIds.add(e.to);
      }
    }
  }

  // Every non-Realm node must be contained via Contains edge Realm -> node
  // Realms that are nested (contained by another realm) don't need to be at top level
  for (const n of nodeById.values()) {
    if (!n?.id || typeof n.id !== "string") continue;
    if (n.type === CANON_REALM) continue; // Realms can be top-level or nested

    if (!containedNodeIds.has(n.id)) {
      errors.push(
        `Element "${displayName(n)}" (${n.type}) must be contained in a ${CANON_REALM} using a ${CANON_CONTAINS} edge.`
      );
    }
  }

  const isApplicationLike = (t) => t === CANON_APP || t === CANON_AIAPP;
  const isServiceLike = (t) => t === CANON_SERVICE || t === CANON_AISERVICE;

  const isDataLike = (t) => t === CANON_DATAPROVIDER || t === CANON_DATASET;
  const isProcessLike = (t) => t === CANON_PROCESS || t === CANON_AIPROCESS;

  const isLegacyTarget = (t) => isDataLike(t) || isProcessLike(t);
  const isLegacySource = (t) => isApplicationLike(t) || isServiceLike(t);

  for (const e of canonEdges) {
    if (!e?.from || !e?.to) continue;

    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    if (!from || !to) continue;

    // ✅ IdentityProvider rule: allowed to be CONTAINED, but must not have Invocation/Legacy/Trust
    if (from.type === CANON_IDP || to.type === CANON_IDP) {
      if (e.type === CANON_CONTAINS) {
        // allow Realm -> IdentityProvider
      } else {
        errors.push(
          `IdentityProvider must not participate in ${CANON_INVOCATION}/${CANON_LEGACY}/${CANON_TRUST} (got ${e.type}: ${from.type} -> ${to.type}).`
        );
      }
      continue;
    }

    // Trust: Realm -> Realm
    if (e.type === CANON_TRUST) {
      if (!(from.type === CANON_REALM && to.type === CANON_REALM)) {
        errors.push(`Trust must be ${CANON_REALM} -> ${CANON_REALM} (got ${from.type} -> ${to.type}).`);
      }
    }

    // Invocation rules
    if (e.type === CANON_INVOCATION) {
      const ok =
        (isApplicationLike(from.type) && isServiceLike(to.type)) ||
        (isServiceLike(from.type) && isServiceLike(to.type));

      if (!ok) {
        errors.push(
          `Invocation must be Application/AIApplication -> Service/AIService OR Service/AIService -> Service/AIService (got ${from.type} -> ${to.type}).`
        );
      }
    }

    // ✅ Legacy rules (now includes DataProvider + Dataset + ProcessingUnit + AIProcess)
    if (e.type === CANON_LEGACY) {
      if (!(isLegacySource(from.type) && isLegacyTarget(to.type))) {
        errors.push(
          `Legacy must be Application/AIApplication/Service/AIService -> DataProvider/Dataset/ProcessingUnit/AIProcess (got ${from.type} -> ${to.type}).`
        );
      }
    }

    // Contains: Realm -> any allowed node type
    if (e.type === CANON_CONTAINS) {
      const toAllowed = WAM_NODE_TYPES.includes(to.type);
      if (!(from.type === CANON_REALM && toAllowed)) {
        errors.push(`Contains must be ${CANON_REALM} -> element (got ${from.type} -> ${to.type}).`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateDiagram };
