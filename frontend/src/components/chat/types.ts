// frontend/src/components/chat/types.ts
// Type definitions for chat components and API interactions

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  // later add: context?: { diagramJson?: unknown }
};

export type ChatResponse = {
  reply: string;
  meta?: {
    model?: string;
    usage?: unknown;
  };
};
