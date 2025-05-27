export default function CandidateFinderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-blue-950">Find the Best Candidate</h1>
          <p className="text-lg text-gray-600">Define your role requirements and let AI find your perfect match</p>
        </div>
        {children}
      </div>
    </div>
  );
} 