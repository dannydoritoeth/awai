"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "./types";
import { ChatMessage } from "./ChatMessage";

interface ChatMessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  return (
    <ScrollArea className="h-full">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      {isLoading && (
        <div className="p-4 text-sm text-muted-foreground">
          Assistant is typing...
        </div>
      )}
    </ScrollArea>
  );
}