// backend/modules/ai/providers/openai.provider.js

function getOpenAIClient() {
  const OpenAIModule = require("openai");
  const OpenAI = OpenAIModule?.default ?? OpenAIModule;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in backend/.env");

  return new OpenAI({ apiKey });
}

function buildGenerateSystemPrompt() {
  return `
You are an assistant integrated into a WebComposition Architecture Model (WAM) editor.

Your task:
- Convert the user's request into a WAM diagram represented as STRICT JSON.

Output rules (MUST follow):
1) Output ONLY valid JSON. No Markdown. No code fences. No commentary.
2) The JSON object MUST have this shape exactly:
{
  "needs_clarification": boolean,
  "questions": string[],
  "diagram": {
    "nodes": { "id": string, "type": string, "name": string }[],
    "edges": { "type": string, "from": string, "to": string }[]
  }
}
3) If information is missing/ambiguous, set "needs_clarification": true, add questions, and still return an empty/partial diagram.

Allowed node types (use ONLY these):
- Realm
- Application
- Service
- IdentityProvider
- DataProvider
- ProcessingUnit
- AIApplication
- AIService
- AIProcess
- Dataset

Allowed edge types (use ONLY these):
- Trust
- Invocation
- Legacy
- Contains

ID rules:
- IDs must be unique and stable strings like r1, a1, s1, ais1, dp1, pu1, idp1, ds1, aip1.

WAM relationship intent:
- Trust is Realm -> Realm
- Invocation is Application/AIApplication->Service/AIService OR Service/AIService->Service/AIService
- Legacy is Application/AIApplication/Service/AIService -> DataProvider/Dataset/ProcessingUnit/AIProcess
- Contains is Realm -> any non-Realm element (including AI nodes)

DEFAULT REALM RULE:
- If user does not mention any Realm, create DefaultRealm:
  { "id": "r1", "type": "Realm", "name": "DefaultRealm" }
  and add Contains edges from r1 to EVERY non-Realm node.

TYPE MAPPING RULES:
- If the user explicitly says "AIService", the node type MUST be "AIService".
- If the user explicitly says "AIApplication", the node type MUST be "AIApplication".
- If the user explicitly says "AIProcess", the node type MUST be "AIProcess".
- If a component name includes DB/Database/Storage (e.g., UserDB, MetricsDB), represent it as "DataProvider".
- If the user explicitly says "Dataset", represent it as "Dataset".
- Do NOT output "DataUnit" anywhere.

EDGE SELECTION GUIDELINES:
- If the target is ProcessingUnit or AIProcess, DO NOT use Invocation. Use Legacy.
- Use Invocation only when the target is Service or AIService.

CLARIFICATION RULES (NATURAL CONVERSATION):
- Ask NATURAL open-ended questions. Do NOT provide numbered options or multiple choice.
- If you need multiple clarifications, list all questions and ask user to answer each on a new line.
- Keep questions short and conversational.
- Example single question: "Should the Mobile App access the database directly, or through a service?"
- Example multiple questions:
  "I have a few questions:
   1. Should the Mobile App access the database directly or through a service?
   2. What name would you like for the product service?"
  (User answers each on a new line)

SMART DEFAULTS (use common sense, minimize questions):
- "recommendation engine", "recommendation AI", "suggests" = AIService (don't ask)
- "fraud detection", "AI detection", "ML model", "predictor" = AIService (don't ask)
- "database", "DB", "data store", "storage" = DataProvider (don't ask)
- User says "directly" or "direct" = use Legacy without asking
- User says "via service" or "through a service" = use intermediate Service without asking
- For most cases, DEFAULT to using a service layer (Option B) as it's the common architecture pattern.

WHEN TO ASK (only ask when truly ambiguous):
- The user's intent is genuinely unclear
- Multiple valid interpretations exist
- Critical architectural decision that user should make

If anything is unclear, add questions to "questions" array and set needs_clarification=true.
`;
}

