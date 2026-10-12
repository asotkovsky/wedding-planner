"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import { ArrowUp, Check, ChevronRight, CircleAlert, Loader2, ShieldQuestion, Sparkles, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { IconChip } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Generate a planning checklist from now until the wedding",
  "Draft a day-of timeline for the wedding day",
  "Add a guest",
  "Which vendors still have unpaid balances?",
];

export function Chat({
  weddingId,
  chatId,
  initialMessages,
  canWrite,
  queuedPrompt,
  onQueuedPromptSent,
}: {
  weddingId: string;
  chatId: string;
  initialMessages: UIMessage[];
  canWrite: boolean;
  queuedPrompt?: { id: number; text: string } | null;
  onQueuedPromptSent?: () => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/w/${weddingId}/chat`,
        // History lives on the server; send only the newest message.
        prepareSendMessagesRequest: ({ id, messages }) => ({ body: { chatId: id, message: messages.at(-1) } }),
      }),
    [weddingId],
  );

  const { messages, sendMessage, status, stop, error, addToolApprovalResponse, clearError } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    // Refresh the page behind the panel so it shows anything the assistant changed.
    onFinish: () => router.refresh(),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  // Prompts sent from buttons elsewhere in the app ("Draft my timeline"), once any reply in progress finishes.
  // Sent from a timeout that's cancelled on cleanup: useChat stops its chat when the component unmounts
  // (which React also simulates in development), and stopping silently drops a message being prepared.
  const sentPromptId = useRef<number | null>(null);
  useEffect(() => {
    if (!queuedPrompt || busy || sentPromptId.current === queuedPrompt.id) return;
    const timer = setTimeout(() => {
      sentPromptId.current = queuedPrompt.id;
      onQueuedPromptSent?.();
      clearError();
      sendMessage({ text: queuedPrompt.text });
    }, 0);
    return () => clearTimeout(timer);
  }, [queuedPrompt, busy, onQueuedPromptSent, clearError, sendMessage]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    clearError();
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 px-4 py-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <IconChip icon={Sparkles} tone="brand" size="lg" sticker className="-rotate-6" />
              <div>
                <h2 className="text-xl font-bold">How can I help?</h2>
                <p className="text-muted-foreground">
                  {canWrite
                    ? "Ask about your plans, or tell me what to add or change."
                    : "Ask about the plans. You have view-only access, so I can't make changes."}
                </p>
              </div>
              <div className="grid w-full gap-2">
                {SUGGESTIONS.slice(0, canWrite ? 4 : 0).map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-xl border-2 border-dashed p-3 text-left text-sm font-medium transition-colors hover:border-solid hover:border-brand hover:bg-brand-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              onApproval={(id, approved) => addToolApprovalResponse({ id, approved })}
              disabled={busy}
            />
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {error.message || "Something went wrong."}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Message the assistant…"
            rows={1}
            className="max-h-48 min-h-10 resize-none"
            aria-label="Message"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" onClick={() => stop()} aria-label="Stop">
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Message({
  message,
  onApproval,
  disabled,
}: {
  message: UIMessage;
  onApproval: (approvalId: string, approved: boolean) => void;
  disabled: boolean;
}) {
  // Context updates the server appended for the model; not part of the visible conversation.
  if (message.role === "system") return null;

  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2 whitespace-pre-wrap text-primary-foreground sticker-sm">
        {text}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, i) => {
        if (part.type === "text") return <Markdown key={i} text={part.text} />;
        if (part.type === "reasoning") {
          if (!part.text.trim()) return null;
          return (
            <details key={i} className="group text-sm text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-1 select-none">
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" /> Thinking
              </summary>
              <div className="mt-1 border-l pl-3 whitespace-pre-wrap">{part.text}</div>
            </details>
          );
        }
        if (isToolUIPart(part)) return <ToolPart key={i} part={part} onApproval={onApproval} disabled={disabled} />;
        return null;
      })}
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div
      className={cn(
        "max-w-none text-sm leading-relaxed",
        "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
        "[&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_a]:underline [&_strong]:font-semibold",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

// ---------- Tool calls ----------

type ToolPartType = ToolUIPart | DynamicToolUIPart;

const TOOL_LABELS: Record<string, string> = {
  list_guests: "Looking up guests",
  list_events: "Looking up events",
  list_vendors: "Looking up vendors",
  get_budget: "Checking the budget",
  list_tasks: "Looking up tasks",
  list_timeline: "Looking up the timeline",
  get_guest_page: "Checking the guest page",
};

function toolName(part: ToolPartType) {
  return part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
}

function humanize(name: string) {
  const s = name.replace(/_/g, " ");
  return s[0].toUpperCase() + s.slice(1);
}

function ToolPart({
  part,
  onApproval,
  disabled,
}: {
  part: ToolPartType;
  onApproval: (approvalId: string, approved: boolean) => void;
  disabled: boolean;
}) {
  const name = toolName(part);
  const input = (part.input ?? {}) as Record<string, unknown>;
  const output = part.state === "output-available" ? (part.output as { ok?: boolean; summary?: string; error?: string }) : null;

  if (part.state === "approval-requested") {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <ShieldQuestion className="size-4 text-amber-600" />
          {typeof input.summary === "string" ? input.summary : humanize(name)}
        </div>
        <ApprovalPreview name={name} input={input} />
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={disabled} onClick={() => onApproval(part.approval.id, true)}>
            <Check /> Approve
          </Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onApproval(part.approval.id, false)}>
            <X /> Deny
          </Button>
        </div>
      </div>
    );
  }

  let icon = <Loader2 className="size-3.5 animate-spin" />;
  let label = TOOL_LABELS[name] ?? humanize(name);
  let tone = "text-muted-foreground";

  if (part.state === "output-available") {
    if (output?.ok === false) {
      icon = <CircleAlert className="size-3.5" />;
      label = output.error ?? "Failed";
      tone = "text-destructive";
    } else {
      icon = <Check className="size-3.5" />;
      label = output?.summary ?? TOOL_LABELS[name]?.replace("Looking up", "Looked up").replace("Checking", "Checked") ?? label;
    }
  } else if (part.state === "output-error") {
    icon = <CircleAlert className="size-3.5" />;
    label = `${humanize(name)} failed`;
    tone = "text-destructive";
  } else if (part.state === "output-denied") {
    icon = <X className="size-3.5" />;
    label = `Denied: ${typeof input.summary === "string" ? input.summary : humanize(name)}`;
  } else if (part.state === "approval-responded") {
    label = part.approval.approved ? "Approved, applying…" : "Denied";
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", tone)}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ApprovalPreview({ name, input }: { name: string; input: Record<string, unknown> }) {
  const rows =
    name === "create_tasks"
      ? ((input.tasks as { title: string; dueDate?: string | null }[] | undefined) ?? []).map(
          (t) => `${t.dueDate ? `${t.dueDate} · ` : ""}${t.title}`,
        )
      : name === "create_timeline_items"
        ? ((input.items as { title: string; startsAt: string }[] | undefined) ?? []).map(
            (t) => `${t.startsAt?.replace("T", " ") ?? ""} · ${t.title}`,
          )
        : [];
  if (!rows.length) return null;
  return (
    <details className="mt-2" open={rows.length <= 12}>
      <summary className="cursor-pointer text-muted-foreground">{rows.length} items</summary>
      <ul className="mt-1 max-h-64 list-disc overflow-y-auto pl-5 text-muted-foreground">
        {rows.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </details>
  );
}
