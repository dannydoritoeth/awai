import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'

interface CaptionDialogProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (options: CaptionOptions) => void
  imageCount: number
}

export interface CaptionOptions {
  style: 'professional' | 'casual' | 'luxury'
  focus: ('features' | 'atmosphere' | 'selling_points')[]
  tone: 'neutral' | 'enthusiastic' | 'sophisticated'
  length: 'short' | 'medium' | 'long'
  includeKeywords: string
}

export function CaptionDialog({ isOpen, onClose, onGenerate, imageCount }: CaptionDialogProps) {
  const [options, setOptions] = useState<CaptionOptions>({
    style: 'professional',
    focus: ['features'],
    tone: 'neutral',
    length: 'medium',
    includeKeywords: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onGenerate(options)
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Generate Image Captions
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Writing Style
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 py-2 px-3"
                      value={options.style}
                      onChange={e => setOptions(prev => ({ ...prev, style: e.target.value as any }))}
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual & Friendly</option>
                      <option value="luxury">Luxury & Upscale</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Focus Areas (select multiple)
                    </label>
                    <div className="space-y-2">
                      {(['features', 'atmosphere', 'selling_points'] as const).map(focus => (
                        <label key={focus} className="flex items-center">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600"
                            checked={options.focus.includes(focus)}
                            onChange={e => {
                              setOptions(prev => ({
                                ...prev,
                                focus: e.target.checked
                                  ? [...prev.focus, focus]
                                  : prev.focus.filter(f => f !== focus)
                              }))
                            }}
                          />
                          <span className="ml-2 text-sm text-gray-600">
                            {focus === 'features' && 'Physical Features & Details'}
                            {focus === 'atmosphere' && 'Mood & Atmosphere'}
                            {focus === 'selling_points' && 'Key Selling Points'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tone
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 py-2 px-3"
                      value={options.tone}
                      onChange={e => setOptions(prev => ({ ...prev, tone: e.target.value as any }))}
                    >
                      <option value="neutral">Neutral & Factual</option>
                      <option value="enthusiastic">Enthusiastic & Engaging</option>
                      <option value="sophisticated">Sophisticated & Refined</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Caption Length
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 py-2 px-3"
                      value={options.length}
                      onChange={e => setOptions(prev => ({ ...prev, length: e.target.value as any }))}
                    >
                      <option value="short">Short (under 50 characters)</option>
                      <option value="medium">Medium (50-100 characters)</option>
                      <option value="long">Long (100-150 characters)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Keywords to Include (optional)
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 py-2 px-3"
                      placeholder="e.g., modern, spacious, renovated"
                      value={options.includeKeywords}
                      onChange={e => setOptions(prev => ({ ...prev, includeKeywords: e.target.value }))}
                    />
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <SparklesIcon className="w-4 h-4 mr-2" />
                      Generate {imageCount} Captions
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
} 