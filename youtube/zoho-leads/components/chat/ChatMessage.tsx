"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/utils/date";
import { Building2, User } from "lucide-react";
import { ChatMessageProps } from "./types";

export function ChatMessage({ message }: ChatMessageProps) {
  const { content, role, createdAt } = message;
  const isAssistant = role === "assistant";
  const timestamp = formatTimestamp(createdAt);

  return (
    <div className={cn("flex w-full gap-4 p-4", isAssistant ? "bg-muted/50" : "")}>
      <Avatar>
        <AvatarFallback>
          {isAssistant ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isAssistant ? "Real Estate Assistant" : "Manager"}
          </span>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        </div>
        <p className="text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
}