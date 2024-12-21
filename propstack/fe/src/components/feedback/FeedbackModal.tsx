import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  context: 'credits' | 'feature' | 'bug' // Add more contexts as needed
  userEmail: string
}

export function FeedbackModal({ isOpen, onClose, context, userEmail }: FeedbackModalProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getTitle = () => {
    switch (context) {
      case 'credits':
        return 'Request More Credits'
      case 'feature':
        return 'Request a Feature'
      case 'bug':
        return 'Report a Bug'
      default:
        return 'Send Feedback'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)

    try {
      // Send to your notification endpoint
      const { error: emailError } = await supabase.functions.invoke('send-feedback', {
        body: {
          context,
          message,
          userEmail
        }
      })

      if (emailError) throw emailError

      setSent(true)
      setTimeout(() => {
        onClose()
        setSent(false)
        setMessage('')
      }, 2000)

    } catch (err) {
      setError('Failed to send request. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-medium text-gray-900">
              {getTitle()}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {sent ? (
            <div className="text-green-600">
              Request sent successfully! We'll get back to you soon.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Your email
                </label>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300"
                  placeholder="Please describe your request..."
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Submit Request'}
              </button>
            </form>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  )
} 