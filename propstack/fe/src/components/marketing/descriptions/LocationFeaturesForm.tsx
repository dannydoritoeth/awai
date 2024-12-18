"use client"

import { useState, useRef, useEffect } from 'react'
import { GoogleMap, Marker, StandaloneSearchBox } from '@react-google-maps/api'
import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider'

interface LocationFeaturesFormProps {
  onBack: () => void
  onNext: () => void
  formData: ListingFormData
  onChange: (updates: Partial<ListingFormData>) => void
}

interface NearbyFeature {
  id: number
  name: string
  type: string
  distance: string
  position: google.maps.LatLng | google.maps.LatLngLiteral
}

export function LocationFeaturesForm({ onBack, onNext, formData, onChange }: LocationFeaturesFormProps) {
  const defaultCenter = { lat: 43.6532, lng: -79.3832 } // Toronto coordinates
  
  const [selectedFeatures, setSelectedFeatures] = useState<NearbyFeature[]>([])
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const placesService = useRef<google.maps.places.PlacesService | null>(null)
  const [mapCenter, setMapCenter] = useState(defaultCenter)
  const geocoder = useRef<google.maps.Geocoder | null>(null)
  
  const { isLoaded } = useGoogleMaps()

  const [language, setLanguage] = useState('English (Australia)')
  const [length, setLength] = useState('300')
  const [unit, setUnit] = useState('Words')

  useEffect(() => {
    if (isLoaded) {
      geocoder.current = new google.maps.Geocoder()
      
      if (formData.address && geocoder.current) {
        console.log('Starting geocoding for:', formData.address)
        
        geocoder.current.geocode(
          { address: formData.address },
          (results, status) => {
            console.log('Geocoding status:', status)
            if (status === 'OK' && results?.[0]?.geometry?.location) {
              const location = results[0].geometry.location
              console.log('Found location:', location.toString())
              
              // Set map center immediately
              setMapCenter({
                lat: location.lat(),
                lng: location.lng()
              })

              // Initialize Places service and search
              if (!placesService.current && mapRef.current) {
                console.log('Initializing Places service')
                placesService.current = new google.maps.places.PlacesService(mapRef.current)
              }

              if (placesService.current) {
                searchNearbyPlaces(location)
              } else {
                console.error('Places service not available')
              }
            } else {
              console.error('Geocoding failed:', status)
            }
          }
        )
      }
    }
  }, [isLoaded, formData.address])

  const handlePlaceSelect = () => {
    if (searchBox) {
      const places = searchBox.getPlaces()
      if (places && places.length > 0) {
        const place = places[0]
        if (place.geometry?.location) {
          const id = selectedFeatures.length + 1
          const feature: NearbyFeature = {
            id,
            name: place.name || '',
            type: place.types?.[0] || '',
            position: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            },
            distance: calculateDistance(
              formData.fullAddress?.geometry?.location,
              place.geometry.location
            )
          }
          setSelectedFeatures(prev => [...prev, feature])

          if (mapRef.current) {
            mapRef.current.panTo(place.geometry.location)
          }
        }
      }
    }
  }

  const calculateDistance = (from?: google.maps.LatLng, to?: google.maps.LatLng) => {
    try {
      if (!from || !to || !google.maps.geometry) return '0km'
      const distance = google.maps.geometry.spherical.computeDistanceBetween(from, to)
      return `${(distance / 1000).toFixed(1)}km`
    } catch (error) {
      console.error('Error calculating distance:', error)
      return '0km'
    }
  }

  const removeFeature = (id: number) => {
    setSelectedFeatures(prev => prev.filter(f => f.id !== id))
  }

  const mapOptions = {
    disableDefaultUI: true,
    clickableIcons: false,
    styles: [
      {
        featureType: "poi",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.school",
        stylers: [{ visibility: "on" }]
      },
      {
        featureType: "poi.medical",
        stylers: [{ visibility: "on" }]
      },
      {
        featureType: "poi.business",
        elementType: "labels",
        stylers: [{ visibility: "on" }]
      },
      {
        featureType: "transit.station.airport",
        stylers: [{ visibility: "on" }]
      }
    ]
  }

  const handleMapLoad = (map: google.maps.Map) => {
    mapRef.current = map
    placesService.current = new google.maps.places.PlacesService(map)
    
    // Convert address to coordinates and search
    if (formData.address && geocoder.current) {
      geocoder.current.geocode(
        { address: formData.address },
        (results, status) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location
            searchNearbyPlaces(location)
          }
        }
      )
    }
  }

  const searchNearbyPlaces = (location: google.maps.LatLng) => {
    if (!placesService.current) return

    // First search for schools and medical facilities
    const primaryRequest = {
      location,
      radius: 2000,
      type: [
        'primary_school',
        'school',
        'secondary_school',
        'university',
        'hospital'
      ]
    } as google.maps.places.PlaceSearchRequest

    // Second search for shopping and transport
    const secondaryRequest = {
      location,
      radius: 2000,
      type: [
        'shopping_mall',
        'supermarket',
        'train_station',
        'subway_station'
      ]
    } as google.maps.places.PlaceSearchRequest

    try {
      placesService.current.nearbySearch(primaryRequest, (results1, status1) => {
        if (status1 === google.maps.places.PlacesServiceStatus.OK && results1) {
          placesService.current!.nearbySearch(secondaryRequest, (results2, status2) => {
            if (status2 === google.maps.places.PlacesServiceStatus.OK && results2) {
              const allResults = [...results1, ...results2]
              
              const nearbyFeatures = allResults
                .filter(place => {
                  // Keep only specific types we want
                  const wantedTypes = [
                    'school',
                    'primary_school',
                    'secondary_school',
                    'university',
                    'hospital',
                    'shopping_mall',
                    'supermarket',
                    'train_station',
                    'subway_station'
                  ]
                  
                  return place.geometry?.location && 
                         place.types?.some(type => wantedTypes.includes(type))
                })
                .slice(0, 10)
                .map((place, index) => ({
                  id: index + 1,
                  name: place.name || '',
                  // Make type names more readable
                  type: place.types?.[0]?.split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ') || '',
                  position: {
                    lat: place.geometry!.location.lat(),
                    lng: place.geometry!.location.lng()
                  },
                  distance: calculateDistance(location, place.geometry!.location)
                }))

              setSelectedFeatures(nearbyFeatures)
            }
          })
        }
      })
    } catch (error) {
      console.error('Error in nearbySearch:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left Column - Map & Search */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Community Highlights</h3>
          <p className="text-sm text-gray-600 mb-4">Highlighting nearby features helps the AI understand the property better.</p>
          
          {isLoaded ? (
            <>
              <div className="mb-4">
                <StandaloneSearchBox
                  onLoad={ref => setSearchBox(ref)}
                  onPlacesChanged={handlePlaceSelect}
                >
                  <input
                    type="text"
                    placeholder="Search for nearby places..."
                    className="w-full form-input"
                  />
                </StandaloneSearchBox>
              </div>
              <div className="h-[400px] rounded-lg overflow-hidden border border-gray-200">
                <GoogleMap
                  zoom={15}
                  center={mapCenter}
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  options={mapOptions}
                  onLoad={handleMapLoad}
                >
                  {selectedFeatures.map(feature => (
                    <Marker
                      key={feature.id}
                      position={feature.position}
                      label={feature.id.toString()}
                    />
                  ))}
                </GoogleMap>
              </div>
            </>
          ) : (
            <div className="h-[400px] bg-gray-100 rounded-lg animate-pulse" />
          )}
        </div>

        {/* Right Column - Selected Locations */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Selected locations</h3>
          <p className="text-sm text-gray-600 mb-4">For best results use only 3 to 6 locations.</p>

          <div className="space-y-2">
            {selectedFeatures.map((feature) => (
              <div key={feature.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm mr-2">
                    {feature.id}
                  </span>
                  <div>
                    <span className="text-gray-900">{feature.name}</span>
                    <div className="text-sm text-gray-500">
                      {feature.type.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                      <span className="mx-1">·</span>
                      {feature.distance}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeFeature(feature.id)}
                  className="text-red-600 text-sm hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 text-gray-600 hover:text-gray-900 flex items-center gap-2"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={onNext}
          className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
} 