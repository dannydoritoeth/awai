"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface GoogleMapsContextType {
  isLoaded: boolean
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false })

// Track script loading state globally
let isLoadingScript = false
let isScriptLoaded = false

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // If Google Maps is already available
    if (window.google?.maps) {
      setIsLoaded(true)
      isScriptLoaded = true
      return
    }

    // If script is already being loaded, wait for it
    if (isLoadingScript) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          setIsLoaded(true)
          isScriptLoaded = true
          clearInterval(checkLoaded)
        }
      }, 100)
      return () => clearInterval(checkLoaded)
    }

    // Load script if not already loading or loaded
    if (!isScriptLoaded && !isLoadingScript) {
      isLoadingScript = true
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places,geometry`
      script.async = true
      script.defer = true
      script.id = 'google-maps'

      script.onload = () => {
        setIsLoaded(true)
        isScriptLoaded = true
        isLoadingScript = false
      }

      document.head.appendChild(script)
    }

    return () => {
      // Don't remove the script on unmount as it might be needed by other components
    }
  }, [])

  return (
    <GoogleMapsContext.Provider value={{ isLoaded }}>
      {children}
    </GoogleMapsContext.Provider>
  )
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext)
} 