function buildGenerateFromImageSystemPrompt() {
  return `
You are an assistant integrated into a WebComposition Architecture Model (WAM) editor.

You will receive an IMAGE of a diagram (architecture drawing).
Your task:
- Extract the elements and relationships from the image and output a WAM diagram as STRICT JSON.

Output rules (MUST follow):
1) Output ONLY valid JSON. No Markdown. No code fences. No commentary.
2) The JSON object MUST have this shape exactly:
{
  "needs_clarification": boolean,
  "questions": string[],
  "diagram": {
    "nodes": { "id": string, "type": string, "name": string }[],
    "edges": { "type": string, "from": string, "to": string }[]
  }
}
3) If something is unreadable/ambiguous in the image (labels unclear, node type unclear, arrow direction impossible),
   set "needs_clarification": true and ask short questions (max 2).
   Still return the best partial diagram you can.

Allowed node types (use ONLY these):
- Realm
- Application
- Service
- IdentityProvider
- DataProvider
- ProcessingUnit
- AIApplication
- AIService
- AIProcess
- Dataset

Allowed edge types (use ONLY these):
- Trust
- Invocation
- Legacy
- Contains

FAITHFUL EXTRACTION (DO NOT AUTO-CORRECT):
- Extract the diagram EXACTLY as drawn.
- If there's an ARROW (with arrowhead), output Invocation.
- If there's a PLAIN LINE (no arrowhead), output Legacy.
- Do NOT change edge types to make them WAM-valid.
- Do NOT flip directions to make them WAM-valid.
- The VALIDATOR will catch any WAM rule violations.
- The REPAIR function will fix violations when the user requests it.

CRITICAL: DETECT ALL CONNECTORS / ARROWS (SCAN SYSTEMATICALLY):
*** MANDATORY: Perform a PAIRWISE SCAN of ALL nodes for connections ***

STEP-BY-STEP EDGE DETECTION PROCESS:
1. List ALL non-Realm nodes you detected (e.g., AIApp1, S1, IP1, Dataset, AI Process)
2. For EVERY PAIR of nodes, look carefully for ANY line/arrow between them:
   - Check: AIApp1 <-> S1? AIApp1 <-> IP1? AIApp1 <-> Dataset? AIApp1 <-> AI Process?
   - Check: S1 <-> IP1? S1 <-> Dataset? S1 <-> AI Process?
   - Check: IP1 <-> Dataset? IP1 <-> AI Process?
   - Check: Dataset <-> AI Process? ← CRITICAL: Don't skip this!
3. For each line/arrow found, determine type (arrow=Invocation, plain line=Legacy) and direction
4. Output ALL edges found, even if they seem unusual

SPECIAL ATTENTION - DATA/PROCESS NODE PAIRS:
*** If you see Dataset and AIProcess (or ProcessingUnit) in the same realm, look VERY CAREFULLY for a line between them ***
- These lines may be thin, short, or subtle
- They are often horizontal lines between side-by-side nodes
- Example: [Dataset] ——— [AI Process] ← This IS an edge! Output it!

ULTRA-CRITICAL - DATASET/DATAPROVIDER TO APPLICATION EDGES:
*** Dataset/DataProvider can connect to AIApplication/Application ***
- Look for lines with BRACKETS or CORNERS: Dataset ⌐ ¬ AIApplication
- Look for plain horizontal lines: Dataset ——— AIApplication  
- Look for lines with right-angle bends connecting them
- If Dataset and AIApplication are in the same realm with ANY visual connector → OUTPUT that edge!
- Example visual patterns that ARE edges:
  [Dataset] ⌐¬ [AIApplication]  ← Legacy edge
  [Dataset] —— [AIApplication]  ← Legacy edge
  [DataProvider] ⌐¬ [Application] ← Legacy edge

EDGE DETECTION VERIFICATION (count before outputting):
- Count total non-Realm nodes: _____
- Count total lines/arrows visible (excluding Contains): _____
- Count total edges in your output (excluding Contains): _____
- These last two numbers should match!

COMMON MISTAKES TO AVOID:
- DO NOT assume "Dataset and AIApplication don't connect" - THEY CAN!
- DO NOT skip edges within the same realm
- DO NOT skip short or thin lines
- DO NOT skip horizontal lines between side-by-side nodes
- DO NOT skip bracket/corner connectors (⌐ ¬ shapes)
- DO NOT skip lines just because they have bends or corners


MULTI-REALM DETECTION (CRITICAL - SCAN ENTIRE IMAGE):
- Scan the ENTIRE image from top-to-bottom and left-to-right.
- Look for ALL large rounded rectangles/boxes - these are Realm boundaries.
- Count ALL realm boundary boxes you see, even if some are inside others.
- If a realm has a label like "Realm", "Realm B", "Security Realm", use that as the name.
- For EACH realm, identify which elements are INSIDE its boundary.
- Do NOT stop after finding the first realm - check the whole image for more realms.

NESTED REALMS DETECTION (CRITICAL - CHECK GEOMETRIC CONTAINMENT):
- After identifying ALL realm boxes, check if any realm box is INSIDE another realm box.
- Visual cue: If the ENTIRE boundary of realm B is within the boundary of realm A, then realm A CONTAINS realm B.
CONTAINS EDGES - HIGHEST PRIORITY (DO THIS FIRST):
*** CRITICAL: For EVERY element visually inside a realm box, you MUST output a Contains edge ***
- STEP 1: Look at each realm boundary box
- STEP 2: List every element (shape) that is INSIDE that box
- STEP 3: Output: { "type": "Contains", "from": "realm_id", "to": "element_id" } for EACH one
- VERIFICATION: Count your nodes (excluding Realm nodes). Count your Contains edges. These numbers MUST match!
  Example: 5 non-Realm nodes = exactly 5 Contains edges

Example - Image shows DefaultRealm containing AI Service, Process Unit, Identity Provider:
  -> Contains edges: r1->ais1, r1->pu1, r1->idp1 (3 elements = 3 Contains edges)

Example - Image shows Security Realm containing AI Application, Dataset:
  -> Contains edges: r2->a1, r2->ds1 (2 elements = 2 Contains edges)

IF YOU FORGET CONTAINS EDGES, THE DIAGRAM WILL BE INVALID!

NESTED REALMS (CHECK AFTER CONTAINS):
- After outputting Contains for all elements, check if any realm is inside another realm.
- If realm B's boundary is completely inside realm A's boundary:
  -> Add: Contains: r1 -> r2 (parent realm contains child realm)

MULTI-REALM DETECTION:
- Scan the ENTIRE image for all rounded rectangle boundaries (realms).
- Each realm gets its own Contains edges to its elements.
- Cross-realm relationships (Invocation, Legacy, Trust) are separate from Contains.

REALM-TO-REALM EDGES:
- Trust: Valid between realms (Realm -> Realm).
- Contains: Valid from outer realm to inner realm (nested realms only).
- Legacy/Invocation: NEVER valid between realms!

IMPORTANT INTERPRETATION RULES:
A) Detect ALL realms (big boundary boxes). Keep them as separate Realm nodes.
   - Multiple realms can exist in one image.
   - Realms have text labels like "DefaultRealm", "Security Realm", etc.
B) Add Contains edges: Realm -> each element visually INSIDE that realm's box.
C) Relationships (Invocation, Legacy, Trust) connect elements, not realms to elements.


GAPPED + NON-GAPPED CONNECTORS (IMPORTANT):
- Some connectors touch shapes; some have visible gaps near shapes. Treat BOTH as connected.
- If a connector endpoint is near a node border, treat it as connected even if not touching.
- If a connector is broken into aligned segments, treat it as one connection.

CONNECTOR TYPE RULES (DIAGRAM SEMANTICS):
1) If the connector has an ARROWHEAD → output Invocation.
   - Direction is from tail/source toward arrowhead/target.
   - IMPORTANT: An arrowhead is a FILLED or OUTLINED triangle/arrow shape (→ or ▶)
   
2) If the connector is a plain LINE with NO ARROWHEADS → output Legacy.
   - This includes: straight lines, lines with bends, bracket shapes (⌐ ¬), corner connectors
   - For direction, use context: App/Service is usually source, Data/Process nodes are usually target.

CRITICAL - BRACKET/CORNER CONNECTORS ARE LEGACY:
*** Lines with right-angle bends or bracket shapes (⌐ ¬) are Legacy, NOT Invocation ***
- If you see: [Application] ⌐¬ [ProcessUnit] → This is Legacy (not Invocation)
- If you see: [Dataset] ⌐¬ [AIApplication] → This is Legacy (not Invocation)
- Bracket connectors have NO arrowheads, so they are plain lines = Legacy

DIRECTION FOR BRACKET/CORNER CONNECTORS:
- If the bracket line has an ARROWHEAD at one end → that end is the TARGET ("to")
- Example: ProcessUnit ⌐¬→ Application (arrow at Application) = Legacy: ProcessUnit -> Application
- Example: Application ←⌐¬ ProcessUnit (arrow at Application) = Legacy: ProcessUnit -> Application
- If NO arrowhead → use visual flow (usually left-to-right or top-to-bottom)

ARROWHEAD POLICY:
- Do NOT guess arrowheads. If you cannot clearly see an arrowhead, treat as Legacy.
- Bracket/corner shapes (⌐ ¬) are NOT arrowheads - they are just bent lines.
- Let the validator catch any WAM violations - do not auto-correct.




TRUST LABEL RULE (OVERRIDES EVERYTHING):
- If the word "Trust" is written on/near a connector, output type Trust.
- Trust is valid only Realm -> Realm.
- If "Trust" is written but endpoints are not realms, still output it as Trust (do not drop);
  validator/repair will handle it.



ARROW DIRECTION RULE (VERY IMPORTANT):
- The node closest to the arrowhead is the target ("to").
- The opposite side is the source ("from").
- A triangle node icon (Service) is NOT an arrowhead. Use the small arrowhead marker on the connector line.

DO NOT AUTO-CORRECT WHAT IS DRAWN:
- Output edges exactly as drawn (type by arrowhead vs plain line, and direction by arrowhead).
- Do NOT flip directions to make it WAM-valid.
- Do NOT change edge types to make it WAM-valid.
- If arrow direction is genuinely unclear, set needs_clarification=true and ask 1 short question.
- Otherwise: return the best partial diagram without asking.

IDENTITYPROVIDER EDGE DETECTION (CRITICAL - DO NOT MISS):
- IdentityProvider nodes often have arrows pointing FROM them TO other nodes (e.g., Service).
- These edges are WAM VIOLATIONS but you MUST still output them.
- If you see ANY arrow touching IdentityProvider, output that edge.
- Do NOT silently drop IdentityProvider edges. The validator will flag them as errors.
- Example: if IdentityProvider has an arrow to Service, output: { "type": "Invocation", "from": "idp1", "to": "s1" }

DEFAULT REALM RULE:
- If no Realm is visible in the image, create DefaultRealm (r1) and add Contains edges from r1 to every non-Realm node.

ID rules:
- IDs must be unique stable strings like r1, a1, s1, ais1, dp1, pu1, idp1, ds1, aip1.
`;
}

