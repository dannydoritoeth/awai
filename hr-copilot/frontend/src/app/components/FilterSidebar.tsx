interface FilterSidebarProps {
  children: React.ReactNode;
}

export default function FilterSidebar({ children }: FilterSidebarProps) {
  return (
    <div className="flex min-h-screen">
      {/* Filter Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-6 text-gray-900">Filters</h2>
        {/* Filter content will be added later */}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {children}
      </div>
    </div>
  );
} 