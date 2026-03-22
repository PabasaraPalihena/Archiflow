import { useEffect, useMemo, useRef, useState } from "react";
import "./ChatWidget.css";
import MicButton from "../VoicePrompt/MicButton";

import {
  repairDiagram,
  sendChatMessage,
  sendImageToDiagram,
  type AiChatResponse,
  type ChatMessage,
  type WamEdge,
  type WamNode,
} from "./chatApi";
import StructuredMessage from "./StructuredMessage";
import archiflowIcon from "../../assets/archiflow-icon.png";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import UpgradeModal from "../Subscription/UpgradeModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

type UiRole = "user" | "assistant";

type UiAttachment = {
  kind: "image";
  dataUrl: string; // data:image/*;base64,...
  filename?: string;
} | null;

type UiMessage = {
  role: UiRole;
  content: string;
  payload?: unknown;
  attachment?: UiAttachment;
};

type ChatWidgetProps = {
  open: boolean;
  onClose: () => void;
  onApplyDiagram: (diagram: { nodes: any[]; edges: any[] }) => void;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function isValidAiPayload(x: unknown): x is AiChatResponse {
  return !!x && typeof x === "object" && x !== null && "reply" in (x as any);
}

export default function ChatWidget({
  open,
  onClose,
  onApplyDiagram,
}: ChatWidgetProps) {
  const { token, user } = useAuth();
  const [upgradeModalConfig, setUpgradeModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    feature: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    feature: "",
  });
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to ArchiFlow 👋\n\n" +
        "Describe the system or idea you want to design in simple or technical terms. " +
        "I'll guide you step by step and turn it into a validated WAM architecture diagram.\n\n" +
        "What I'll do:\n" +
        "• Ask clarification questions if something is unclear\n" +
        "• Model applications, services, AI components, data, and security realms\n" +
        "• Generate a WAM-compliant diagram (JSON)\n" +
        "• Validate the architecture and fix rule violations if needed\n\n" +
        "You can also attach a diagram image (📎). I'll extract it, validate it, and you can apply it to the canvas.\n\n" +
        "Prefer talking instead of typing? Just hit the microphone and tell me what you want to build!",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [aiUsage, setAiUsage] = useState<{
    used: number;
    limit: number | "unlimited";
    remaining: number | "unlimited";
  } | null>(null);

  // stored image awaiting send
  const [pendingImage, setPendingImage] = useState<{
    dataUrl: string;
    filename?: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // autofocus input when opened
  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  // scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, repairing]);

  const fetchUsage = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/api/ai/usage`, {
        headers: { "auth-token": token },
      });
      if (res.data.success) {
        setAiUsage(res.data);
      }
    } catch (e) {
      console.error("Usage fetch error:", e);
    }
  };

  useEffect(() => {
    if (open) fetchUsage();
  }, [open, token]);

  // auto-resize input
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const max = 140; // px
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
  }, [input, open, pendingImage]);

  const lastAssistantPayload = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.payload && isValidAiPayload(m.payload)) {
        return m.payload as AiChatResponse;
      }
    }
    return null;
  }, [messages]);

  const lastDiagram = useMemo(() => {
    const d = lastAssistantPayload?.diagram;
    if (d && Array.isArray(d.nodes) && Array.isArray(d.edges)) return d;
    return { nodes: [], edges: [] };
  }, [lastAssistantPayload]);

  const lastValidation = useMemo(() => {
    const v = lastAssistantPayload?.validation;
    if (v && typeof v.valid === "boolean" && Array.isArray(v.errors)) return v;
    return { valid: true, errors: [] };
  }, [lastAssistantPayload]);

  const lastUserPrompt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m.role === "user" &&
        (m.content?.trim() || m.attachment?.kind === "image")
      )
        return m.content ?? "";
    }
    return "";
  }, [messages]);

  async function sendTextMessage(text: string) {
    const nextMessages: UiMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages: ChatMessage[] = nextMessages
        // only send text messages to the text-chat endpoint
        .filter((m) => m.attachment == null)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const res = await sendChatMessage({
        messages: apiMessages,
        context: { lastDiagram, lastValidation },
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply ?? "OK", payload: res },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry—something went wrong. Please try again.",
          payload: { error: String(e) },
        },
      ]);
    } finally {
      setLoading(false);
      fetchUsage();
    }
  }

  async function sendImageMessage(note: string) {
    if (!pendingImage) return;

    setLoading(true);
    setInput("");

    // construct user message with img data
    const userMsg: UiMessage = {
      role: "user",
      content: note,
      attachment: {
        kind: "image",
        dataUrl: pendingImage.dataUrl,
        filename: pendingImage.filename,
      },
    };

    setMessages((prev) => [...prev, userMsg]);
    setPendingImage(null);

    try {
      const res = await sendImageToDiagram({
        imageDataUrl: userMsg.attachment!.dataUrl,
        userPrompt: note,
        context: { lastDiagram, lastValidation },
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply ?? "OK", payload: res },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry—image processing failed. Try a clearer screenshot and upload again.",
          payload: { error: String(e) },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function onSend() {
    if (loading || repairing) return;

    const text = input.trim();

    // if an image is queued, run image flow
    if (pendingImage) {
      await sendImageMessage(text);
      return;
    }

    // standard text flow
    if (!text) return;
    await sendTextMessage(text);
  }

  async function onPickImage(file: File) {
    if (loading || repairing) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setPendingImage({ dataUrl, filename: file.name });
      // allow user to type a caption after uploading
      textareaRef.current?.focus();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry—couldn't read that file. Please try another image.",
        },
      ]);
    }
  }

  async function onFixDiagram() {
    if (!lastAssistantPayload) return;

    const diagram = lastAssistantPayload.diagram ?? { nodes: [], edges: [] };
    const nodes = (diagram.nodes ?? []) as WamNode[];
    const edges = (diagram.edges ?? []) as WamEdge[];
    const errors = lastAssistantPayload.validation?.errors ?? [];

    const prompt =
      lastUserPrompt && lastUserPrompt.trim().length > 0
        ? lastUserPrompt
        : "Repair this uploaded diagram.";

    setRepairing(true);

    try {
      const res = await repairDiagram({
        userPrompt: prompt,
        diagram: { nodes, edges },
        errors,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply ?? "OK", payload: res },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I couldn't repair the diagram right now. Please try again.",
          payload: { error: String(e) },
        },
      ]);
    } finally {
      setRepairing(false);
    }
  }

  async function onExplainDiagram() {
    if (!lastAssistantPayload) {
      console.log("No lastAssistantPayload - returning early");
      return;
    }

    const diagram = lastAssistantPayload.diagram ?? { nodes: [], edges: [] };

    setExplaining(true);

    try {
      const apiMessages: ChatMessage[] = [
        { role: "user", content: "Explain this diagram to me" },
      ];

      const res = await sendChatMessage({
        messages: apiMessages,
        context: {
          lastDiagram: diagram,
          lastValidation: lastAssistantPayload.validation,
        },
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply ?? "OK", payload: res },
      ]);
    } catch (e) {
      console.error("❌ Error explaining:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry—couldn't explain the diagram. Please try again.",
          payload: { error: String(e) },
        },
      ]);
    } finally {
      setExplaining(false);
    }
  }

  if (!open) return null;

  return (
    <div className="chatOverlay" onClick={onClose}>
      <div className="chatPanel" onClick={(e) => e.stopPropagation()}>
        <div className="chatHeader">
          <div className="chatTitle">
            <img
              src={archiflowIcon}
              alt="ArchiFlow"
              className="chatTitleIcon"
            />
            ArchiFlow Assistant
          </div>

          <div className="chatHeaderRight">
            <label className="chatToggle">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(e) => setShowDetails(e.target.checked)}
              />
              Show details
            </label>

            {aiUsage && (
              <div
                className="ai-usage-badge"
                title={`Used ${aiUsage.used} / ${aiUsage.limit} prompts today`}
              >
                {aiUsage.remaining === "unlimited" ? (
                  <span className="usage-infinity">∞ prompts</span>
                ) : (
                  <span>{aiUsage.remaining} left</span>
                )}
              </div>
            )}

            <button
              className="chatClose"
              onClick={onClose}
              aria-label="Close chat"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="chatMessages">
          {messages.map((m, idx) => {
            const isAssistantWithPayload =
              m.role === "assistant" && isValidAiPayload(m.payload);

            return (
              <div
                key={idx}
                className={`chatRow ${m.role === "user" ? "right" : "left"}`}
              >
                <div className={`bubble ${m.role}`}>
                  {m.attachment?.kind === "image" && (
                    <div className="chatImageWrap">
                      <img
                        className="chatImage"
                        src={m.attachment.dataUrl}
                        alt={m.attachment.filename ?? "Uploaded diagram"}
                        onClick={() =>
                          window.open(m.attachment!.dataUrl, "_blank")
                        }
                        title="Click to open"
                      />
                      {m.attachment.filename && (
                        <div className="chatImageCaption">
                          {m.attachment.filename}
                        </div>
                      )}
                    </div>
                  )}

                  {/* render structured view for valid diagrams, but fallback for explain/clarify flows */}
                  {isAssistantWithPayload &&
                  (m.payload as AiChatResponse)?.meta?.mode !== "explain" &&
                  !(m.payload as AiChatResponse)?.meta?.needsClarification ? (
                    <StructuredMessage
                      payload={m.payload as AiChatResponse}
                      onFixDiagram={
                        lastAssistantPayload?.validation?.valid === false
                          ? () => void onFixDiagram()
                          : undefined
                      }
                      onApplyDiagram={
                        lastAssistantPayload?.validation?.valid === true &&
                        (lastAssistantPayload?.diagram?.nodes?.length ?? 0) > 0
                          ? () => onApplyDiagram(lastDiagram)
                          : undefined
                      }
                      onExplain={() => void onExplainDiagram()}
                      isFixing={repairing}
                    />
                  ) : (
                    <>
                      {/* text chat reply */}
                      {m.content && (
                        <div
                          className="chatText"
                          dangerouslySetInnerHTML={{
                            __html: m.content
                              .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                              .replace(/\n/g, "<br/>"),
                          }}
                        />
                      )}

                      {!m.content && m.attachment?.kind === "image" && (
                        <div className="chatText chatTextMuted">
                          Uploaded diagram image
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {(loading || repairing || explaining) && (
            <div className="chatRow left">
              <div className="bubble assistant">
                {repairing
                  ? "Fixing diagram…"
                  : explaining
                    ? "Generating explanation…"
                    : "Thinking…"}
              </div>
            </div>
          )}

          {showDetails && lastAssistantPayload && (
            <div className="detailsPanel">
              <div className="detailsTitle">Latest response details</div>

              <div className="section">
                <div className="sectionTitle">Validation</div>
                <div>
                  Status:{" "}
                  <span className="status">
                    {lastAssistantPayload.validation?.valid
                      ? "VALID ✅"
                      : "INVALID ❌"}
                  </span>
                </div>

                {!lastAssistantPayload.validation?.valid &&
                  (lastAssistantPayload.validation?.errors?.length ?? 0) >
                    0 && (
                    <ul className="errors">
                      {lastAssistantPayload.validation?.errors?.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
              </div>

              <div className="section">
                <div className="sectionTitle">Diagram</div>

                <div className="twoCols">
                  <div>
                    <div className="sectionTitleSmall">Nodes</div>
                    <ul className="list">
                      {(lastAssistantPayload.diagram?.nodes ?? []).map(
                        (n, i) => (
                          <li key={i}>
                            <b>{n.id}</b> : {n.type}
                            {n.name ? ` (${n.name})` : ""}
                          </li>
                        ),
                      )}
                      {(lastAssistantPayload.diagram?.nodes ?? []).length ===
                        0 && <li>No nodes</li>}
                    </ul>
                  </div>

                  <div>
                    <div className="sectionTitleSmall">Edges</div>
                    <ul className="list">
                      {(lastAssistantPayload.diagram?.edges ?? []).map(
                        (e, i) => (
                          <li key={i}>
                            {e.type}: <b>{e.from}</b> → <b>{e.to}</b>
                          </li>
                        ),
                      )}
                      {(lastAssistantPayload.diagram?.edges ?? []).length ===
                        0 && <li>No edges</li>}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="sectionTitle">Raw JSON</div>
                <pre className="rawJson">
                  {JSON.stringify(lastAssistantPayload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* footer actions */}
        <div className="chatInputBar">
          {/* active image preview */}
          {pendingImage && (
            <div className="pendingImageBar">
              <img
                src={pendingImage.dataUrl}
                alt="pending"
                className="pendingThumb"
                onClick={() => window.open(pendingImage.dataUrl, "_blank")}
                title="Click to open"
              />
              <div className="pendingMeta">
                <div className="pendingName">
                  {pendingImage.filename ?? "diagram.png"}
                </div>
                <div className="pendingHint">
                  Add a note (optional), then press Send
                </div>
              </div>
              <button
                type="button"
                className="pendingRemove"
                onClick={() => setPendingImage(null)}
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          )}

          {/* typing area */}
          <div className="chatInputPill">
            {/* image attach */}
            <label
              className="pillIconBtn"
              title="Attach diagram image"
              aria-label="Attach diagram image"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <input
                type="file"
                className="fileInput"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickImage(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            {/* user text */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder="Type a message…"
              className="chatTextarea"
              rows={1}
            />

            {/* right buttons */}
            <div className="pillActions">
              {/* voice toggle */}
              {user?.subscription?.plan === "enterprise" ? (
                <MicButton
                  onResult={(spoken) => {
                    setInput(spoken);
                    void onSend();
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="pillIconBtn"
                  title="Upgrade to Premium for Voice"
                  style={{ opacity: 0.5, cursor: "not-allowed" }}
                  onClick={() =>
                    setUpgradeModalConfig({
                      isOpen: true,
                      title: "Upgrade to Premium for Voice Prompt",
                      message:
                        "Speak directly to ArchiFlow! Voice assistants are exclusive to our Premium Plan.",
                      feature: "Voice Prompt",
                    })
                  }
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </button>
              )}

              {/* submit */}
              <button
                onClick={() => void onSend()}
                disabled={loading || repairing}
                className="pillSendBtn"
                type="button"
                aria-label="Send message"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={upgradeModalConfig.isOpen}
        onClose={() =>
          setUpgradeModalConfig((prev) => ({ ...prev, isOpen: false }))
        }
        title={upgradeModalConfig.title}
        message={upgradeModalConfig.message}
        featureName={upgradeModalConfig.feature}
      />
    </div>
  );
}
