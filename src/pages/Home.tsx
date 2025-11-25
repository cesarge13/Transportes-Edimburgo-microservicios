import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IntegratedQuoteMap } from '@/components/IntegratedQuoteMap'
import { AdminRegionPanel } from '@/components/AdminRegionPanel'
import { calculateRoute, loadGoogleMapsScript, RouteInfo } from '@/lib/googleMaps'
import { validateRouteRegions, validateAddressRegion } from '@/lib/regionValidation'
import { mapsLogger } from '@/lib/mapsLogger'
import { notifyError, notifyWarning, notifyInfo } from '@/lib/notifications'
import { MapPin, Clock, Users, Car, Shield, Star, Phone, Mail } from 'lucide-react'

interface QuoteForm {
  passengers: number
  kilometers: number
  serviceType: string
  origin: string
  destination: string
  date: string
  time: string
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

const Home = () => {
  const [quoteForm, setQuoteForm] = useState<QuoteForm>({
    passengers: 1,
    kilometers: 0,
    serviceType: 'aeropuerto',
    origin: '',
    destination: '',
    date: '',
    time: ''
  })

  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false)
  const [originPlace, setOriginPlace] = useState<google.maps.places.PlaceResult | null>(null)
  const [destinationPlace, setDestinationPlace] = useState<google.maps.places.PlaceResult | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Cargar Google Maps API
  useEffect(() => {
    if (GOOGLE_MAPS_API_KEY) {
      loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
        .then(() => {
          setGoogleMapsLoaded(true)
        })
        .catch((error) => {
          console.error('Error cargando Google Maps:', error)
        })
    }
  }, [])

  // Calcular ruta cuando cambien origen o destino (solo cuando hay lugares completos seleccionados)
  useEffect(() => {
    // Solo calcular si hay lugares completos seleccionados (no solo texto escrito)
    // Esto evita validar mientras el usuario está escribiendo
    if (!googleMapsLoaded || !originPlace || !destinationPlace) {
      return
    }

    // Validar que las direcciones tengan una longitud mínima razonable
    const MIN_ADDRESS_LENGTH = 5
    if (!quoteForm.origin || !quoteForm.destination || 
        quoteForm.origin.trim().length < MIN_ADDRESS_LENGTH || 
        quoteForm.destination.trim().length < MIN_ADDRESS_LENGTH) {
      return
    }

    // Debounce: esperar 1000ms después de que se seleccione un lugar completo
    const timeoutId = setTimeout(() => {
      // Verificar nuevamente que todo siga siendo válido
      if (!originPlace || !destinationPlace || 
          !quoteForm.origin || !quoteForm.destination ||
          quoteForm.origin.trim().length < MIN_ADDRESS_LENGTH || 
          quoteForm.destination.trim().length < MIN_ADDRESS_LENGTH) {
        return
      }

      setIsCalculatingRoute(true)
      
      // Validar regiones antes de calcular la ruta
      mapsLogger.logInfo('route_validation_start', {
        origin: quoteForm.origin,
        destination: quoteForm.destination,
        hasOriginPlace: !!originPlace,
        hasDestinationPlace: !!destinationPlace
      })
      
      validateRouteRegions(quoteForm.origin, quoteForm.destination)
        .then((validation) => {
          if (!validation.valid) {
            const errorMessage = validation.errors.join('\n')
            // Solo loggear errores si las direcciones son razonablemente largas
            // Esto evita spam de logs cuando el usuario está escribiendo
            if (quoteForm.origin.trim().length >= MIN_ADDRESS_LENGTH && 
                quoteForm.destination.trim().length >= MIN_ADDRESS_LENGTH) {
              mapsLogger.logError('route_validation_failed', {
                message: errorMessage,
                origin: quoteForm.origin,
                destination: quoteForm.destination
              })
              notifyError(errorMessage)
            }
            setIsCalculatingRoute(false)
            return
          }
          
          mapsLogger.logInfo('route_validation_success', {
            origin: quoteForm.origin,
            destination: quoteForm.destination
          })
          
          // Si la validación pasa, calcular la ruta usando los PlaceResult con coordenadas
          // Esto es más confiable que usar direcciones como strings
          return calculateRoute(originPlace, destinationPlace)
        })
        .then((info) => {
          if (info) {
            setRouteInfo(info)
            setQuoteForm(prev => ({ ...prev, kilometers: info.distance }))
          }
          setIsCalculatingRoute(false)
        })
        .catch(() => {
          setIsCalculatingRoute(false)
        })
    }, 1000) // Esperar 1 segundo después de seleccionar un lugar

    return () => {
      clearTimeout(timeoutId)
    }
  }, [googleMapsLoaded, originPlace, destinationPlace, quoteForm.origin, quoteForm.destination])

