import { useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { MapPin } from 'lucide-react'
import { mapsLogger } from '@/lib/mapsLogger'

interface GooglePlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void
  placeholder?: string
  label?: string
}

declare global {
  interface Window {
    google: typeof google
    initGoogleMaps: () => void
  }
}

export const GooglePlacesAutocomplete = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Ingresa una dirección',
  label
}: GooglePlacesAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const isSelectingFromAutocomplete = useRef(false)

  useEffect(() => {
    if (!window.google?.maps?.places || !inputRef.current) return

    // Verificar que Places API esté disponible
    if (!window.google.maps.places.Autocomplete) {
      console.error('Places Autocomplete no está disponible. Asegúrate de que Places API esté habilitada.')
      return
    }

    // Limpiar autocomplete anterior si existe
    if (autocompleteRef.current) {
      window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
    }

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      // Removida restricción de país para permitir direcciones internacionales
      // La validación de región se hace en el cálculo de ruta
      fields: ['formatted_address', 'geometry', 'name', 'place_id', 'types'],
      // Incluir 'establishment' para aeropuertos, hoteles, etc. además de direcciones
      types: ['geocode', 'establishment'] // Permite direcciones, lugares y establecimientos (aeropuertos, hoteles, etc.)
    })

    // Usar addListener según la documentación oficial
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        // Loggear selección de lugar
        mapsLogger.logPlace('place_selected', place)
        
        // Marcar que estamos seleccionando desde el autocompletado
        isSelectingFromAutocomplete.current = true
        
        // Establecer el valor directamente en el input para evitar conflictos
        if (inputRef.current) {
          inputRef.current.value = place.formatted_address
        }
        
        // Primero llamar a onPlaceSelect (que actualiza el estado en el padre)
        // Luego llamar a onChange solo para sincronizar el input
        // Esto evita que onChange sobrescriba el estado antes de que onPlaceSelect lo actualice
        onPlaceSelect(place)
        
        // Llamar a onChange después de un pequeño delay para asegurar que el estado se actualizó
        const address = place.formatted_address
        if (address) {
          setTimeout(() => {
            onChange(address)
            isSelectingFromAutocomplete.current = false
          }, 50)
        } else {
          isSelectingFromAutocomplete.current = false
        }
      } else {
        // Loggear error si no hay dirección
        mapsLogger.logPlace('place_selected_error', null, {
          status: 'NO_FORMATTED_ADDRESS',
          message: 'El lugar seleccionado no tiene dirección formateada'
        })
      }
    })

    autocompleteRef.current = autocomplete

    return () => {
      if (listener) {
        window.google.maps.event.removeListener(listener)
      }
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, []) // Remover dependencias para evitar recrear el autocomplete

  // Sincronizar el valor del input con el prop value
  useEffect(() => {
    if (inputRef.current && !isSelectingFromAutocomplete.current) {
      // Solo actualizar si no estamos en medio de una selección del autocompletado
      if (inputRef.current.value !== value) {
        inputRef.current.value = value
      }
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo actualizar si no estamos seleccionando desde el autocompletado
    if (!isSelectingFromAutocomplete.current) {
      onChange(e.target.value)
    }
  }

  return (
    <div>
      {label && (
        <label className="text-sm font-medium mb-2 block">{label}</label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          defaultValue={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>
    </div>
  )
}

