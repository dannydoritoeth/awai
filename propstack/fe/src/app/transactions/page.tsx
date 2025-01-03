"use client"

import { PageHeading } from '@/components/layout/PageHeading'

export default function TransactionsPage() {
  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Transactions"
        description="Manage your transaction workflow"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Agent Engagement</h3>
          <p className="mt-2 text-gray-600">Complete Agent Engagement Process</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Contracts</h3>
          <p className="mt-2 text-gray-600">Manage and track contracts</p>
        </div>
      </div>
    </div>
  )
} 