  const calculatePrice = async () => {
    if (!quoteForm.kilometers || quoteForm.kilometers <= 0) {
      const message = 'Por favor, ingresa origen y destino para calcular la distancia'
      mapsLogger.logError('calculate_price_error', {
        message,
        kilometers: quoteForm.kilometers
      })
      notifyWarning(message)
      return
    }

    // Validar regiones antes de calcular precio
    if (quoteForm.origin && quoteForm.destination) {
      const validation = await validateRouteRegions(quoteForm.origin, quoteForm.destination)
      if (!validation.valid) {
        const errorMessage = validation.errors.join('\n')
        mapsLogger.logError('price_validation_failed', {
          message: errorMessage,
          origin: quoteForm.origin,
          destination: quoteForm.destination
        })
        notifyError(errorMessage)
        return
      }
    }

    // Precio base por kilómetro según tipo de servicio
    const pricePerKm: Record<string, number> = {
      aeropuerto: 800,
      hotel: 750,
      turistico: 850,
      evento: 900,
      tour: 850
    }

    const kmPrice = pricePerKm[quoteForm.serviceType] || 800
    
    // Cálculo base por kilómetros
    let total = kmPrice * quoteForm.kilometers
    
    // Ajuste por pasajeros (si hay más de 4 pasajeros, pequeño incremento)
    if (quoteForm.passengers > 4) {
      total = total * 1.1 // 10% adicional para 5-7 pasajeros
    }
    
    // Precio mínimo por servicio
    const minPrice = 25000
    total = Math.max(total, minPrice)
    
    setCalculatedPrice(Math.round(total))
  }

  const handleOriginSelect = (place: google.maps.places.PlaceResult) => {
    mapsLogger.logPlace('origin_selected', place)
    
    // No validar aquí - la validación se hará solo al calcular la ruta
    setOriginPlace(place)
    if (place.formatted_address) {
      mapsLogger.logInfo('origin_address_set', {
        address: place.formatted_address,
        placeId: place.place_id,
        hasCoordinates: !!place.geometry?.location
      })
      setQuoteForm(prev => ({ ...prev, origin: place.formatted_address! }))
    } else {
      mapsLogger.logError('origin_selection_error', {
        message: 'El lugar seleccionado no tiene dirección formateada',
        placeId: place.place_id
      })
    }
  }

  const handleDestinationSelect = (place: google.maps.places.PlaceResult) => {
    mapsLogger.logPlace('destination_selected', place)
    
    // No validar aquí - la validación se hará solo al calcular la ruta
    setDestinationPlace(place)
    if (place.formatted_address) {
      mapsLogger.logInfo('destination_address_set', {
        address: place.formatted_address,
        placeId: place.place_id,
        hasCoordinates: !!place.geometry?.location
      })
      setQuoteForm(prev => ({ ...prev, destination: place.formatted_address! }))
    } else {
      mapsLogger.logError('destination_selection_error', {
        message: 'El lugar seleccionado no tiene dirección formateada',
        placeId: place.place_id
      })
    }
  }

  const handleUseCurrentLocation = async () => {
    mapsLogger.logInfo('current_location_request_start', {})
    
    // Verificar que geolocalización esté disponible
    if (!navigator.geolocation) {
      const message = 'Tu navegador no soporta geolocalización. Por favor usa un navegador moderno.'
      mapsLogger.logError('geolocation_not_supported', { message })
      notifyWarning(message)
      return
    }

    setIsGettingLocation(true)
    mapsLogger.logInfo('geolocation_started', {})

    // Verificar permisos primero (si está disponible)
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        mapsLogger.logInfo('geolocation_permission_checked', { state: permission.state })
        
        if (permission.state === 'denied') {
          const message = 'El permiso de ubicación está denegado. Por favor habilítalo en la configuración de tu navegador.'
          mapsLogger.logError('geolocation_permission_denied', { message })
          notifyWarning(message)
          setIsGettingLocation(false)
          return
        }
      } catch (permError) {
        mapsLogger.logInfo('geolocation_permission_check_failed', { error: String(permError) })
        console.warn('No se pudo verificar permisos:', permError)
        // Continuar de todas formas
      }
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        mapsLogger.logInfo('geolocation_position_obtained', {
          latitude,
          longitude,
          accuracy
        })
        
