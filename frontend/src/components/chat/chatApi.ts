// basic units for the diagram canvas
export type WamNode = { id: string; type: string; name?: string };
export type WamEdge = { type: string; from: string; to: string };

// what we keep in the chat history
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// the shape we expect back from our backend ai service
export type AiChatResponse = {
  reply: string;
  meta?: Record<string, unknown>;
  questions?: string[];
  diagram?: { nodes: WamNode[]; edges: WamEdge[] };
  validation?: { valid: boolean; errors: string[] };
};

// hook up to the backend, fall back to localhost if env goes missing
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "http://localhost:5000";

type SendChatPayload = {
  messages: ChatMessage[];
  context?: {
    lastDiagram?: { nodes: WamNode[]; edges: WamEdge[] };
    lastValidation?: { valid: boolean; errors: string[] };
  };
};

// standard text-based chat message
export async function sendChatMessage(payload: SendChatPayload): Promise<AiChatResponse> {
  const token = localStorage.getItem("auth-token");
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "auth-token": token } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat API failed (${res.status}): ${text}`);
  }

  return res.json();
}

// asks the ai to fix rule violations on the current diagram
export async function repairDiagram(payload: {
  userPrompt: string;
  diagram: { nodes: WamNode[]; edges: WamEdge[] };
  errors: string[];
}): Promise<AiChatResponse> {
  const token = localStorage.getItem("auth-token");
  const res = await fetch(`${API_BASE}/api/ai/repair`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "auth-token": token } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Repair API failed (${res.status}): ${text}`);
  }

  return res.json();
}

// uploads a screenshot for the vision model to process into a diagram
export async function sendImageToDiagram(payload: {
  imageDataUrl: string;
  userPrompt?: string;
  context?: {
    lastDiagram?: { nodes: WamNode[]; edges: WamEdge[] };
    lastValidation?: { valid: boolean; errors: string[] };
  };
}): Promise<AiChatResponse> {
  const token = localStorage.getItem("auth-token");
  const res = await fetch(`${API_BASE}/api/ai/image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "auth-token": token } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image API failed (${res.status}): ${text}`);
  }

  return res.json();
}
