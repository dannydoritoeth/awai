import { Inter } from "next/font/google";
import "../globals.css";
import Sidebar from '../components/Sidebar';

const inter = Inter({ subsets: ["latin"] });

export default function ChatSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} min-h-screen bg-gray-50`}>
      <Sidebar>{children}</Sidebar>
    </div>
  );
} 