"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssistant } from "./assistant-shell";

/** Opens the assistant panel; with `prompt`, also sends it so the assistant starts right away. */
export function OpenAssistantButton({
  children = "Ask your planner",
  prompt,
  variant = "default",
  className,
}: {
  children?: React.ReactNode;
  prompt?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const { setOpen, ask } = useAssistant();
  return (
    <Button variant={variant} className={className} onClick={() => (prompt ? ask(prompt) : setOpen(true))}>
      <Sparkles /> {children}
    </Button>
  );
}
