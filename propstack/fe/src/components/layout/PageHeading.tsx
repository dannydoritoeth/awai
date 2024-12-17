"use client"

import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { navigationStore } from '@/lib/navigation'

interface PageHeadingProps {
  title: string
  description?: string
  showBackButton?: boolean
}

export function PageHeading({ title, description, showBackButton }: PageHeadingProps) {
  const router = useRouter()

  const handleBack = () => {
    navigationStore.isBackNavigation = true
    router.back()
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2">
        {showBackButton && (
          <button onClick={handleBack}>
            <ChevronLeftIcon className="w-8 h-8 text-gray-900" />
          </button>
        )}
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>
      {description && (
        <p className="text-gray-600">{description}</p>
      )}
    </div>
  )
} 