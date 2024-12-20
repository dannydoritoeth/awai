"use client"

import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface PageHeadingProps {
  title: string
  description?: string
  showBackButton?: boolean
  backPath?: string
}

export function PageHeading({ 
  title, 
  description, 
  showBackButton,
  backPath = '/marketing'
}: PageHeadingProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mt-4">
        {showBackButton && (
          <Link href={backPath}>
            <ChevronLeftIcon className="w-8 h-8 text-gray-900" />
          </Link>
        )}
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>
      {description && (
        <p className="text-gray-600">{description}</p>
      )}
    </div>
  )
} 