        // Verificar que las coordenadas sean válidas (no NaN, no 0,0)
        if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
          const message = 'Error: No se pudieron obtener coordenadas válidas.'
          mapsLogger.logError('geolocation_invalid_coordinates', {
            message,
            latitude,
            longitude
          })
          notifyError(message)
          setIsGettingLocation(false)
          return
        }

        // Verificar que no sean coordenadas 0,0 (océano)
        if (latitude === 0 && longitude === 0) {
          const message = 'Error: Ubicación no válida. Por favor intenta de nuevo.'
          mapsLogger.logError('geolocation_zero_coordinates', { message })
          notifyError(message)
          setIsGettingLocation(false)
          return
        }

        if (!window.google?.maps) {
          const message = 'Google Maps no está cargado. Por favor espera un momento e intenta de nuevo.'
          mapsLogger.logError('geolocation_maps_not_loaded', { message })
          notifyWarning(message)
          setIsGettingLocation(false)
          return
        }

        try {
          // Usar Geocoding para obtener la dirección desde las coordenadas
          const geocoder = new window.google.maps.Geocoder()
          
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results, status) => {
              if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
                const address = results[0].formatted_address
                mapsLogger.logGeocode('current_location_geocode_success', address, results[0])
                
                setQuoteForm(prev => ({ ...prev, origin: address }))
                
                // Crear un PlaceResult simulado para mantener la consistencia
                const place: google.maps.places.PlaceResult = {
                  formatted_address: address,
                  geometry: {
                    location: new window.google.maps.LatLng(latitude, longitude)
                  },
                  place_id: results[0].place_id || ''
                }
                setOriginPlace(place)
                mapsLogger.logInfo('current_location_set', {
                  address,
                  coordinates: { latitude, longitude }
                })
                notifyInfo('Ubicación actual establecida como origen')
              } else {
                mapsLogger.logGeocode('current_location_geocode_failed', `${latitude}, ${longitude}`, null, {
                  status: String(status),
                  message: `Geocoding falló: ${status}`
                })
                // Si falla el geocoding, usar las coordenadas directamente
                const address = `${latitude}, ${longitude}`
                setQuoteForm(prev => ({ ...prev, origin: address }))
                
                // Crear place con coordenadas
                const place: google.maps.places.PlaceResult = {
                  formatted_address: address,
                  geometry: {
                    location: new window.google.maps.LatLng(latitude, longitude)
                  },
                  place_id: ''
                }
                setOriginPlace(place)
                notifyInfo('Ubicación establecida usando coordenadas')
              }
              setIsGettingLocation(false)
            }
          )
        } catch (error) {
          mapsLogger.logError('geolocation_geocode_exception', {
            message: `Error en geocoding: ${error}`,
            latitude,
            longitude
          })
          // Fallback: usar coordenadas directamente
          const address = `${latitude}, ${longitude}`
          setQuoteForm(prev => ({ ...prev, origin: address }))
          
          const place: google.maps.places.PlaceResult = {
            formatted_address: address,
            geometry: {
              location: new window.google.maps.LatLng(latitude, longitude)
            },
            place_id: ''
          }
          setOriginPlace(place)
          setIsGettingLocation(false)
        }
      },
      (error) => {
        mapsLogger.logError('geolocation_error', {
          code: error.code,
          message: 'Error de geolocalización'
        })
        
        let message = 'Error al obtener tu ubicación.'
        
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Permiso de ubicación denegado. Por favor habilita el acceso a tu ubicación en la configuración del navegador.'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Ubicación no disponible. Verifica que tu GPS esté activado y que tengas señal.'
        } else if (error.code === error.TIMEOUT) {
          message = 'Tiempo de espera agotado. Por favor intenta de nuevo.'
        }
        
        notifyError(message)
        setIsGettingLocation(false)
      },
      {
        enableHighAccuracy: true, // Usar GPS si está disponible
        timeout: 15000, // Aumentar timeout a 15 segundos
        maximumAge: 0 // No usar ubicación en caché
      }
    )
  }

  const destinations = [
    { name: 'Valparaíso', price: 'Desde $45.000', distance: '120 km' },
    { name: 'Viña del Mar', price: 'Desde $45.000', distance: '115 km' },
    { name: 'Cajón del Maipo', price: 'Desde $35.000', distance: '50 km' },
    { name: 'Isla Negra', price: 'Desde $50.000', distance: '110 km' },
    { name: 'Pomaire', price: 'Desde $40.000', distance: '80 km' },
    { name: 'Termas de Cauquenes', price: 'Desde $60.000', distance: '150 km' },
  ]

  const services = [
    {
      title: 'Aeropuerto',
      description: 'Traslados ida y vuelta al aeropuerto con puntualidad garantizada',
      icon: MapPin,
      features: ['Recogida en aeropuerto', 'Espera incluida', 'Equipaje asistido', 'Disponible 24 hrs.']
    },
    {
      title: 'Hotel',
      description: 'Servicio exclusivo para hoteles y hospedajes',
      icon: Shield,
      features: ['Disponibilidad 24/7', 'Servicio personalizado', 'Flota moderna', 'Viajes personalizados']
    },
    {
      title: 'Tours',
      description: 'Tours viñeros, playa y nieve. Viajes personalizados por Chile',
      icon: Star,
      features: ['Tours viñeros', 'Tours a la playa', 'Tours a la nieve', 'Rutas personalizadas']
    },
    {
      title: 'Eventos',
      description: 'Matrimonios y eventos especiales con servicio premium',
      icon: Clock,
      features: ['Matrimonios', 'Eventos especiales', 'Chófer profesional', 'Servicio de lujo']
    },
  ]

  // Obtener fecha mínima (hoy)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Car className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Transportes Edimburgo</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:+56989448371" className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">+56 9 8944 8371</span>
            </a>
            <Button>Contactar</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Transporte de Lujo en Chile
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Transportes Edimburgo ofrece soluciones confiables en movilidad de pasajeros. Especializados en traslados turísticos, hoteleros, de aeropuerto y eventos, garantizamos puntualidad, seguridad y un servicio de excelencia en cada viaje.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg">
              <Car className="h-5 w-5 text-primary" />
              <span className="font-semibold">KIA Carnival 2025</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-semibold">Hasta 7 pasajeros</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-semibold">Disponible 24 hrs.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Panel de Administración de Regiones */}
      <section className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <AdminRegionPanel />
        </div>
      </section>

      {/* Calculadora de Cotización Integrada con Mapa */}
      <section className="container mx-auto px-4 py-12">
        <Card className="max-w-7xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl">Calcula tu Tarifa por KM</CardTitle>
            <CardDescription>
              Planifica tu viaje sin complicaciones. Selecciona origen y destino en el mapa o ingrésalos manualmente. Todo está sincronizado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!GOOGLE_MAPS_API_KEY && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Para usar la calculadora automática, configura VITE_GOOGLE_MAPS_API_KEY en tu archivo .env
                </p>
              </div>
            )}
            
            {googleMapsLoaded ? (
              <IntegratedQuoteMap
                quoteForm={quoteForm}
                onQuoteFormChange={setQuoteForm}
                onOriginSelect={handleOriginSelect}
                onDestinationSelect={handleDestinationSelect}
                onUseCurrentLocation={handleUseCurrentLocation}
                isGettingLocation={isGettingLocation}
                routeInfo={routeInfo}
                isCalculatingRoute={isCalculatingRoute}
                calculatedPrice={calculatedPrice}
                onCalculatePrice={calculatePrice}
                today={today}
              />
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <p>Cargando Google Maps...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Servicios */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Nuestros Servicios</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service) => (
            <Card key={service.title} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <service.icon className="h-10 w-10 text-primary mb-4" />
                <CardTitle>{service.title}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Destinos */}
      <section className="container mx-auto px-4 py-16 bg-muted/50">
        <h2 className="text-3xl font-bold text-center mb-12">Destinos Populares</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {destinations.map((destination) => (
            <Card key={destination.name} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  {destination.name}
                </CardTitle>
                <CardDescription>{destination.distance}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">{destination.price}</span>
                  <Button variant="outline" size="sm">Ver Detalles</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Vehículo */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl">Nuestro Vehículo</CardTitle>
            <CardDescription>KIA Carnival 2025 - Lujo y Comodidad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Características</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Capacidad para 7 pasajeros</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    <span>Modelo 2025 - Flota nueva</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span>Seguridad y confort premium</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    <span>Servicio de lujo garantizado</span>
                  </li>
                </ul>
              </div>
              <div className="bg-muted rounded-lg p-8 flex items-center justify-center">
                <Car className="h-32 w-32 text-primary/20" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA Final */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-3xl mx-auto bg-primary text-primary-foreground">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Reserva tu Viaje Hoy!</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Contáctanos ahora y planifica tu viaje sin complicaciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:+56989448371">
                <Button variant="secondary" size="lg" className="flex items-center gap-2 w-full sm:w-auto">
                  <Phone className="h-5 w-5" />
                  +56 9 8944 8371
                </Button>
              </a>
              <a href="mailto:transportesedimburgo@icloud.com">
                <Button variant="outline" size="lg" className="flex items-center gap-2 bg-background text-foreground w-full sm:w-auto">
                  <Mail className="h-5 w-5" />
                  transportesedimburgo@icloud.com
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/50 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Transportes Edimburgo</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Ofrecemos soluciones confiables en movilidad de pasajeros. Especializados en traslados turísticos, hoteleros, de aeropuerto y eventos.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Matías Correa</strong> - Garantizamos puntualidad, seguridad y un servicio de excelencia en cada viaje.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Contacto</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <a href="tel:+56989448371" className="hover:text-primary">+56 9 8944 8371</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <a href="mailto:transportesedimburgo@icloud.com" className="hover:text-primary">transportesedimburgo@icloud.com</a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Servicios</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Aeropuerto (Ida y Vuelta)</li>
                <li>Hotel</li>
                <li>Tours (Viñeros, Playa, Nieve)</li>
                <li>Matrimonios y Eventos</li>
                <li>Transporte disponible 24 hrs.</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2024 Transportes Edimburgo. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
