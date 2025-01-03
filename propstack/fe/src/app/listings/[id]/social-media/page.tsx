"use client"

import { PageHeading } from '@/components/layout/PageHeading'
import { PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { SocialMediaTable } from '@/components/listings/social-media/SocialMediaTable'

export default function SocialMediaPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Social Media Content"
        description="Generate and manage social media content for this listing"
        showBackButton
        backHref={`/listings/${params.id}`}
      />

      <div className="mb-4">
        <Link
          href={`/listings/${params.id}/social-media/new`}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          New Content
        </Link>
      </div>

      <SocialMediaTable listingId={params.id} />
    </div>
  )
} 