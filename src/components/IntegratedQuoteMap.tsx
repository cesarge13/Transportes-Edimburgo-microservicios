import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { GooglePlacesAutocomplete } from '@/components/GooglePlacesAutocomplete'
import { mapsLogger } from '@/lib/mapsLogger'
import { MapPin, Navigation, Calendar, Clock, AlertCircle } from 'lucide-react'

interface IntegratedQuoteMapProps {
  quoteForm: {
    passengers: number
    kilometers: number
    serviceType: string
    origin: string
    destination: string
    date: string
    time: string
  }
  onQuoteFormChange: (form: any) => void
  onOriginSelect: (place: google.maps.places.PlaceResult) => void
  onDestinationSelect: (place: google.maps.places.PlaceResult) => void
  onUseCurrentLocation: () => void
  isGettingLocation: boolean
  routeInfo: {
    distance: number
    duration: number
    distanceText: string
    durationText: string
  } | null
  isCalculatingRoute: boolean
  calculatedPrice: number | null
  onCalculatePrice: () => void
  today: string
}

export const IntegratedQuoteMap = ({
  quoteForm,
  onQuoteFormChange,
  onOriginSelect,
  onDestinationSelect,
  onUseCurrentLocation,
  isGettingLocation,
  routeInfo,
  isCalculatingRoute,
  calculatedPrice,
  onCalculatePrice,
  today
}: IntegratedQuoteMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const originMarkerRef = useRef<google.maps.Marker | null>(null)
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectingPoint, setSelectingPoint] = useState<'origin' | 'destination' | null>(null)
  const [mapClickListener, setMapClickListener] = useState<google.maps.MapsEventListener | null>(null)

  // Inicializar mapa
  useEffect(() => {
    if (!window.google?.maps || !mapRef.current) return

    if (!mapInstanceRef.current) {
      let defaultCenter = { lat: -33.4489, lng: -70.6693 } // Santiago, Chile
      
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 10,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
      })
      
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapInstanceRef.current,
        suppressMarkers: true, // Usaremos nuestros propios marcadores
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      })
      
      directionsServiceRef.current = new window.google.maps.DirectionsService()
      
      setMapLoaded(true)
    }
  }, [])

  // Crear/actualizar marcadores cuando cambian origen y destino
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return

    const geocoder = new window.google.maps.Geocoder()

    // Actualizar marcador de origen
    if (quoteForm.origin) {
      geocoder.geocode({ address: quoteForm.origin }, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
          const location = results[0].geometry.location
          
          if (!originMarkerRef.current) {
            originMarkerRef.current = new window.google.maps.Marker({
              map: mapInstanceRef.current,
              position: location,
              draggable: true,
              label: 'A',
              title: 'Origen',
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#10b981',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            })

            // Cuando se arrastra el marcador, actualizar el origen
            originMarkerRef.current.addListener('dragend', () => {
              const newPosition = originMarkerRef.current!.getPosition()
              if (newPosition) {
                geocoder.geocode({ location: newPosition }, (reverseResults, reverseStatus) => {
                  if (reverseStatus === window.google.maps.GeocoderStatus.OK && reverseResults && reverseResults[0]) {
                    const address = reverseResults[0].formatted_address
                    
                    // No validar aquí - la validación se hará solo al calcular la ruta
                    // Usar función de actualización para preservar el estado del destino
                    onQuoteFormChange((prev: any) => ({ ...prev, origin: address }))
                    const place: google.maps.places.PlaceResult = {
                      formatted_address: address,
                      geometry: { location: newPosition },
                      place_id: reverseResults[0].place_id || ''
                    }
                    onOriginSelect(place)
                  }
                })
              }
            })
          } else {
            originMarkerRef.current.setPosition(location)
          }
        }
      })
    } else {
      if (originMarkerRef.current) {
        originMarkerRef.current.setMap(null)
        originMarkerRef.current = null
      }
    }

    // Actualizar marcador de destino
    if (quoteForm.destination) {
      geocoder.geocode({ address: quoteForm.destination }, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
          const location = results[0].geometry.location
          
          if (!destinationMarkerRef.current) {
            destinationMarkerRef.current = new window.google.maps.Marker({
              map: mapInstanceRef.current,
              position: location,
              draggable: true,
              label: 'B',
              title: 'Destino',
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            })

            // Cuando se arrastra el marcador, actualizar el destino
            destinationMarkerRef.current.addListener('dragend', () => {
              const newPosition = destinationMarkerRef.current!.getPosition()
              if (newPosition) {
                geocoder.geocode({ location: newPosition }, (reverseResults, reverseStatus) => {
                  if (reverseStatus === window.google.maps.GeocoderStatus.OK && reverseResults && reverseResults[0]) {
                    const address = reverseResults[0].formatted_address
                    
                    // No validar aquí - la validación se hará solo al calcular la ruta
                    // Usar función de actualización para preservar el estado del origen
                    onQuoteFormChange((prev: any) => ({ ...prev, destination: address }))
                    const place: google.maps.places.PlaceResult = {
                      formatted_address: address,
                      geometry: { location: newPosition },
                      place_id: reverseResults[0].place_id || ''
                    }
                    onDestinationSelect(place)
                  }
                })
              }
            })
          } else {
            destinationMarkerRef.current.setPosition(location)
          }
        }
      })
    } else {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setMap(null)
        destinationMarkerRef.current = null
      }
    }
  }, [quoteForm.origin, quoteForm.destination, mapLoaded, onQuoteFormChange, onOriginSelect, onDestinationSelect])

  // Calcular y mostrar ruta con debounce para evitar solicitudes mientras el usuario escribe
  useEffect(() => {
    if (!mapLoaded || !directionsServiceRef.current || !directionsRendererRef.current) {
      if (directionsRendererRef.current && (!quoteForm.origin || !quoteForm.destination)) {
        // Limpiar rutas del mapa
        directionsRendererRef.current.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult)
      }
      return
    }

    // Validar que las direcciones tengan una longitud mínima razonable
    // Esto evita intentar calcular rutas con direcciones incompletas
    const MIN_ADDRESS_LENGTH = 5
    if (!quoteForm.origin || !quoteForm.destination || 
        quoteForm.origin.trim().length < MIN_ADDRESS_LENGTH || 
        quoteForm.destination.trim().length < MIN_ADDRESS_LENGTH) {
      if (directionsRendererRef.current) {
        // Limpiar rutas del mapa
        directionsRendererRef.current.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult)
      }
      return
    }

    // Debounce: esperar 800ms después de que el usuario deje de escribir
    const timeoutId = setTimeout(() => {
      // Verificar nuevamente que las direcciones sigan siendo válidas
      if (!quoteForm.origin || !quoteForm.destination || 
          quoteForm.origin.trim().length < MIN_ADDRESS_LENGTH || 
          quoteForm.destination.trim().length < MIN_ADDRESS_LENGTH) {
        return
      }

      // Geocodificar direcciones para obtener coordenadas (más confiable que usar strings)
      const geocoder = new window.google.maps.Geocoder()
      
      Promise.all([
        new Promise<google.maps.LatLng | string>((resolve) => {
          geocoder.geocode({ address: quoteForm.origin }, (results, status) => {
            if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
              mapsLogger.logGeocode('geocode_origin_success', quoteForm.origin, results[0])
              resolve(results[0].geometry.location)
            } else {
              // Solo loggear errores si la dirección tiene sentido (no es muy corta)
              if (quoteForm.origin.trim().length >= MIN_ADDRESS_LENGTH) {
                mapsLogger.logGeocode('geocode_origin_error', quoteForm.origin, null, {
                  status: String(status),
                  message: `Error geocodificando origen: ${status}`
                })
              }
              // Fallback a string si falla el geocoding
              resolve(quoteForm.origin)
            }
          })
        }),
        new Promise<google.maps.LatLng | string>((resolve) => {
          geocoder.geocode({ address: quoteForm.destination }, (results, status) => {
            if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
              mapsLogger.logGeocode('geocode_destination_success', quoteForm.destination, results[0])
              resolve(results[0].geometry.location)
            } else {
              // Solo loggear errores si la dirección tiene sentido (no es muy corta)
              if (quoteForm.destination.trim().length >= MIN_ADDRESS_LENGTH) {
                mapsLogger.logGeocode('geocode_destination_error', quoteForm.destination, null, {
                  status: String(status),
                  message: `Error geocodificando destino: ${status}`
                })
              }
              // Fallback a string si falla el geocoding
              resolve(quoteForm.destination)
            }
          })
        })
      ]).then(([originLocation, destinationLocation]) => {
        if (!directionsServiceRef.current || !directionsRendererRef.current) return

        directionsServiceRef.current.route(
          {
            origin: originLocation,
            destination: destinationLocation,
            travelMode: window.google.maps.TravelMode.DRIVING,
            region: 'CL'
          },
          (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK && result && directionsRendererRef.current && mapInstanceRef.current) {
              mapsLogger.logRoute('map_route_display_success', quoteForm.origin, quoteForm.destination)
              directionsRendererRef.current.setDirections(result)
              if (result.routes && result.routes.length > 0 && result.routes[0].bounds) {
                mapInstanceRef.current.fitBounds(result.routes[0].bounds)
              }
            } else {
              // Solo loggear errores NOT_FOUND si las direcciones son razonablemente largas
              // Esto evita spam de logs cuando el usuario está escribiendo
              if (quoteForm.origin.trim().length >= MIN_ADDRESS_LENGTH && 
                  quoteForm.destination.trim().length >= MIN_ADDRESS_LENGTH) {
                mapsLogger.logError('map_route_display_error', {
                  status: String(status),
                  message: `Error mostrando ruta en mapa: ${status}`,
                  origin: quoteForm.origin,
                  destination: quoteForm.destination
                })
                if (status === window.google.maps.DirectionsStatus.NOT_FOUND) {
                  console.warn('No se encontró ruta entre los puntos. Verifica las direcciones.')
                }
              }
            }
          }
        )
      })
    }, 800) // Esperar 800ms después de que el usuario deje de escribir

    return () => {
      clearTimeout(timeoutId)
    }
  }, [quoteForm.origin, quoteForm.destination, mapLoaded])

  // Manejar clics en el mapa para seleccionar origen/destino
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !selectingPoint) return

    // Remover listener anterior si existe
    if (mapClickListener) {
      window.google.maps.event.removeListener(mapClickListener)
    }

    const listener = mapInstanceRef.current.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: e.latLng }, (results, status) => {
          if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
            const address = results[0].formatted_address
            
            // No validar aquí - la validación se hará solo al calcular la ruta
            const place: google.maps.places.PlaceResult = {
              formatted_address: address,
              geometry: { location: e.latLng || undefined },
              place_id: results[0].place_id || ''
            }

            if (selectingPoint === 'origin') {
              // Usar función de actualización para preservar el estado del destino
              onQuoteFormChange((prev: any) => ({ ...prev, origin: address }))
              onOriginSelect(place)
            } else {
              // Usar función de actualización para preservar el estado del origen
              onQuoteFormChange((prev: any) => ({ ...prev, destination: address }))
              onDestinationSelect(place)
            }
            setSelectingPoint(null)
          }
        })
      }
    })

    setMapClickListener(listener)

    return () => {
      if (listener) {
        window.google.maps.event.removeListener(listener)
      }
    }
  }, [selectingPoint, mapLoaded, quoteForm, onQuoteFormChange, onOriginSelect, onDestinationSelect])

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Formulario de Cotización */}
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Tipo de Servicio</label>
            <Select
              value={quoteForm.serviceType}
              onChange={(e) => onQuoteFormChange({ ...quoteForm, serviceType: e.target.value })}
            >
              <option value="aeropuerto">Aeropuerto (Ida y Vuelta)</option>
              <option value="hotel">Hotel</option>
              <option value="turistico">Turístico</option>
              <option value="tour">Tour (Viñeros, Playa, Nieve)</option>
              <option value="evento">Eventos y Matrimonios</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Pasajeros (máx. 7)</label>
            <Input
              type="number"
              min="1"
              max="7"
              value={quoteForm.passengers}
              onChange={(e) => onQuoteFormChange({ ...quoteForm, passengers: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Origen</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectingPoint('origin')}
                className="h-7 text-xs"
              >
                <MapPin className="h-3 w-3 mr-1" />
                {selectingPoint === 'origin' ? 'Clic en mapa' : 'Seleccionar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onUseCurrentLocation}
                disabled={isGettingLocation}
                className="h-7 text-xs"
              >
                <Navigation className="h-3 w-3 mr-1" />
                {isGettingLocation ? '...' : 'GPS'}
              </Button>
            </div>
          </div>
          <GooglePlacesAutocomplete
            value={quoteForm.origin}
            onChange={(value) => {
              // Solo actualizar si el valor realmente cambió
              // Usar función de actualización para evitar problemas con closures y estado desactualizado
              onQuoteFormChange((prev: any) => {
                if (prev.origin === value) return prev
                mapsLogger.logInfo('origin_input_changed', { 
                  oldValue: prev.origin, 
                  newValue: value 
                })
                return { ...prev, origin: value }
              })
            }}
            onPlaceSelect={onOriginSelect}
            placeholder="Ej: Aeropuerto de Santiago"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Destino</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectingPoint('destination')}
              className="h-7 text-xs"
            >
              <MapPin className="h-3 w-3 mr-1" />
              {selectingPoint === 'destination' ? 'Clic en mapa' : 'Seleccionar'}
            </Button>
          </div>
          <GooglePlacesAutocomplete
            value={quoteForm.destination}
            onChange={(value) => {
              // Solo actualizar si el valor realmente cambió
              // Usar función de actualización para evitar problemas con closures y estado desactualizado
              onQuoteFormChange((prev: any) => {
                if (prev.destination === value) return prev
                mapsLogger.logInfo('destination_input_changed', { 
                  oldValue: prev.destination, 
                  newValue: value 
                })
                return { ...prev, destination: value }
              })
            }}
            onPlaceSelect={onDestinationSelect}
            placeholder="Ej: Valparaíso, Viña del Mar"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Fecha del Viaje</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                min={today}
                value={quoteForm.date}
                onChange={(e) => onQuoteFormChange({ ...quoteForm, date: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Hora (opcional)</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={quoteForm.time}
                onChange={(e) => onQuoteFormChange({ ...quoteForm, time: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {routeInfo && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Distancia</p>
                <p className="font-semibold text-green-700">{routeInfo.distanceText}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tiempo</p>
                <p className="font-semibold text-green-700">{routeInfo.durationText}</p>
              </div>
            </div>
          </div>
        )}

        <Button 
          onClick={onCalculatePrice} 
          className="w-full" 
          size="lg"
          disabled={isCalculatingRoute || !quoteForm.origin || !quoteForm.destination}
        >
          {isCalculatingRoute ? 'Calculando...' : 'Calcular Precio'}
        </Button>
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Restricción de Regiones</p>
              <p className="text-blue-700 text-xs mt-1">
                Solo se permiten rutas dentro de Chile. Para habilitar otras regiones, contacta a un administrador.
              </p>
            </div>
          </div>
        </div>

        {calculatedPrice && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Precio Estimado</p>
            <p className="text-4xl font-bold text-primary">
              ${calculatedPrice.toLocaleString('es-CL')}
            </p>
            <Button className="mt-4 w-full" size="lg">
              Solicitar Cotización Detallada
            </Button>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Mapa de Ruta</h3>
          {selectingPoint && (
            <div className="text-sm text-primary font-medium">
              {selectingPoint === 'origin' ? '👆 Haz clic en el mapa para seleccionar origen' : '👆 Haz clic en el mapa para seleccionar destino'}
            </div>
          )}
        </div>
        <div 
          ref={mapRef} 
          className="w-full h-[600px] rounded-lg border"
          style={{ minHeight: '600px' }}
        />
        {selectingPoint && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            💡 Haz clic en cualquier punto del mapa para establecer el {selectingPoint === 'origin' ? 'origen' : 'destino'}
          </div>
        )}
        {!quoteForm.origin && !quoteForm.destination && (
          <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
            <MapPin className="h-5 w-5 mx-auto mb-2 opacity-50" />
            Ingresa origen y destino o haz clic en el mapa para seleccionar ubicaciones
          </div>
        )}
      </div>
    </div>
  )
}

