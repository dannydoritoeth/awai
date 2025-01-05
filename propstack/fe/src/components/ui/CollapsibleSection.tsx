"use client"

import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface CollapsibleSectionProps {
  title: string
  description?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function CollapsibleSection({ 
  title, 
  description, 
  isOpen, 
  onToggle, 
  children 
}: CollapsibleSectionProps) {
  return (
    <div className="border rounded-lg bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-gray-900"
      >
        <div>
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
        <ChevronDownIcon 
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t text-gray-900">
          {children}
        </div>
      )}
    </div>
  )
} 