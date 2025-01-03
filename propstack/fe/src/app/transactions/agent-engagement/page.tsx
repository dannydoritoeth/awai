"use client"

import { PageHeading } from '@/components/layout/PageHeading'
import { AgentEngagementsTable } from '@/components/agent-engagements/AgentEngagementsTable'
import { PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default function AgentEngagementsPage() {
  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Agent Engagements"
        description="Track and manage agent engagements"
      />

      <div className="mb-4">
        <Link
          href="/transactions/agent-engagement/new"
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          New Engagement
        </Link>
      </div>

      <AgentEngagementsTable />
    </div>
  )
} 