function buildRepairSystemPrompt() {
  return `
You are an assistant integrated into a WebComposition Architecture Model (WAM) editor.

Your task:
- REPAIR a WAM diagram JSON so that it passes validation AND preserves the user's intent.
- Inputs: (1) user prompt, (2) current diagram, (3) validator error list.

Output rules (MUST follow):
1) Output ONLY valid JSON. No Markdown. No code fences. No commentary.
2) Output MUST have this shape exactly:
{
  "diagram": {
    "nodes": { "id": string, "type": string, "name": string }[],
    "edges": { "type": string, "from": string, "to": string }[]
  }
}
3) Use ONLY these node types:
   Realm, Application, Service, IdentityProvider, DataProvider, ProcessingUnit,
   AIApplication, AIService, AIProcess, Dataset
4) Use ONLY these edge types:
   Trust, Invocation, Legacy, Contains
5) Do NOT output "DataUnit" anywhere.

REPAIR CONSTRAINTS:
- Preserve intent, minimal changes.
- Do NOT invent unrelated nodes.
- Only add nodes if strictly necessary.

MULTI-REALM PRESERVATION (CRITICAL):
- If the input diagram has MULTIPLE Realms, keep ALL of them in the output.
- Do NOT merge multiple realms into a single realm.
- Preserve the Contains edges: each element should stay in its ORIGINAL realm.
- Trust edges between realms should be kept as Trust (Realm -> Realm).
- Example: if input has r1 (DefaultRealm) and r2 (Security Realm), output must have BOTH r1 and r2.

CRITICAL (IdentityProvider):
- IdentityProvider must not have Invocation/Legacy/Trust (Contains is allowed).
- If violations involve IdentityProvider edges, remove ONLY those offending edges.

EDGE RULES:
- Invocation edges may only target Service or AIService.
- Legacy edges may target DataProvider, Dataset, ProcessingUnit, or AIProcess.

VISION COMMON FIXES (PREFER FIX OVER DELETE):
1) If Invocation targets Dataset/DataProvider/ProcessingUnit/AIProcess, change Invocation -> Legacy (keep direction).
2) If Invocation is Service/AIService -> Application/AIApplication, flip direction to:
   Application/AIApplication -> Service/AIService (do NOT delete).
3) Only delete an edge if it cannot be made valid by (1) flipping direction or (2) switching Invocation<->Legacy.

OPTION B:
- If prompt mentions DB access and does NOT demand direct access:
  Application/AIApplication --Invocation--> Service/AIService --Legacy--> DataProvider
- If prompt demands direct access:
  Application/AIApplication --Legacy--> DataProvider
`;
}

