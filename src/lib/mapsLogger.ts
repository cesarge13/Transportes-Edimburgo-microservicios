// Sistema de logging para Google Maps
// Registra direcciones, coordenadas y errores para depuración

export interface MapsLogEntry {
  timestamp: string
  type: 'route' | 'geocode' | 'place' | 'error' | 'info'
  action: string
  data: {
    origin?: {
      address?: string
      coordinates?: { lat: number; lng: number }
      placeId?: string
    }
    destination?: {
      address?: string
      coordinates?: { lat: number; lng: number }
      placeId?: string
    }
    error?: {
      code?: string
      message: string
      status?: string
    }
    routeInfo?: {
      distance?: number
      duration?: number
      distanceText?: string
      durationText?: string
    }
    [key: string]: any
  }
}

class MapsLogger {
  private logs: MapsLogEntry[] = []
  private maxLogs = 100 // Mantener solo los últimos 100 logs
  private enabled = true

  constructor() {
    // En desarrollo, siempre habilitado
    // En producción, puede ser controlado por variable de entorno
    this.enabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MAPS_LOGGER === 'true'
  }

  private addLog(entry: MapsLogEntry) {
    if (!this.enabled) return

    this.logs.push(entry)
    
    // Mantener solo los últimos maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // También loggear en consola en desarrollo, pero filtrar errores de validación mientras se escribe
    if (import.meta.env.DEV) {
      // Suprimir errores de validación para direcciones incompletas
      const isValidationError = entry.type === 'error' && 
                                entry.action === 'route_validation_failed' &&
                                (entry.data.origin?.address?.trim().length < 5 || 
                                 entry.data.destination?.address?.trim().length < 5)
      
      // Suprimir errores de geocoding para direcciones muy cortas
      const isGeocodeErrorForShortAddress = entry.type === 'error' && 
                                            entry.action.includes('geocode') &&
                                            entry.data.address?.trim().length < 5

      if (!isValidationError && !isGeocodeErrorForShortAddress) {
        const logMethod = entry.type === 'error' ? console.error : console.log
        logMethod(`[MapsLogger] ${entry.type.toUpperCase()}: ${entry.action}`, entry.data)
      }
    }
  }

  logRoute(
    action: string,
    origin: string | google.maps.LatLng | google.maps.places.PlaceResult | null,
    destination: string | google.maps.LatLng | google.maps.places.PlaceResult | null,
    routeInfo?: { distance: number; duration: number; distanceText: string; durationText: string } | null
  ) {
    const extractLocationData = (
      location: string | google.maps.LatLng | google.maps.places.PlaceResult | null
    ) => {
      if (!location) return undefined

      if (typeof location === 'string') {
        return { address: location }
      }

      if (location instanceof google.maps.LatLng) {
        return {
          coordinates: {
            lat: location.lat(),
            lng: location.lng()
          }
        }
      }

      // Es un PlaceResult
      const place = location as google.maps.places.PlaceResult
      const data: any = {
        address: place.formatted_address,
        placeId: place.place_id
      }

      if (place.geometry?.location) {
        const loc = place.geometry.location
        if (typeof loc.lat === 'function') {
          data.coordinates = { lat: loc.lat(), lng: loc.lng() }
        } else {
          data.coordinates = { lat: loc.lat, lng: loc.lng }
        }
      }

      return data
    }

    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'route',
      action,
      data: {
        origin: extractLocationData(origin),
        destination: extractLocationData(destination),
        routeInfo: routeInfo || undefined
      }
    })
  }

  logGeocode(
    action: string,
    address: string,
    result?: google.maps.GeocoderResult | null,
    error?: { status: string; message: string }
  ) {
    const data: any = { address }

    if (result) {
      data.result = {
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        coordinates: result.geometry?.location
          ? (() => {
              const loc = result.geometry!.location!
              if (typeof loc.lat === 'function') {
                return { lat: loc.lat(), lng: loc.lng() }
              }
              return { lat: loc.lat, lng: loc.lng }
            })()
          : undefined,
        addressComponents: result.address_components?.map(c => ({
          types: c.types,
          longName: c.long_name,
          shortName: c.short_name
        }))
      }
    }

    if (error) {
      data.error = error
    }

    this.addLog({
      timestamp: new Date().toISOString(),
      type: error ? 'error' : 'geocode',
      action,
      data
    })
  }

  logPlace(
    action: string,
    place: google.maps.places.PlaceResult | null,
    error?: { status: string; message: string }
  ) {
    const data: any = {}

    if (place) {
      data.place = {
        placeId: place.place_id,
        formattedAddress: place.formatted_address,
        name: place.name,
        coordinates: place.geometry?.location
          ? (() => {
              const loc = place.geometry!.location!
              if (typeof loc.lat === 'function') {
                return { lat: loc.lat(), lng: loc.lng() }
              }
              return { lat: loc.lat, lng: loc.lng }
            })()
          : undefined,
        types: place.types
      }
    }

    if (error) {
      data.error = error
    }

    this.addLog({
      timestamp: new Date().toISOString(),
      type: error ? 'error' : 'place',
      action,
      data
    })
  }

  logError(
    action: string,
    error: {
      code?: string
      status?: string
      message: string
      origin?: string | google.maps.LatLng | google.maps.places.PlaceResult
      destination?: string | google.maps.LatLng | google.maps.places.PlaceResult
    }
  ) {
    const extractLocationData = (
      location: string | google.maps.LatLng | google.maps.places.PlaceResult | undefined
    ) => {
      if (!location) return undefined

      if (typeof location === 'string') {
        return { address: location }
      }

      if (location instanceof google.maps.LatLng) {
        return {
          coordinates: {
            lat: location.lat(),
            lng: location.lng()
          }
        }
      }

      const place = location as google.maps.places.PlaceResult
      return {
        address: place.formatted_address,
        placeId: place.place_id,
        coordinates: place.geometry?.location
          ? (() => {
              const loc = place.geometry!.location!
              if (typeof loc.lat === 'function') {
                return { lat: loc.lat(), lng: loc.lng() }
              }
              return { lat: loc.lat, lng: loc.lng }
            })()
          : undefined
      }
    }

    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'error',
      action,
      data: {
        error: {
          code: error.code,
          status: error.status,
          message: error.message
        },
        origin: extractLocationData(error.origin),
        destination: extractLocationData(error.destination)
      }
    })
  }

  logInfo(action: string, data: Record<string, any>) {
    this.addLog({
      timestamp: new Date().toISOString(),
      type: 'info',
      action,
      data
    })
  }

  getLogs(): MapsLogEntry[] {
    return [...this.logs]
  }

  getLogsByType(type: MapsLogEntry['type']): MapsLogEntry[] {
    return this.logs.filter(log => log.type === type)
  }

  getErrors(): MapsLogEntry[] {
    return this.getLogsByType('error')
  }

  clearLogs() {
    this.logs = []
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  downloadLogs() {
    const logsJson = this.exportLogs()
    const blob = new Blob([logsJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `maps-logs-${new Date().toISOString()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

// Instancia singleton
export const mapsLogger = new MapsLogger()

// Exponer en window para acceso desde consola en desarrollo
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).mapsLogger = mapsLogger
}

