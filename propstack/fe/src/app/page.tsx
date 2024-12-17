import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { Header } from '@/components/layout/Header'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <DashboardGrid />
      </main>
    </div>
  )
}
