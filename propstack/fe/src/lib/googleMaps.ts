let isScriptLoaded = false
let isScriptLoading = false

export function loadGoogleMapsScript(): Promise<void> {
  if (isScriptLoaded) {
    return Promise.resolve()
  }

  if (isScriptLoading) {
    return new Promise((resolve) => {
      const checkLoaded = setInterval(() => {
        if (isScriptLoaded) {
          clearInterval(checkLoaded)
          resolve()
        }
      }, 100)
    })
  }

  isScriptLoading = true

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places,geometry`
    script.async = true
    script.defer = true
    script.id = 'google-maps'

    script.onload = () => {
      isScriptLoaded = true
      isScriptLoading = false
      resolve()
    }

    script.onerror = () => {
      isScriptLoading = false
      reject(new Error('Failed to load Google Maps script'))
    }

    document.head.appendChild(script)
  })
} 