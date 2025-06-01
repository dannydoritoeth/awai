export default function RoleFinderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-blue-950">Find the Best Role</h1>
          <p className="text-lg text-gray-600">Discover meaningful career opportunities for your team members</p>
        </div>
        {children}
      </div>
    </div>
  );
} 