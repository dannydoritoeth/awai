import { Inter } from "next/font/google";
import "../globals.css";
import FilterSidebar from '../components/FilterSidebar';
import { CategoryNav } from '@/components/category-nav';

const inter = Inter({ subsets: ["latin"] });

export default function FilterSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} min-h-screen bg-gray-50`}>
      <FilterSidebar>
        <div className="flex-1">
          <CategoryNav />
          <div className="p-8">
            {children}
          </div>
        </div>
      </FilterSidebar>
    </div>
  );
} 