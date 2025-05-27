import { Inter } from "next/font/google";
import "../globals.css";
import FilterSidebar from '../components/FilterSidebar';

const inter = Inter({ subsets: ["latin"] });

export default function FilterSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} min-h-screen bg-gray-50`}>
      <FilterSidebar>{children}</FilterSidebar>
    </div>
  );
} 