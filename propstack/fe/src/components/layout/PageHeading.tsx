"use client"

import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface PageHeadingProps {
  title: string
  description?: string
  showBackButton?: boolean
  backHref?: string
  backPath?: string
  children?: React.ReactNode
}

export function PageHeading({ 
  title, 
  description,
  showBackButton,
  backHref,
  backPath,
  children
}: PageHeadingProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mt-4">
        {showBackButton && backHref && (
          <Link href={backHref || '/'}>
            <ChevronLeftIcon className="w-8 h-8 text-gray-900" />
          </Link>
        )}
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>
      {description && (
        <p className="text-gray-600">{description}</p>
      )}
      {children && (
        <p className="text-gray-600 mt-1">{children}</p>
      )}
    </div>
  )
} 