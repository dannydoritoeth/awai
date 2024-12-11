"use client";

import { useState } from "react";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { Card } from "@/components/ui/card";
import { Message } from "./types";

const INITIAL_MESSAGES: Message[] = [
  {
    id: "initial",
    content: "Hello! I'm your real estate sales assistant. How can I help you today?",
    role: "assistant",
    createdAt: new Date(),
  },
];

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (content: string) => {
    const newMessage: Message = {
      id: `user-${Date.now()}`,
      content,
      role: "user",
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    // Simulate AI response - Replace with actual API call
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: "I understand you're interested in real estate. How can I assist you with property management or sales today?",
        role: "assistant",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto h-[600px] flex flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatMessageList messages={messages} isLoading={isLoading} />
      </div>
      <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
    </Card>
  );
}