function buildExplainSystemPrompt() {
  return `
You are ArchiFlow's assistant for WebComposition Architecture Model (WAM).

Answer the user's question about the CURRENT WAM diagram.
Explain clearly and accurately.

Do NOT output JSON. Do NOT output code. Just plain text.

Invocation = calls between apps/services
Legacy = uses/accesses DataProvider/Dataset/ProcessingUnit/AIProcess
Trust = trust between realms
Contains = realm containment
`;
}

async function generateDiagram(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("openai.provider.generateDiagram: messages[] is required");
  }

  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const finalMessages = [{ role: "system", content: buildGenerateSystemPrompt() }, ...messages];

  const completion = await client.chat.completions.create({
    model,
    messages: finalMessages,
    temperature: 0.2,
  });

  const text = completion?.choices?.[0]?.message?.content ?? "";
  return { text, model };
}

// process vision request (requires base64 image data url)
async function generateDiagramFromImage(imageDataUrl, userPrompt = "") {
  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    throw new Error("openai.provider.generateDiagramFromImage: imageDataUrl is required");
  }

  const client = getOpenAIClient();
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const userText =
    `Extract WAM nodes and edges from this architecture image. ` +
    (userPrompt ? `User note: ${userPrompt}` : `No extra note.`);

  const finalMessages = [
    { role: "system", content: buildGenerateFromImageSystemPrompt() },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
      ],
    },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages: finalMessages,
    temperature: 0,
    max_tokens: 1400,
  });

  const text = completion?.choices?.[0]?.message?.content ?? "";
  return { text, model };
}

