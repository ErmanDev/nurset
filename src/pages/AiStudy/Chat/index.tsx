import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { Bot, ChevronRight, FileText, MessageCircle, Plus, RotateCcw, Send, X } from "lucide-react";
import { api } from "../../../lib/api";
import { useAsync } from "../../../hooks/useAsync";
import ConfirmDialog from "../../../components/ConfirmDialog/ConfirmDialog";
import { BackLink } from "../shared";
import AttachMenu, { type AttachKind } from "./AttachMenu";
import StudyNotesModal from "./StudyNotesModal";
import "../AiStudy.css";
import "./Chat.css";

const suggestions = [
  { label: "Explain a nursing topic", starter: "Explain this nursing topic in simple terms: " },
  { label: "Summarize my notes", starter: "Summarize my notes into key points: " },
  { label: "Help me review for a quiz", starter: "Help me review for a quiz on: " },
];

const FILE_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.txt";

interface Attachment {
  label: string;
  /** Study notes text, sent along with the message. */
  notes?: string;
}

export default function AiChat() {
  const [params, setParams] = useSearchParams();
  const { data: messages, error, setData } = useAsync(api.listChatMessages);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const handledParams = useRef(false);

  // Keep the latest message in view.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length]);

  async function send(content: string) {
    const typed = content.trim();
    if (!typed && !attachment) return;
    const body = attachment?.notes
      ? `${typed || "Please help me with these notes."}\n\n---\n${attachment.notes}`
      : typed || "Please review my attachment.";

    setSending(true);
    setSendError(null);
    try {
      const pair = await api.sendChatMessage(body, attachment?.label ?? null);
      setData((list) => [...(list ?? []), ...pair]);
      setText("");
      setAttachment(null);
    } catch (err) {
      setSendError(String(err));
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  // Links from the dashboard: ?prompt=…[&send=1] and ?attach=1
  useEffect(() => {
    if (!messages || handledParams.current) return;
    handledParams.current = true;
    const prompt = params.get("prompt");
    if (prompt && params.get("send") === "1") void send(prompt);
    else if (prompt) setText(prompt);
    if (params.get("attach") === "1") setMenuOpen(true);
    if (prompt || params.get("attach")) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  function applyStarter(starter: string) {
    setText(starter);
    requestAnimationFrame(() => {
      const el = input.current;
      el?.focus();
      el?.setSelectionRange(starter.length, starter.length);
    });
  }

  function pickAttachment(kind: AttachKind) {
    setMenuOpen(false);
    if (kind === "file") fileInput.current?.click();
    else if (kind === "image") imageInput.current?.click();
    else setNotesOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  const empty = messages !== null && messages.length === 0;

  return (
    <div className="ai-chat">
      <header className="ai-chat-head">
        <div>
          <h1 className="ai-chat-title">AI Assistant</h1>
          <BackLink to="/ai-study" />
        </div>
        {messages && messages.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setConfirmClear(true)}>
            <RotateCcw size={14} /> New chat
          </button>
        )}
      </header>

      {error && <div className="alert-error">{error}</div>}

      <div className="ai-chat-body">
        {empty && (
          <div className="ai-chat-empty">
            <span className="ai-chat-bot">
              <Bot size={44} strokeWidth={1.6} />
            </span>
            <h2>How can I help you?</h2>
            <p>Ask questions about your nursing lessons</p>
            <div className="ai-chat-suggestions">
              {suggestions.map((s) => (
                <button key={s.label} onClick={() => applyStarter(s.starter)}>
                  <MessageCircle size={16} />
                  <span>{s.label}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages?.map((m) => (
          <div key={m.id} className={`ai-msg ai-msg--${m.role}`}>
            {m.role === "assistant" && (
              <span className="ai-msg-avatar">
                <Bot size={16} />
              </span>
            )}
            <div className="ai-msg-bubble">
              {m.attachment && (
                <span className="ai-msg-attachment">
                  <FileText size={13} /> {m.attachment}
                </span>
              )}
              <p>{m.content}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="ai-msg ai-msg--assistant">
            <span className="ai-msg-avatar">
              <Bot size={16} />
            </span>
            <div className="ai-msg-bubble ai-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form className="ai-composer" onSubmit={onSubmit}>
        {sendError && <div className="alert-error">{sendError}</div>}
        {attachment && (
          <span className="ai-composer-chip">
            <FileText size={13} /> {attachment.label}
            <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">
              <X size={13} />
            </button>
          </span>
        )}
        <div className="ai-composer-row">
          <button type="button" className="ai-composer-plus" onClick={() => setMenuOpen(true)} aria-label="Add attachment">
            <Plus size={20} />
          </button>
          <textarea
            ref={input}
            rows={1}
            value={text}
            placeholder="Ask about your nursing lessons…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
          />
          <button
            type="submit"
            className="ai-composer-send"
            disabled={sending || (!text.trim() && !attachment)}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      <input
        ref={fileInput}
        type="file"
        accept={FILE_ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setAttachment({ label: f.name });
          e.target.value = "";
        }}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setAttachment({ label: f.name });
          e.target.value = "";
        }}
      />

      {menuOpen && <AttachMenu onPick={pickAttachment} onClose={() => setMenuOpen(false)} />}
      {notesOpen && (
        <StudyNotesModal
          onClose={() => setNotesOpen(false)}
          onAdd={(notes) => {
            const words = notes.trim().split(/\s+/).length;
            setAttachment({ label: `Study notes (${words} word${words === 1 ? "" : "s"})`, notes });
            setNotesOpen(false);
            input.current?.focus();
          }}
        />
      )}
      <ConfirmDialog
        open={confirmClear}
        title="Start a new chat?"
        message="This clears the current conversation."
        confirmLabel="New chat"
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          await api.clearChat();
          setData([]);
          setConfirmClear(false);
        }}
      />
    </div>
  );
}
