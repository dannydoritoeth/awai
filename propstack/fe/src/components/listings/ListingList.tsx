"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function ListingList() {
  const router = useRouter()
  // ... other state and functions

  return (
    <div className="space-y-4">
      {listings.map(listing => (
        <div 
          key={listing.id}
          onClick={() => router.push(`/listings/${listing.id}`)}
          className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          {/* ... listing content */}
        </div>
      ))}
    </div>
  )
} 