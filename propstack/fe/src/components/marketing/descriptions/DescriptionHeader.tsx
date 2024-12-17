"use client"

interface DescriptionHeaderProps {
  onReset: () => void
}

export function DescriptionHeader({ onReset }: DescriptionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Listing Description</h1>
        <p className="text-gray-600">Create compelling property descriptions with AI</p>
      </div>
      <button 
        onClick={onReset} 
        className="text-blue-600 hover:text-blue-700"
      >
        Reset form
      </button>
    </div>
  )
} 