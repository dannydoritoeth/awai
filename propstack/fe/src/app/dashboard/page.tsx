import { DashboardGrid } from '@/components/dashboard/DashboardGrid'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Welcome to PropStack IO
        </h1>
        <DashboardGrid />
      </main>
    </div>
  )
} 