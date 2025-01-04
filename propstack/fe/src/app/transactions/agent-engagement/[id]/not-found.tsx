import Link from 'next/link'


export default function EngagementNotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      
        <main className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Engagement Not Found
            </h1>
            <p className="text-gray-600 mb-4">
              The engagement you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Link
              href="/transactions/agent-engagement"
              className="text-blue-600 hover:text-blue-700"
            >
              Return to Engagements
            </Link>
          </div>
        </main>
      
    </div>
  )
} 