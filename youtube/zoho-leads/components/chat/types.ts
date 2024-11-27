export interface Message {
  id: string;
  content: string;
  role: "assistant" | "user";
  createdAt: Date;
}

export interface ChatMessageProps {
  message: Message;
}