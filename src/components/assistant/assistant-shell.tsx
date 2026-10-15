"use client";

import type { UIMessage } from "ai";
import { History, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconChip } from "@/components/brand";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/utils";
import { deleteChat, listChatsAction, loadChatMessages } from "./actions";
import { Chat } from "./chat";

type AssistantContextValue = {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  /** Opens the panel and sends `prompt` to the current chat. */
  ask: (prompt: string) => void;
};
const AssistantContext = createContext<AssistantContextValue | null>(null);

/** Round sparkle button; shows its label on hover/focus and hides while the page scrolls down. */
function AssistantLauncher({ onOpen }: { onOpen: () => void }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 4;
      // Down hides it (so it's not covering what you're reading); up, top or the very bottom shows it.
      if (y < 80 || y < last - 4) setHidden(false);
      else if (y > last + 4 && !nearBottom) setHidden(true);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Button
      onClick={onOpen}
      aria-label="Ask your planner"
      className={cn(
        "group fixed right-6 bottom-6 z-30 hidden h-12 rounded-full px-3.5 transition-[translate,opacity] duration-300 md:inline-flex print:hidden",
        hidden && "pointer-events-none translate-y-24 opacity-0",
      )}
    >
      <Sparkles className="size-5" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap transition-[max-width] duration-300 group-hover:max-w-40 group-focus-visible:max-w-40">
        Ask your planner
      </span>
    </Button>
  );
}

/** The page content area; makes room for the panel on wide screens. */
export function AssistantMain({ children }: { children: React.ReactNode }) {
  const { open } = useAssistant();
  return <main className={cn("min-w-0 flex-1 p-4 pb-28 transition-[margin] md:p-8 print:m-0 print:p-0", open && "lg:mr-[440px]")}>{children}</main>;
}

export function useAssistant() {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant must be used inside <AssistantShell>");
  return value;
}

type ActiveChat = { id: string; messages: UIMessage[] };
type Saved = { open: boolean; chatId?: string };

function readSaved(key: string): Saved {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "") as Saved;
  } catch {
    return { open: false };
  }
}

function writeSaved(key: string, value: Saved) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode etc.): the panel just won't be restored after a reload.
  }
}

/**
 * Wraps a wedding's pages with the assistant side panel. The panel lives in the layout,
 * so the conversation (including a reply that's still streaming) survives navigation.
 * Whether it's open and which chat it shows are remembered for the browser session.
 */
export function AssistantShell({
  weddingId,
  canWrite,
  children,
}: {
  weddingId: string;
  canWrite: boolean;
  children: React.ReactNode;
}) {
  const storageKey = `assistant:${weddingId}`;
  const [open, setOpenState] = useState(false);
  const [chat, setChat] = useState<ActiveChat | null>(null);

  // Restore the session's panel state.
  useEffect(() => {
    const saved = readSaved(storageKey);
    setOpenState(saved.open);
    if (!saved.chatId) {
      setChat({ id: crypto.randomUUID(), messages: [] });
      return;
    }
    let cancelled = false;
    loadChatMessages(weddingId, saved.chatId)
      .then((messages) => {
        if (!cancelled) setChat(messages ? { id: saved.chatId!, messages } : { id: crypto.randomUUID(), messages: [] });
      })
      .catch(() => !cancelled && setChat({ id: crypto.randomUUID(), messages: [] }));
    return () => {
      cancelled = true;
    };
  }, [storageKey, weddingId]);

  useEffect(() => {
    if (chat) writeSaved(storageKey, { open, chatId: chat.id });
  }, [storageKey, open, chat]);

  const setOpen = useCallback((value: boolean) => setOpenState(value), []);
  // A prompt waiting to be sent once the chat is ready; the id makes repeat asks distinct.
  const [queued, setQueued] = useState<{ id: number; text: string } | null>(null);
  const ask = useCallback((text: string) => {
    setOpenState(true);
    setQueued({ id: Date.now(), text });
  }, []);
  const toggle = useCallback(() => setOpenState((o) => !o), []);

  async function switchTo(chatId: string) {
    if (chatId === chat?.id) return;
    setChat(null);
    const messages = await loadChatMessages(weddingId, chatId);
    setChat(messages ? { id: chatId, messages } : { id: crypto.randomUUID(), messages: [] });
  }

  return (
    <AssistantContext.Provider value={{ open, toggle, setOpen, ask }}>
      {children}

      {/* Desktop launcher (phones use the Planner tab). Compact, and slides away while scrolling down. */}
      {!open && <AssistantLauncher onOpen={() => setOpenState(true)} />}

      {/* Hidden rather than unmounted when closed, so an in-flight reply keeps streaming. */}
      <aside
        aria-label="Assistant"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-xl transition-transform sm:w-[440px] print:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center gap-1 border-b px-3 py-2">
          <IconChip icon={Sparkles} tone="brand" size="sm" sticker />
          <span className="ml-1 flex-1 font-display font-bold">Your planner</span>
          <ChatHistory weddingId={weddingId} activeId={chat?.id} onSelect={switchTo} onDeleted={(id) => {
            if (id === chat?.id) setChat({ id: crypto.randomUUID(), messages: [] });
          }} />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New chat"
            onClick={() => setChat({ id: crypto.randomUUID(), messages: [] })}
          >
            <Plus />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close assistant" onClick={() => setOpenState(false)}>
            <X />
          </Button>
        </header>
        {chat ? (
          <Chat
            key={chat.id}
            weddingId={weddingId}
            chatId={chat.id}
            initialMessages={chat.messages}
            canWrite={canWrite}
            queuedPrompt={queued}
            onQueuedPromptSent={() => setQueued(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </aside>
    </AssistantContext.Provider>
  );
}

function ChatHistory({
  weddingId,
  activeId,
  onSelect,
  onDeleted,
}: {
  weddingId: string;
  activeId?: string;
  onSelect: (chatId: string) => void;
  onDeleted: (chatId: string) => void;
}) {
  const [chats, setChats] = useState<{ id: string; title: string }[] | null>(null);
  const { run } = useAction();

  return (
    <DropdownMenu
      onOpenChange={(isOpen) => {
        if (isOpen) listChatsAction(weddingId).then(setChats);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Chat history">
          <History />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Recent chats</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {chats === null && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {chats?.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No chats yet.</div>}
        {chats?.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onSelect(c.id)} className={cn(c.id === activeId && "bg-muted")}>
            <span className="flex-1 truncate">{c.title}</span>
            <button
              type="button"
              aria-label={`Delete ${c.title}`}
              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!confirm(`Delete "${c.title}"?`)) return;
                if (await run(() => deleteChat(weddingId, c.id))) {
                  setChats((list) => list?.filter((x) => x.id !== c.id) ?? null);
                  onDeleted(c.id);
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
