"use client"

import { Header } from '@/components/layout/Header'

import { PageHeading } from '@/components/layout/PageHeading'
import { TransactionsGrid } from '@/components/transactions/TransactionsGrid'

export const dynamic = 'force-static'

export default function TransactionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
        <main className="container mx-auto px-4">
          <PageHeading 
            title="Transactions" 
            description="Manage your transaction workflow"
            backHref="/"
            showBackButton
          />
          <TransactionsGrid />
        </main>
      
    </div>
  )
} 