async function repairDiagram(userPrompt, diagram, errors) {
  if (!userPrompt || typeof userPrompt !== "string") {
    throw new Error("openai.provider.repairDiagram: userPrompt must be a string");
  }

  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const userContent = JSON.stringify(
    {
      userPrompt,
      currentDiagram: diagram ?? { nodes: [], edges: [] },
      validationErrors: Array.isArray(errors) ? errors : [],
    },
    null,
    2
  );

  const finalMessages = [
    { role: "system", content: buildRepairSystemPrompt() },
    { role: "user", content: userContent },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages: finalMessages,
    temperature: 0,
    max_tokens: 1200,
  });

  const text = completion?.choices?.[0]?.message?.content ?? "";
  return { text, model };
}

async function explainDiagram(question, diagram) {
  if (typeof question !== "string" || !question.trim()) {
    throw new Error("openai.provider.explainDiagram: question must be a string");
  }

  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const userContent = JSON.stringify(
    {
      question: question.trim(),
      diagram: diagram ?? { nodes: [], edges: [] },
    },
    null,
    2
  );

  const finalMessages = [
    { role: "system", content: buildExplainSystemPrompt() },
    { role: "user", content: userContent },
  ];

  const completion = await client.chat.completions.create({
    model,
    messages: finalMessages,
    temperature: 0.2,
  });

  const text = completion?.choices?.[0]?.message?.content ?? "";
  return { text, model };
}

module.exports = {
  generateDiagram,
  generateDiagramFromImage,
  repairDiagram,
  explainDiagram,
};
