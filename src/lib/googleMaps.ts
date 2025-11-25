// Utilidades para Google Maps API
import { mapsLogger } from './mapsLogger'

export interface RouteInfo {
  distance: number // en kilómetros
  duration: number // en minutos
  distanceText: string
  durationText: string
}

export const calculateRoute = async (
  origin: string | google.maps.LatLng | google.maps.places.PlaceResult,
  destination: string | google.maps.LatLng | google.maps.places.PlaceResult
): Promise<RouteInfo | null> => {
  if (!window.google || !window.google.maps) {
    console.error('Google Maps API no está cargada')
    return null
  }

  // Usar Directions Service para calcular rutas
  // IMPORTANTE: Directions API debe estar habilitada en Google Cloud Console
  if (!window.google.maps.DirectionsService) {
    console.error('Directions Service no está disponible. Habilita Directions API en Google Cloud Console: https://console.cloud.google.com/apis/library/directions-backend.googleapis.com')
    return null
  }

  try {
    const directionsService = new window.google.maps.DirectionsService()

    // Loggear inicio del cálculo de ruta
    mapsLogger.logRoute('calculate_route_start', origin, destination)

    // Convertir origen y destino a formato que Directions API acepta
    // Preferir coordenadas sobre direcciones para mayor precisión
    let originRequest: string | google.maps.LatLng
    let destinationRequest: string | google.maps.LatLng

    // Procesar origen
    if (typeof origin === 'string') {
      originRequest = origin
    } else if (origin instanceof window.google.maps.LatLng) {
      originRequest = origin
    } else if (origin.geometry?.location) {
      // Es un PlaceResult con geometría
      originRequest = origin.geometry.location
    } else {
      // Fallback a dirección formateada
      originRequest = origin.formatted_address || String(origin)
    }

    // Procesar destino
    if (typeof destination === 'string') {
      destinationRequest = destination
    } else if (destination instanceof window.google.maps.LatLng) {
      destinationRequest = destination
    } else if (destination.geometry?.location) {
      // Es un PlaceResult con geometría
      destinationRequest = destination.geometry.location
    } else {
      // Fallback a dirección formateada
      destinationRequest = destination.formatted_address || String(destination)
    }

    // Loggear los valores que se enviarán a la API
    mapsLogger.logInfo('route_request', {
      originType: typeof originRequest === 'string' ? 'string' : 'LatLng',
      destinationType: typeof destinationRequest === 'string' ? 'string' : 'LatLng',
      originValue: typeof originRequest === 'string' 
        ? originRequest 
        : { lat: originRequest.lat(), lng: originRequest.lng() },
      destinationValue: typeof destinationRequest === 'string'
        ? destinationRequest
        : { lat: destinationRequest.lat(), lng: destinationRequest.lng() }
    })

    // Configuración de la solicitud de ruta
    const request: google.maps.DirectionsRequest = {
      origin: originRequest,
      destination: destinationRequest,
      travelMode: window.google.maps.TravelMode.DRIVING,
      region: 'CL' // Chile - código de región según documentación oficial
    }

    // DirectionsService.route() puede usar callbacks o Promises
    // Usamos una Promise wrapper para mantener compatibilidad
    return new Promise<RouteInfo | null>((resolve) => {
      directionsService.route(
        request,
        (
          result: google.maps.DirectionsResult | null,
          status: google.maps.DirectionsStatus
        ) => {
          if (status === window.google.maps.DirectionsStatus.OK && result) {
            const route = result.routes[0]
            if (route.legs && route.legs.length > 0) {
              const leg = route.legs[0]
              
              if (leg.distance && leg.duration) {
                const distance = leg.distance.value / 1000 // Convertir a kilómetros
                const duration = leg.duration.value / 60 // Convertir a minutos

                const routeInfo = {
                  distance,
                  duration,
                  distanceText: leg.distance.text,
                  durationText: leg.duration.text
                }

                // Loggear éxito
                mapsLogger.logRoute('calculate_route_success', origin, destination, routeInfo)

                resolve(routeInfo)
                return
              }
            }
          }
          
          // Manejo de errores con mensajes más descriptivos
          let errorMessage = 'Error desconocido al calcular la ruta'
          let errorCode = status
          
          if (status === window.google.maps.DirectionsStatus.REQUEST_DENIED) {
            errorMessage = 'La API key no tiene permisos. Habilita Directions API en Google Cloud Console.'
            console.error(errorMessage)
          } else if (status === window.google.maps.DirectionsStatus.ZERO_RESULTS) {
            errorMessage = 'No se encontró ruta entre los puntos especificados. Verifica que las direcciones sean correctas.'
            console.error(errorMessage)
          } else if (status === window.google.maps.DirectionsStatus.NOT_FOUND) {
            errorMessage = 'Uno o ambos puntos de origen/destino no se encontraron. Por favor, verifica las direcciones e intenta nuevamente.'
            console.error(errorMessage)
          } else if (status === window.google.maps.DirectionsStatus.OVER_QUERY_LIMIT) {
            errorMessage = 'Se ha excedido el límite de consultas. Por favor, intenta más tarde.'
            console.error(errorMessage)
          } else if (status === window.google.maps.DirectionsStatus.INVALID_REQUEST) {
            errorMessage = 'La solicitud de ruta no es válida. Verifica que las direcciones estén completas.'
            console.error(errorMessage)
          } else {
            console.error('Error calculando ruta:', status, errorMessage)
          }
          
          // Loggear error
          mapsLogger.logError('calculate_route_error', {
            code: errorCode,
            status: String(status),
            message: errorMessage,
            origin,
            destination
          })
          
          // Mostrar error al usuario solo si es un error crítico
          if (status === window.google.maps.DirectionsStatus.NOT_FOUND || 
              status === window.google.maps.DirectionsStatus.ZERO_RESULTS) {
            // No mostrar alert aquí, dejar que el componente maneje el error
            console.warn('No se pudo calcular la ruta:', errorMessage)
          }
          
          resolve(null)
        }
      )
    })
  } catch (error) {
    console.error('Error al calcular ruta:', error)
    return null
  }
}

