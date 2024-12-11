import { ChatContainer } from "@/components/chat/ChatContainer";

export default function Home() {
  return (
    <main className="container mx-auto p-4 min-h-screen flex flex-col">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Real Estate Assistant</h1>
        <p className="text-muted-foreground">
          Your AI-powered real estate sales companion
        </p>
      </div>
      <ChatContainer />
    </main>
  );
}