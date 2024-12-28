import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'

interface CaptionDialogProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (options: CaptionOptions) => void
  imageCount: number
}

export type CaptionStyle = 'professional' | 'casual' | 'luxury'
export type CaptionFocus = 'features' | 'atmosphere' | 'selling_points'
export type CaptionTone = 'neutral' | 'enthusiastic' | 'sophisticated'
export type CaptionLength = 'short' | 'medium' | 'long'

export interface CaptionOptions {
  style: CaptionStyle
  focus: CaptionFocus[]
  tone: CaptionTone
  length: CaptionLength
  includeKeywords?: string
}

export function CaptionDialog({ isOpen, onClose, onGenerate, imageCount }: CaptionDialogProps) {
  const [style, setStyle] = useState<CaptionStyle>('professional')
  const [focus, setFocus] = useState<CaptionFocus[]>(['features', 'atmosphere'])
  const [tone, setTone] = useState<CaptionTone>('enthusiastic')
  const [length, setLength] = useState<CaptionLength>('medium')
  const [includeKeywords, setIncludeKeywords] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    onClose()
    
    try {
      await onGenerate({
        style,
        focus,
        tone,
        length,
        includeKeywords
      })
    } finally {
      setIsSubmitting(false)
    }
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
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  {imageCount === 1 ? 'Generate Image Caption' : 'Generate Image Captions'}
                </Dialog.Title>

                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {imageCount === 1 
                      ? 'Generate an AI caption for this image.' 
                      : `Generate AI captions for ${imageCount} images.`
                    }
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Writing Style
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 py-2 px-3"
                      value={style}
                      onChange={e => setStyle(e.target.value as CaptionStyle)}
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="luxury">Luxury</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Focus Areas (select multiple)
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: 'features', label: 'Property Features' },
                        { value: 'atmosphere', label: 'Atmosphere & Feel' },
                        { value: 'selling_points', label: 'Key Selling Points' }
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600"
                            checked={focus.includes(value as CaptionFocus)}
                            onChange={e => {
                              setFocus(prev => {
                                const newFocus = e.target.checked
                                  ? [...prev, value as CaptionFocus]
                                  : prev.filter(f => f !== value)
                                return newFocus
                              })
                            }}
                          />
                          <span>{label}</span>
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
                      value={tone}
                      onChange={e => setTone(e.target.value as CaptionTone)}
                    >
                      <option value="neutral">Neutral & Factual</option>
                      <option value="enthusiastic">Enthusiastic</option>
                      <option value="sophisticated">Sophisticated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Caption Length
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 py-2 px-3"
                      value={length}
                      onChange={e => setLength(e.target.value as CaptionLength)}
                    >
                      <option value="short">Short (under 50 characters)</option>
                      <option value="medium">Medium (50-100 characters)</option>
                      <option value="long">Long (100+ characters)</option>
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
                      value={includeKeywords}
                      onChange={e => setIncludeKeywords(e.target.value)}
                    />
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting 
                        ? 'Generating...' 
                        : imageCount === 1 
                          ? 'Generate Caption' 
                          : 'Generate Captions'
                      }
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