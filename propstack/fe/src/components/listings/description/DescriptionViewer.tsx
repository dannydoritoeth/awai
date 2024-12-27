import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'

interface DescriptionViewerProps {
  listing: any
  descriptions: Array<{
    id: string
    content: string
    created_at: string
    status: 'draft' | 'approved'
  }>
  currentIndex: number
  onIndexChange: (index: number) => void
}

const PORTALS = [
  { id: 'rea', name: 'Realestate.com.au', icon: '🏠' },
  { id: 'domain', name: 'Domain', icon: '🏘️' },
  { id: 'rma', name: 'RateMyAgent', icon: '⭐' },
  { id: 'homely', name: 'Homely', icon: '🏡' },
  { id: 'properti', name: 'Properti', icon: '🔑' }
]

export function DescriptionViewer({ 
  listing, 
  descriptions, 
  currentIndex,
  onIndexChange 
}: DescriptionViewerProps) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(descriptions[currentIndex]?.content || '')
  const [selectedPortals, setSelectedPortals] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)

  const currentDescription = descriptions[currentIndex]
  const isApproved = currentDescription?.status === 'approved'

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('generated_descriptions')
        .update({ content })
        .eq('id', currentDescription.id)

      if (error) throw error
      setEditing(false)
    } catch (err) {
      console.error('Error saving description:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    try {
      const { error } = await supabase
        .from('generated_descriptions')
        .update({ status: 'approved' })
        .eq('id', currentDescription.id)

      if (error) throw error
    } catch (err) {
      console.error('Error approving description:', err)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      // TODO: Implement portal sync logic
      console.log('Syncing to portals:', selectedPortals)
    } catch (err) {
      console.error('Error syncing to portals:', err)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onIndexChange(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-50"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <span className="text-sm text-gray-500">
          Version {currentIndex + 1} of {descriptions.length}
        </span>
        <button
          onClick={() => onIndexChange(currentIndex + 1)}
          disabled={currentIndex === descriptions.length - 1}
          className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-50"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Description Content */}
      <div className="space-y-4">
        {editing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        ) : (
          <div className="prose max-w-none">
            {content}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="space-x-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Edit
            </button>
          )}
        </div>
        
        {!isApproved && (
          <button
            onClick={handleApprove}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Approve
          </button>
        )}
      </div>

      {/* Portal Sync */}
      {isApproved && (
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Sync to Portals</h4>
          <div className="space-y-2">
            {PORTALS.map(portal => (
              <label key={portal.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedPortals.includes(portal.id)}
                  onChange={(e) => {
                    setSelectedPortals(prev => 
                      e.target.checked 
                        ? [...prev, portal.id]
                        : prev.filter(id => id !== portal.id)
                    )
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2">
                  {portal.icon} {portal.name}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={selectedPortals.length === 0 || syncing}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync to Selected Portals'}
          </button>
        </div>
      )}
    </div>
  )
} 