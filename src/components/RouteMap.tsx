import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Navigation } from 'lucide-react'

interface RouteMapProps {
  origin: string
  destination: string
  routeInfo: {
    distance: number
    duration: number
    distanceText: string
    durationText: string
  } | null
  onUseCurrentLocation: () => void
  isGettingLocation: boolean
}

export const RouteMap = ({
  origin,
  destination,
  routeInfo,
  onUseCurrentLocation,
  isGettingLocation
}: RouteMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (!window.google?.maps || !mapRef.current) return

    // Crear mapa si no existe
    if (!mapInstanceRef.current) {
      // Intentar obtener ubicación del usuario para centrar el mapa
      let defaultCenter = { lat: -33.4489, lng: -70.6693 } // Santiago, Chile como fallback
      
      if (navigator.geolocation) {
        // Obtener ubicación una vez para centrar el mapa inicialmente
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (mapInstanceRef.current) {
              const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
              mapInstanceRef.current.setCenter(userLocation)
              mapInstanceRef.current.setZoom(12)
            }
          },
          () => {
            // Si falla, usar el centro por defecto (ya está configurado)
            console.log('No se pudo obtener ubicación para centrar el mapa, usando ubicación por defecto')
          },
          { timeout: 5000, maximumAge: 60000 } // Usar caché de 1 minuto si está disponible
        )
      }
      
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 10,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
      })
      
      // Crear DirectionsRenderer
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapInstanceRef.current,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#3b82f6', // Color azul para la ruta
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      })
      
      // Crear DirectionsService
      directionsServiceRef.current = new window.google.maps.DirectionsService()
      
      setMapLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !origin || !destination || !directionsServiceRef.current || !directionsRendererRef.current) {
      // Limpiar ruta si no hay origen o destino
      if (directionsRendererRef.current && (!origin || !destination)) {
        directionsRendererRef.current.setDirections({ routes: [] })
      }
      return
    }

    // Calcular y mostrar ruta
      directionsServiceRef.current.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        region: 'CL' // Chile - código de región según documentación oficial
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result && directionsRendererRef.current && mapInstanceRef.current) {
          directionsRendererRef.current.setDirections(result)
          
          // Ajustar el mapa para mostrar toda la ruta
          if (result.routes && result.routes.length > 0 && result.routes[0].bounds) {
            mapInstanceRef.current.fitBounds(result.routes[0].bounds)
          }
        } else {
          console.error('Error mostrando ruta en el mapa:', status)
        }
      }
    )
  }, [origin, destination, mapLoaded])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Ruta del Viaje</CardTitle>
            <CardDescription>
              Visualiza la ruta en el mapa
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onUseCurrentLocation}
            disabled={isGettingLocation}
            className="flex items-center gap-2"
          >
            <Navigation className="h-4 w-4" />
            {isGettingLocation ? 'Detectando...' : 'Usar mi ubicación'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {routeInfo && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Distancia</p>
                <p className="font-semibold">{routeInfo.distanceText}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tiempo estimado</p>
                <p className="font-semibold">{routeInfo.durationText}</p>
              </div>
            </div>
          </div>
        )}
        <div 
          ref={mapRef} 
          className="w-full h-[400px] rounded-lg border"
          style={{ minHeight: '400px' }}
        />
        {(!origin || !destination) && (
          <div className="mt-4 p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
            <MapPin className="h-5 w-5 mx-auto mb-2 opacity-50" />
            Ingresa origen y destino para ver la ruta en el mapa
          </div>
        )}
      </CardContent>
    </Card>
  )
}