// Variable global para evitar cargar el script múltiples veces
let googleMapsLoadingPromise: Promise<void> | null = null

export const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  // Si ya está cargada, resolver inmediatamente
  if (window.google && window.google.maps) {
    return Promise.resolve()
  }

  // Si ya hay una carga en progreso, retornar esa promesa
  if (googleMapsLoadingPromise) {
    return googleMapsLoadingPromise
  }

  // Verificar si ya existe un script de Google Maps
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
  if (existingScript) {
    // Esperar a que el script existente se cargue
    googleMapsLoadingPromise = new Promise((resolve) => {
      const checkGoogle = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogle)
          resolve()
        }
      }, 100)
      
      // Timeout después de 10 segundos
      setTimeout(() => {
        clearInterval(checkGoogle)
        resolve()
      }, 10000)
    })
    return googleMapsLoadingPromise
  }

  // Crear nueva promesa de carga
  // Según documentación oficial: https://developers.google.com/maps/documentation/javascript
  googleMapsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    // Cargar "places" para autocompletado de direcciones
    // Directions Service está incluido en la API base, no necesita librería separada
    // Usar solo 'defer' según mejores prácticas (no async y defer juntos)
    // Localización según documentación oficial: https://developers.google.com/maps/documentation/javascript/localization
    // language=es: Español para controles, direcciones y etiquetas
    // region=CL: Chile - sesga resultados de geocoding y asegura cumplimiento con leyes locales
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=CL`
    script.defer = true
    script.id = 'google-maps-script'
    
    script.onload = () => {
      // Esperar a que Google Maps se inicialice completamente
      // Verificar que tanto google como google.maps estén disponibles
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval)
          // Verificar que Places API esté disponible
          if (window.google.maps.places) {
            resolve()
          } else {
            console.warn('Places API no está disponible. Asegúrate de que Places API esté habilitada.')
            resolve() // Resolver de todas formas para no bloquear
          }
        }
      }, 50)
      
      // Timeout después de 10 segundos
      setTimeout(() => {
        clearInterval(checkInterval)
        if (window.google?.maps) {
          resolve()
        } else {
          reject(new Error('Google Maps no se inicializó correctamente después de 10 segundos'))
        }
      }, 10000)
    }
    
    script.onerror = () => {
      googleMapsLoadingPromise = null
      reject(new Error('Error cargando Google Maps API. Verifica tu API key y que las APIs estén habilitadas.'))
    }
    
    document.head.appendChild(script)
  })

  return googleMapsLoadingPromise
}

