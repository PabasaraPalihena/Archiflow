// backend/models/ai/ai.service.js

const openaiProvider = require("./providers/openai.provider");
const { validateDiagram } = require("../wam/wam.validator");

// strict json parsing block

function parseJsonStrict(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Model returned empty response.");
  }

  let text = rawText.trim();

  // strip accidental code fences in case the llm spits them out
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  text = text.replace(/```$/g, "").trim();

  return JSON.parse(text);
}

function clampQuestions(qs, max = 2) {
  const arr = Array.isArray(qs) ? qs.filter(Boolean) : [];
  return arr.slice(0, max);
}

function edgeKey(e) {
  return `${e.type}:${e.from}->${e.to}`;
}

function hasNoInteractionEdges(diagram) {
  const edges = Array.isArray(diagram?.edges) ? diagram.edges : [];
  return edges.filter((e) => ["Invocation", "Legacy", "Trust"].includes(e?.type)).length === 0;
}

function hasEnoughNodes(diagram) {
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  const nonRealm = nodes.filter((n) => n?.type && n.type !== "Realm");
  return nonRealm.length >= 2;
}

// secondary safety checks to prevent false positive validations

function sanityCheckDiagram(diagram) {
  const errors = [];
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram?.edges) ? diagram.edges : [];

  const byId = new Map(nodes.map((n) => [n.id, n]));

  const isAppLike = (t) => t === "Application" || t === "AIApplication";
  const isServiceLike = (t) => t === "Service" || t === "AIService";
  const isLegacyTarget = (t) =>
    t === "DataProvider" || t === "Dataset" || t === "ProcessingUnit" || t === "AIProcess";

  for (const e of edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) continue;

    if (e.type === "Invocation") {
      // add a useful hint if the target is legacy so it doesn't just fail vaguely
      if (isLegacyTarget(to.type)) {
        errors.push(
          `Invocation cannot target ${to.type}. Use Legacy for data/process access (got ${from.type} -> ${to.type}).`
        );
      }
    }

    if (e.type === "Trust") {
      if (!(from.type === "Realm" && to.type === "Realm")) {
        errors.push(`Trust must be Realm -> Realm (got ${from.type} -> ${to.type}).`);
      }
    }
  }

  return errors;
}

// auto correct backwards legacy edges from data/process to apps
function autoFixLegacyDirections(diagram) {
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram?.edges) ? diagram.edges : [];

  const byId = new Map(nodes.map((n) => [n.id, n]));

  const isAppOrService = (t) =>
    t === "Application" || t === "AIApplication" || t === "Service" || t === "AIService";
  const isDataOrProcess = (t) =>
    t === "DataProvider" || t === "Dataset" || t === "ProcessingUnit" || t === "AIProcess";

  const fixedEdges = edges.map((e) => {
    if (e.type !== "Legacy") return e;

    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) return e;

    // if legacy runs from data/process back to app/service, flip it
    if (isDataOrProcess(from.type) && isAppOrService(to.type)) {
      return { ...e, from: e.to, to: e.from };
    }

    return e;
  });

  return { ...diagram, edges: fixedEdges };
}

// output simple text explanations, ditch markdown to keep it clean

const TYPE_LABEL = {
  Realm: "Security realm",
  Application: "Application",
  Service: "Service",
  IdentityProvider: "Identity provider",
  DataProvider: "Data store",
  ProcessingUnit: "Processing unit",
  Dataset: "Dataset",
  AIApplication: "AI application",
  AIService: "AI service",
  AIProcess: "AI process",
};

function typeLabel(t) {
  return TYPE_LABEL[t] || String(t || "Element");
}

function pluralize(word, n) {
  return n === 1 ? word : `${word}s`;
}

function summarizeTypes(nodes) {
  const counts = new Map();
  for (const n of nodes) {
    const label = typeLabel(n.type);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const parts = [];
  for (const [label, n] of counts.entries()) {
    parts.push(`${n} ${pluralize(label, n)}`);
  }
  return parts.length ? parts.join(", ") : "no components";
}

function buildHumanExplanation(diagram) {
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram?.edges) ? diagram.edges : [];
  if (nodes.length === 0) return "";

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const realms = nodes.filter((n) => n.type === "Realm");

  const contains = edges.filter((e) => e.type === "Contains");
  const invocations = edges.filter((e) => e.type === "Invocation");
  const legacies = edges.filter((e) => e.type === "Legacy");
  const trusts = edges.filter((e) => e.type === "Trust");

  // map realms to contents
  const realmToChildren = new Map();
  const nestedRealmIds = new Set(); // Track realms that are inside other realms
  for (const e of contains) {
    if (!realmToChildren.has(e.from)) realmToChildren.set(e.from, []);
    realmToChildren.get(e.from).push(e.to);
    // Check if this is a realm containing another realm
    const targetNode = byId.get(e.to);
    if (targetNode?.type === "Realm") {
      nestedRealmIds.add(e.to);
    }
  }

  const lines = [];

  // Security boundary
  lines.push("🔒 Security Boundaries");
  if (realms.length === 0) {
    lines.push("   No security realm detected.");
  } else {
    const sortedRealms = [...realms].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    sortedRealms.forEach((r, idx) => {
      const realmName = r.name && r.name.trim() ? r.name : `Realm ${idx + 1}`;
      const childIds = realmToChildren.get(r.id) || [];
      const childNodes = childIds.map((id) => byId.get(id)).filter(Boolean);

      // track nested realms separately
      const nestedRealms = childNodes.filter(n => n.type === "Realm");
      const regularElements = childNodes.filter(n => n.type !== "Realm");

      let description = "";
      if (regularElements.length > 0) {
        description += summarizeTypes(regularElements);
      }
      if (nestedRealms.length > 0) {
        const nestedNames = nestedRealms.map(r => r.name || "nested realm").join(", ");
        if (description) description += ` + ${nestedNames}`;
        else description = nestedNames;
      }

      const isNested = nestedRealmIds.has(r.id);
      const prefix = isNested ? "   ↳ " : "   ";
      lines.push(`${prefix}${realmName} contains: ${description || "no components"}.`);
    });
  }

  // relations block
  lines.push("");
  lines.push("🔗 Relationships");



  const relLines = [];

  for (const e of invocations) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    relLines.push(`   • ${typeLabel(a.type)} invokes ${typeLabel(b.type)}`);
  }

  for (const e of legacies) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    relLines.push(`   • ${typeLabel(a.type)} uses ${typeLabel(b.type)} (Legacy)`);
  }

  for (const e of trusts) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    relLines.push(`   • ${typeLabel(a.type)} trusts ${typeLabel(b.type)}`);
  }

  if (relLines.length === 0) lines.push("   No relationships detected.");
  else lines.push(...relLines);

  // notes block
  const idps = nodes.filter((n) => n.type === "IdentityProvider");
  lines.push("");
  lines.push("📝 Notes");
  if (idps.length > 0) {
    lines.push("   Identity Provider detected. By WAM rules, Identity Providers must not have Invocation/Legacy/Trust edges (only Contains is allowed).");
  } else {
    lines.push("   All elements follow standard WAM rules.");
  }

  return lines.join("\n");
}

function buildChangeSummary(beforeDiagram, afterDiagram) {
  const beforeEdges = new Set((beforeDiagram?.edges || []).map(edgeKey));
  const afterEdges = new Set((afterDiagram?.edges || []).map(edgeKey));

  const removed = [];
  const added = [];

  for (const k of beforeEdges) if (!afterEdges.has(k)) removed.push(k);
  for (const k of afterEdges) if (!beforeEdges.has(k)) added.push(k);

  if (removed.length === 0 && added.length === 0) return "";

  const lines = [];
  lines.push("What changed");
  if (removed.length > 0) {
    lines.push("• Removed:");
    for (const r of removed) lines.push(`  - ${r}`);
  }
  if (added.length > 0) {
    lines.push("• Added:");
    for (const a of added) lines.push(`  - ${a}`);
  }
  return lines.join("\n");
}

function replyWithExplanation(baseReply, diagram, title = "Summary") {
  const explanation = buildHumanExplanation(diagram);
  if (!explanation) return baseReply;
  return `${baseReply}\n\n${title}\n${explanation}`;
}

// formatting chat replies

function buildReplyFromValidation(validation, diagram) {
  if (validation.valid) {
    return replyWithExplanation(
      "✅ Great! Your diagram is valid and ready to use.\n\n" +
      "Click 'Apply diagram to canvas' to see it visualized.",
      diagram,
      "Here's what I created"
    );
  }

  const humanizedErrors = (validation.errors || []).map(humanizeError);
  const base =
    "⚠️ I found a few issues with the diagram:\n\n" +
    humanizedErrors.map((e) => `   • ${e}`).join("\n") +
    "\n\n🔧 No worries! Click 'Fix diagram' and I'll repair it for you.";

  return replyWithExplanation(base, diagram, "Current diagram");
}

// drop technical details like internal mappings from validation errs
function humanizeError(error) {
  // trim trailing parens
  const cleaned = error.replace(/\s*\(got [^)]+\)\s*\.?$/, "");

  // If the cleaned message ends with a period, keep it; otherwise add one
  return cleaned.endsWith(".") ? cleaned : cleaned + ".";
}

function buildReplyForImage(validation, diagram) {
  if (validation.valid) {
    const base =
      "✅ Perfect! I've extracted your diagram and it's valid.\n\n" +
      "Everything looks good! Click 'Apply to canvas' to visualize it.";
    return replyWithExplanation(base, diagram, "Here's what I found");
  }

  const humanizedErrors = (validation.errors || []).map(humanizeError);
  const base =
    "📷 I've extracted your diagram, but found a few issues:\n\n" +
    humanizedErrors.map((e) => `   • ${e}`).join("\n") +
    "\n\n🔧 No problem! Click 'Fix diagram' and I'll make it valid.";

  return replyWithExplanation(base, diagram, "What I extracted");
}

// ---- main service functions ----

async function chat(messages, context = {}) {
  const lastUser = [...messages].reverse().find((m) => m?.role === "user")?.content ?? "";

  const hasLastDiagram =
    context && typeof context === "object" && context.lastDiagram && typeof context.lastDiagram === "object";

  const looksLikeExplain =
    typeof lastUser === "string" && /\b(explain|why|what|how|clarify|describe)\b/i.test(lastUser);

  // explain existing diagram if asked to
  if (hasLastDiagram && looksLikeExplain) {
    return explain(lastUser, context.lastDiagram, context.lastValidation);
  }

  // if they ask to explain without a diagram, gracefully fail
  if (!hasLastDiagram && looksLikeExplain && !/\b(create|build|make|generate|draw)\b/i.test(lastUser)) {
    return {
      reply: "💡 I'd be happy to explain a diagram! Please either:\n\n1. Upload a diagram image, or\n2. Ask me to create a diagram first (e.g., 'Create a diagram with an app and database')\n\nThen I can explain it to you!",
      meta: { provider: "openai", mode: "explanation-only", explanationOnly: true },
      questions: [],
      diagram: { nodes: [], edges: [] },
      validation: { valid: true, errors: [] },
    };
  }

  const { text, model } = await openaiProvider.generateDiagram(messages);

  let parsed;
  try {
    parsed = parseJsonStrict(text);
  } catch (err) {
    return {
      reply: "❌ I couldn't parse the AI output as JSON. Try rephrasing your request.",
      meta: { provider: "openai", model, parseError: true, mode: "diagram" },
      raw: text,
      questions: [],
      diagram: { nodes: [], edges: [] },
      validation: { valid: false, errors: ["AI output was not valid JSON."] },
    };
  }

  const diagram = parsed?.diagram ?? { nodes: [], edges: [] };
  const needsClarification = Boolean(parsed?.needs_clarification);
  const questions = clampQuestions(parsed?.questions, 2);

  if (needsClarification && questions.length > 0) {
    // construct follow-up questions
    const questionText = questions.map((q, i) => `${q}`).join("\n\n");
    const hasMultipleQuestions = questions.length > 1 || /\b[123]\.\s/.test(questionText);

    let replyPrompt;
    if (hasMultipleQuestions) {
      replyPrompt = "💬 Please answer each question (one answer per line) and I'll continue!";
    } else {
      replyPrompt = "💬 Just type your answer and I'll continue!";
    }

    const replyBase =
      "🤔 Quick question:\n\n" +
      questionText +
      "\n\n" + replyPrompt;

    return {
      reply: replyWithExplanation(
        replyBase,
        diagram,
        "What I've understood so far"
      ),
      meta: { provider: "openai", model, needsClarification: true, mode: "diagram" },
      questions,
      diagram,
      validation: { valid: false, errors: ["Awaiting clarification before generating a diagram."] },
    };
  }

  // main validation + safety sanity-check
  const validation = validateDiagram(diagram);
  const sanityErrors = sanityCheckDiagram(diagram);

  // dedupe validation errors favoring the custom sanity ones
  const edgePattern = /\(got ([^)]+)\)/;
  const sanityEdges = new Set(sanityErrors.map(e => {
    const match = e.match(edgePattern);
    return match ? match[1] : null;
  }).filter(Boolean));

  const filteredValidatorErrors = (validation.errors || []).filter(e => {
    const match = e.match(edgePattern);
    return !(match && sanityEdges.has(match[1]));
  });

  const allErrors = [...filteredValidatorErrors, ...sanityErrors];
  const uniqErrors = [...new Set(allErrors)];

  const mergedValidation = uniqErrors.length
    ? { valid: false, errors: uniqErrors }
    : { valid: true, errors: [] };

  return {
    reply: buildReplyFromValidation(mergedValidation, diagram),
    meta: { provider: "openai", model, needsClarification: false, mode: "diagram" },
    questions: [],
    diagram,
    validation: mergedValidation,
  };
}

// handle img uploads to diagrams, fall back to a 2nd pass if relations missing
async function imageToDiagram(imageDataUrl, userPrompt = "", context = {}) {
  const { text, model } = await openaiProvider.generateDiagramFromImage(imageDataUrl, userPrompt);

  let parsed;
  try {
    parsed = parseJsonStrict(text);
  } catch (err) {
    return {
      reply: "❌ I couldn't parse the AI output as JSON from the image. Please upload a clearer screenshot.",
      meta: { provider: "openai", model, parseError: true, mode: "image-diagram" },
      raw: text,
      questions: [],
      diagram: { nodes: [], edges: [] },
      validation: { valid: false, errors: ["AI output was not valid JSON."] },
    };
  }

  let diagram = parsed?.diagram ?? { nodes: [], edges: [] };
  let needsClarification = Boolean(parsed?.needs_clarification);
  let questions = clampQuestions(parsed?.questions, 2);

  // log extraction results
  console.log("\n=== IMAGE EXTRACTION DEBUG ===");
  console.log("Nodes detected:", JSON.stringify(diagram.nodes, null, 2));
  console.log("Edges detected:", JSON.stringify(diagram.edges, null, 2));
  console.log("==============================\n");

  // if there are nodes but no edges, force another pass focusing on generating edges
  if (!needsClarification && hasEnoughNodes(diagram) && hasNoInteractionEdges(diagram)) {
    const secondPassNote =
      (userPrompt ? userPrompt + "\n\n" : "") +
      "SECOND PASS (edge-focused): Extract ONLY arrows/relationships. " +
      "Return all relationships even across realm boundaries. " +
      "If arrow is unlabeled: use Legacy when target is Dataset/DataProvider/ProcessingUnit/AIProcess; otherwise Invocation. " +
      "If labeled Trust between realms, output Trust (Realm -> Realm). " +
      "Return STRICT JSON in the same schema. Ask questions ONLY if arrow direction is impossible.";

    const { text: text2 } = await openaiProvider.generateDiagramFromImage(imageDataUrl, secondPassNote);

    try {
      const parsed2 = parseJsonStrict(text2);
      const diagram2 = parsed2?.diagram ?? { nodes: [], edges: [] };
      const needs2 = Boolean(parsed2?.needs_clarification);

      if (!needs2 && hasEnoughNodes(diagram2) && !hasNoInteractionEdges(diagram2)) {
        const v2 = validateDiagram(diagram2);
        const sanity2 = sanityCheckDiagram(diagram2);
        const merged2 = sanity2.length ? { valid: false, errors: [...(v2.errors || []), ...sanity2] } : v2;

        return {
          reply: buildReplyForImage(merged2, diagram2),
          meta: { provider: "openai", model, needsClarification: false, mode: "image-diagram" },
          questions: [],
          diagram: diagram2,
          validation: merged2,
        };
      }

      diagram = diagram2;
      needsClarification = needs2;
      questions = clampQuestions(parsed2?.questions, 2);
    } catch {
      // ignore, continue
    }
  }

  if (needsClarification) {
    return {
      reply: replyWithExplanation(
        "I can read the components, but I need one or two quick confirmations about the arrows.",
        diagram,
        "What I understood so far"
      ),
      meta: { provider: "openai", model, needsClarification: true, mode: "image-diagram" },
      questions,
      diagram,
      validation: { valid: false, errors: ["Awaiting clarification before finalizing the diagram."] },
    };
  }

  const validation = validateDiagram(diagram);
  const sanityErrors = sanityCheckDiagram(diagram);

  // log validation info
  console.log("\n=== VALIDATION DEBUG ===");
  console.log("Validator errors:", JSON.stringify(validation.errors, null, 2));
  console.log("Sanity errors:", JSON.stringify(sanityErrors, null, 2));
  console.log("========================\n");

  // Smart deduplication: if sanity check has a better message for the same edge, use that instead
  // Extract edge patterns like "(got AIService -> ProcessingUnit)" to identify duplicate errors
  const edgePattern = /\(got ([^)]+)\)/;
  const sanityEdges = new Set(sanityErrors.map(e => {
    const match = e.match(edgePattern);
    return match ? match[1] : null;
  }).filter(Boolean));

  // remove baseline validator errors if we already got a good sanity check out of it
  const filteredValidatorErrors = (validation.errors || []).filter(e => {
    const match = e.match(edgePattern);
    if (match && sanityEdges.has(match[1])) {
      return false; // Sanity check has a better message for this edge
    }
    return true;
  });

  // Combine: filtered validator errors + all sanity errors
  const allErrors = [...filteredValidatorErrors, ...sanityErrors];
  const uniqErrors = [...new Set(allErrors)];

  const mergedValidation = uniqErrors.length
    ? { valid: false, errors: uniqErrors }
    : { valid: true, errors: [] };

  return {
    reply: buildReplyForImage(mergedValidation, diagram),
    meta: { provider: "openai", model, needsClarification: false, mode: "image-diagram" },
    questions: [],
    diagram,
    validation: mergedValidation,
  };
}

async function repair(userPrompt, diagram, errors) {
  const before = diagram ?? { nodes: [], edges: [] };

  const { text, model } = await openaiProvider.repairDiagram(userPrompt, before, errors);

  let parsed;
  try {
    parsed = parseJsonStrict(text);
  } catch (err) {
    return {
      reply: "❌ I tried to repair the diagram, but the AI response was not valid JSON. Please try again.",
      meta: { provider: "openai", model, parseError: true, mode: "diagram" },
      raw: text,
      diagram: before,
      validation: { valid: false, errors: ["Repair output was not valid JSON."] },
    };
  }

  const repaired = parsed?.diagram ?? { nodes: [], edges: [] };
  const validation = validateDiagram(repaired);
  const sanityErrors = sanityCheckDiagram(repaired);

  // dedupe errors favoring custom sanity messages
  const edgePattern = /\(got ([^)]+)\)/;
  const sanityEdges = new Set(sanityErrors.map(e => {
    const match = e.match(edgePattern);
    return match ? match[1] : null;
  }).filter(Boolean));

  const filteredValidatorErrors = (validation.errors || []).filter(e => {
    const match = e.match(edgePattern);
    return !(match && sanityEdges.has(match[1]));
  });

  const allErrors = [...filteredValidatorErrors, ...sanityErrors];
  const uniqErrors = [...new Set(allErrors)];

  const mergedValidation = uniqErrors.length
    ? { valid: false, errors: uniqErrors }
    : { valid: true, errors: [] };

  const base = mergedValidation.valid
    ? "✅ I fixed the diagram to satisfy WAM rules."
    : "❌ I attempted a fix, but validation still fails:\n" + mergedValidation.errors.map((e) => `• ${e}`).join("\n");

  const changes = buildChangeSummary(before, repaired);
  const reply = changes
    ? `${base}\n\n${changes}\n\n${replyWithExplanation("", repaired, "Explanation").trim()}`
    : replyWithExplanation(base, repaired, "Explanation");

  return {
    reply,
    meta: { provider: "openai", model, repaired: true, mode: "diagram" },
    diagram: repaired,
    validation: mergedValidation,
  };
}

async function explain(question, lastDiagram, lastValidation) {
  const q = typeof question === "string" ? question.trim() : "";

  const safeDiagram = lastDiagram && typeof lastDiagram === "object" ? lastDiagram : { nodes: [], edges: [] };

  const safeValidation =
    lastValidation && typeof lastValidation === "object" ? lastValidation : { valid: true, errors: [] };

  console.log("\n=== EXPLAIN CALLED ===");
  console.log("Question:", q);
  console.log("Diagram nodes:", safeDiagram.nodes?.length || 0);
  console.log("======================\n");

  const { text, model } = await openaiProvider.explainDiagram(q, safeDiagram);

  console.log("\n=== EXPLAIN RESPONSE ===");
  console.log("Text length:", text?.length || 0);
  console.log("First 100 chars:", text?.substring(0, 100));
  console.log("========================\n");

  return {
    reply: text || replyWithExplanation("Here’s the diagram explanation:", safeDiagram, "Explanation"),
    meta: { provider: "openai", model, mode: "explain", needsClarification: false },
    questions: [],
    // Don't include diagram/validation to render as plain text
  };
}

module.exports = { chat, repair, explain, imageToDiagram };
