"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface GoogleMapsContextType {
  isLoaded: boolean
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false })

let isInitialized = false

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Suppress Google Maps API warning in development
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      if (args[0]?.includes?.('Google Maps JavaScript API multiple times')) {
        return
      }
      originalConsoleError(...args)
    }

    try {
      console.log('GoogleMapsProvider mounting, isInitialized:', isInitialized)
      console.log('Current window.google:', window.google)

      if (isInitialized || window.google?.maps) {
        console.log('Google Maps already loaded')
        setIsLoaded(true)
        return
      }

      isInitialized = true
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places,geometry`
      script.async = true
      script.defer = true
      script.id = 'google-maps'

      script.onload = () => {
        console.log('Google Maps script loaded')
        setIsLoaded(true)
      }

      script.onerror = (e) => {
        console.error('Google Maps script load error:', e)
        setError(new Error('Failed to load Google Maps'))
      }

      document.head.appendChild(script)
      console.log('Google Maps script added to head')
    } catch (err) {
      console.error('Error in GoogleMapsProvider:', err)
      setError(err as Error)
    }

    return () => {
      console.log('GoogleMapsProvider cleanup')
      isInitialized = false
    }
  }, [])

  if (error) {
    return <div className="text-red-500">Error loading Google Maps: {error.message}</div>
  }

  return (
    <GoogleMapsContext.Provider value={{ isLoaded }}>
      {children}
    </GoogleMapsContext.Provider>
  )
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext)
} 