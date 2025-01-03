"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'

interface AgentEngagement {
  id: string
  property_address: string
  created_at: string
  status: string
}

export function AgentEngagementsTable() {
  const router = useRouter()
  const [engagements, setEngagements] = useState<AgentEngagement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadEngagements()
  }, [])

  async function loadEngagements() {
    try {
      const { data, error } = await supabase
        .from('agent_engagements')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEngagements(data || [])
    } catch (err) {
      console.error('Error loading engagements:', err)
      setError('Failed to load engagements')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  if (error) {
    return <div className="text-red-600 py-4">{error}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Property Address
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {engagements.map(engagement => (
            <tr 
              key={engagement.id}
              onClick={() => router.push(`/transactions/agent-engagement/${engagement.id}`)}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {engagement.property_address}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">
                  {new Date(engagement.created_at).toLocaleDateString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                  ${engagement.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    engagement.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-gray-100 text-gray-800'}`}
                >
                  {engagement.status.replace('_', ' ')}
                </span>
              </td>
            </tr>
          ))}
          {engagements.length === 0 && (
            <tr>
              <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                No engagements found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
} 