"use client"

import { createContext, useContext, ReactNode } from 'react'
import { useLoadScript } from '@react-google-maps/api'

const libraries: ("places")[] = ["places"]

interface MapsContextType {
  isLoaded: boolean
  loadError: Error | undefined
}

const MapsContext = createContext<MapsContextType | undefined>(undefined)

export function MapsProvider({ children }: { children: ReactNode }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
    libraries,
    language: 'en'
  })

  return (
    <MapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </MapsContext.Provider>
  )
}

export function useMaps() {
  const context = useContext(MapsContext)
  if (context === undefined) {
    throw new Error('useMaps must be used within a MapsProvider')
  }
  return context
} 