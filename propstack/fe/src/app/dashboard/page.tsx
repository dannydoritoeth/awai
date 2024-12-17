import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { Header } from '@/components/layout/Header'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Welcome to PropStack AI
        </h1>
        <DashboardGrid />
      </main>
    </div>
  )
} 