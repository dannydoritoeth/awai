"use client"

import { useState, useEffect } from 'react'

export function useGoogleMapsScript() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Check if script is already loaded
    if (window.google?.maps) {
      setIsLoaded(true)
      return
    }

    // Load script if not already present
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places,geometry`
    script.async = true
    script.defer = true
    script.id = 'google-maps'

    script.onload = () => {
      setIsLoaded(true)
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup if component unmounts before script loads
      const existingScript = document.getElementById('google-maps')
      if (existingScript) {
        document.head.removeChild(existingScript)
      }
    }
  }, [])

  return { isLoaded }
} 