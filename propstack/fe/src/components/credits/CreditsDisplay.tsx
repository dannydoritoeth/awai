import { EnvelopeIcon } from '@heroicons/react/24/outline'

export function CreditsDisplay({ credits }: { credits: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Available Credits</h2>
          <p className="text-3xl font-bold text-gray-900">{credits}</p>
        </div>
        <a
          href="mailto:scott@acceleratewith.ai?subject=PropStack%20Credits%20Request"
          className="inline-flex items-center text-blue-600 hover:text-blue-700"
        >
          <EnvelopeIcon className="w-5 h-5 mr-2" />
          Request More Credits
        </a>
      </div>
    </div>
  )
} 