"use client"

interface PropertyDetailsFormProps {
  onBack: () => void
}

export function PropertyDetailsForm({ onBack }: PropertyDetailsFormProps) {
  return (
    <div className="flex gap-4">
      {/* Left Column - Property Details */}
      <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900">Property Details</h3>
        <form className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700">$</label>
            <input
              type="text"
              placeholder="Price (optional)"
              className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700">Bedrooms</label>
            <input
              type="number"
              className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700">Bathrooms</label>
            <input
              type="number"
              className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700">Parking (optional)</label>
            <input
              type="text"
              className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700">Lot Size (optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md border-gray-300 shadow-sm text-gray-900"
              />
              <select className="w-24 rounded-md border-gray-300 shadow-sm text-gray-900">
                <option>Sq Feet</option>
                <option>Acres</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700">Interior size (optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md border-gray-300 shadow-sm text-gray-900"
              />
              <select className="w-24 rounded-md border-gray-300 shadow-sm text-gray-900">
                <option>Sq Feet</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Right Column - Property Highlights */}
      <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900">Property Highlights</h3>
        <p className="text-sm text-gray-600 mb-4">The AI will pay special attention to these areas.</p>
        
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              'Renovation potential', 'Lot size', 'Neighbourhood',
              'Outdoor space', 'Price point', 'Parking',
              'Quality of build', 'Nearby attractions', 'Environment',
              'Basement', 'Rental income'
            ].map(highlight => (
              <button
                key={highlight}
                className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                {highlight}
              </button>
            ))}
            <button className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
              + Add your own
            </button>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Other details</h4>
            <textarea
              placeholder="Example: Open house dates, renovations / updates, any specific conditions etc."
              className="w-full h-32 rounded-md border-gray-300 shadow-sm text-gray-900"
            />
          </div>
        </div>
      </div>
    </div>
  )
} 