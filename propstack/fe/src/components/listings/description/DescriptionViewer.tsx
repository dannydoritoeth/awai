import { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

interface DescriptionViewerProps {
  listing: any
  descriptions: Array<{
    id: string
    content: string
    created_at: string
    status: string
  }>
  currentIndex: number
  onIndexChange: (index: number) => void
  onComplete: () => void
}

const SYNC_OPTIONS = {
  platforms: [
    { id: 'rea', name: 'realestate.com.au', icon: '🏠' },
    { id: 'domain', name: 'domain.com.au', icon: '🏘️' },
    { id: 'rma', name: 'RateMyAgent', icon: '⭐' },
    { id: 'free_portals', name: 'Homely, Properti, & Other Free Portals', icon: '🏡' },
  ],
  crms: [
    { id: 'agentbox', name: 'AgentBox', icon: '📊' },
  ]
}

export function DescriptionViewer({ 
  listing, 
  descriptions, 
  currentIndex,
  onIndexChange,
  onComplete 
}: DescriptionViewerProps) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')
  const [selectedPortals, setSelectedPortals] = useState<string[]>([])
  const [selectedSyncTargets, setSelectedSyncTargets] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Debug logs
  console.log('DescriptionViewer props:', {
    descriptionsCount: descriptions.length,
    currentIndex,
    currentContent: descriptions[currentIndex]?.content
  })

  useEffect(() => {
    if (descriptions[currentIndex]?.content) {
      setContent(descriptions[currentIndex].content)
      console.log('Setting content:', descriptions[currentIndex].content)
    }
  }, [descriptions, currentIndex])

  // Sort descriptions by created_at in ascending order
  const sortedDescriptions = [...descriptions].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // When a new description is added, automatically show it
  useEffect(() => {
    if (descriptions.length > 0) {
      // Set index to the latest description (last in the sorted array)
      onIndexChange(descriptions.length - 1)
    }
  }, [descriptions.length])

  const currentDescription = sortedDescriptions[currentIndex]
  const isApproved = currentDescription?.status === 'approved'
  const isProcessing = currentDescription?.status === 'processing'
  const isGenerating = currentDescription?.status === 'generating'
  const hasError = currentDescription?.status === 'error'

  if (!currentDescription) {
    console.log('No current description found')
    return null
  }

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
    if (selectedSyncTargets.length === 0) return
    
    setSyncing(true)
    try {
      // TODO: Implement actual sync
      console.log('Syncing to:', selectedSyncTargets)
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Successfully synchronized content')
    } catch (err) {
      console.error('Error syncing:', err)
      toast.error('Failed to synchronize content')
    } finally {
      setSyncing(false)
    }
  }

  const currentVersion = currentIndex + 1
  const totalVersions = sortedDescriptions.length

  // Add polling for generating status
  useEffect(() => {
    if (!currentDescription || currentDescription.status !== 'generating') return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('generated_descriptions')
        .select('*')
        .eq('id', currentDescription.id)
        .single()

      if (data && data.status !== 'generating') {
        // Refresh the full list when status changes
        onComplete()
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentDescription?.id, currentDescription?.status, onComplete])

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Description</h3>
          <p className="text-sm text-gray-500">
            Created: {new Date(currentDescription.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* ... copy button ... */}
          <div className="text-sm text-gray-500">
            Version {currentVersion} of {totalVersions}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => onIndexChange(Math.min(sortedDescriptions.length - 1, currentIndex + 1))}
              disabled={currentIndex === sortedDescriptions.length - 1}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content area with edit functionality */}
      {isGenerating ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="text-gray-500 mt-4">Generating Description...</div>
        </div>
      ) : (
        <div className="space-y-4">
          {editing ? (
            <div className="space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setContent(currentDescription.content)
                    setEditing(false)
                  }}
                  className="px-3 py-1 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-gray-700 whitespace-pre-wrap">
                {currentDescription?.content || 'No description available'}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent 
                    text-sm font-medium rounded-md shadow-sm 
                    text-white bg-blue-600 hover:bg-blue-700 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PencilIcon className="w-4 h-4 mr-2" />
                  Edit Description
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync Section */}
      {!isGenerating && !editing && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="space-y-6">
            {/* Platforms */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Synchronize To</h3>
              
              {/* Platforms Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Platforms</h4>
                <div className="space-y-3">
                  {SYNC_OPTIONS.platforms.map(platform => (
                    <label key={platform.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedSyncTargets.includes(platform.id)}
                        onChange={(e) => {
                          setSelectedSyncTargets(current => 
                            e.target.checked
                              ? [...current, platform.id]
                              : current.filter(id => id !== platform.id)
                          )
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 
                          border-gray-300 rounded"
                      />
                      <span className="ml-3 flex items-center text-gray-700">
                        <span className="mr-2">{platform.icon}</span>
                        {platform.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* CRMs Section */}
              <div className="mt-6 space-y-4">
                <h4 className="text-sm font-medium text-gray-700">CRMs</h4>
                <div className="space-y-3">
                  {SYNC_OPTIONS.crms.map(crm => (
                    <label key={crm.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedSyncTargets.includes(crm.id)}
                        onChange={(e) => {
                          setSelectedSyncTargets(current => 
                            e.target.checked
                              ? [...current, crm.id]
                              : current.filter(id => id !== crm.id)
                          )
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 
                          border-gray-300 rounded"
                      />
                      <span className="ml-3 flex items-center text-gray-700">
                        <span className="mr-2">{crm.icon}</span>
                        {crm.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Synchronize Button */}
              <div className="mt-6">
                <button
                  onClick={handleSync}
                  disabled={selectedSyncTargets.length === 0 || syncing}
                  className="w-full flex justify-center items-center px-4 py-2 
                    border border-transparent text-sm font-medium rounded-md 
                    text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 
                    disabled:cursor-not-allowed focus:outline-none focus:ring-2 
                    focus:ring-offset-2 focus:ring-blue-500"
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" 
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Synchronizing...
                    </>
                  ) : (
                    'Synchronize Content'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 