// Sistema de validación de regiones y permisos de administrador

export interface RegionConfig {
  code: string // Código de país (ISO 3166-1 alpha-2)
  name: string
  enabled: boolean
  adminOnly: boolean // Si requiere permisos de admin para habilitar
}

// Configuración de regiones permitidas
export const REGION_CONFIG: Record<string, RegionConfig> = {
  CL: {
    code: 'CL',
    name: 'Chile',
    enabled: true,
    adminOnly: false // Chile está habilitado por defecto
  },
  AR: {
    code: 'AR',
    name: 'Argentina',
    enabled: false,
    adminOnly: true
  },
  PE: {
    code: 'PE',
    name: 'Perú',
    enabled: false,
    adminOnly: true
  },
  BO: {
    code: 'BO',
    name: 'Bolivia',
    enabled: false,
    adminOnly: true
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    enabled: false,
    adminOnly: true
  }
}

// Sistema de permisos de administrador
// En producción, esto debería venir de un backend/autenticación
export interface AdminConfig {
  isAdmin: boolean
  enabledRegions: string[] // Códigos de regiones habilitadas por el admin
}

// Obtener configuración de admin desde localStorage o variables de entorno
export const getAdminConfig = (): AdminConfig => {
  // En desarrollo, puedes habilitar admin desde localStorage
  // En producción, esto debería venir de tu sistema de autenticación
  const adminFromStorage = localStorage.getItem('transportes_edimburgo_admin')
  
  if (adminFromStorage) {
    try {
      const parsed = JSON.parse(adminFromStorage)
      return {
        isAdmin: parsed.isAdmin || false,
        enabledRegions: parsed.enabledRegions || []
      }
    } catch {
      return { isAdmin: false, enabledRegions: [] }
    }
  }
  
  // Verificar variable de entorno para admin (solo en desarrollo)
  const adminFromEnv = import.meta.env.VITE_ADMIN_ENABLED === 'true'
  
  return {
    isAdmin: adminFromEnv,
    enabledRegions: []
  }
}

// Obtener regiones habilitadas según permisos
export const getEnabledRegions = (): string[] => {
  const adminConfig = getAdminConfig()
  const enabled: string[] = []
  
  // Agregar regiones habilitadas por defecto
  Object.values(REGION_CONFIG).forEach(region => {
    if (region.enabled && !region.adminOnly) {
      enabled.push(region.code)
    }
  })
  
  // Si es admin, agregar regiones habilitadas por admin
  if (adminConfig.isAdmin) {
    // Agregar regiones habilitadas manualmente por admin
    adminConfig.enabledRegions.forEach(code => {
      if (!enabled.includes(code)) {
        enabled.push(code)
      }
    })
    
    // Agregar todas las regiones adminOnly si el admin las habilita
    Object.values(REGION_CONFIG).forEach(region => {
      if (region.adminOnly && adminConfig.enabledRegions.includes(region.code)) {
        if (!enabled.includes(region.code)) {
          enabled.push(region.code)
        }
      }
    })
  }
  
  return enabled
}

// Validar que una dirección esté en una región permitida
export const validateAddressRegion = async (
  address: string
): Promise<{ valid: boolean; countryCode: string | null; error?: string }> => {
  if (!window.google?.maps) {
    return { valid: false, countryCode: null, error: 'Google Maps no está cargado' }
  }
  
  const geocoder = new window.google.maps.Geocoder()
  const enabledRegions = getEnabledRegions()
  
  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
        // Buscar el código de país en los componentes de la dirección
        const addressComponents = results[0].address_components
        let countryCode: string | null = null
        
        for (const component of addressComponents) {
          if (component.types.includes('country')) {
            countryCode = component.short_name
            break
          }
        }
        
        if (!countryCode) {
          resolve({
            valid: false,
            countryCode: null,
            error: 'No se pudo determinar el país de la dirección'
          })
          return
        }
        
        // Verificar si el país está en las regiones habilitadas
        if (enabledRegions.includes(countryCode)) {
          resolve({ valid: true, countryCode })
        } else {
          const countryName = addressComponents.find(c => 
            c.types.includes('country')
          )?.long_name || countryCode
          
          resolve({
            valid: false,
            countryCode,
            error: `Las rutas fuera de ${enabledRegions.map(c => REGION_CONFIG[c]?.name || c).join(', ')} no están permitidas. Contacta a un administrador para habilitar ${countryName}.`
          })
        }
      } else {
        resolve({
          valid: false,
          countryCode: null,
          error: 'No se pudo validar la dirección'
        })
      }
    })
  })
}

// Validar que una ruta completa esté dentro de las regiones permitidas
export const validateRouteRegions = async (
  origin: string,
  destination: string
): Promise<{ valid: boolean; errors: string[] }> => {
  const errors: string[] = []
  
  // Validar origen
  const originValidation = await validateAddressRegion(origin)
  if (!originValidation.valid) {
    errors.push(`Origen: ${originValidation.error || 'Dirección no válida'}`)
  }
  
  // Validar destino
  const destinationValidation = await validateAddressRegion(destination)
  if (!destinationValidation.valid) {
    errors.push(`Destino: ${destinationValidation.error || 'Dirección no válida'}`)
  }
  
  // Validar que origen y destino estén en el mismo país o países permitidos
  if (originValidation.countryCode && destinationValidation.countryCode) {
    const enabledRegions = getEnabledRegions()
    
    if (!enabledRegions.includes(originValidation.countryCode)) {
      errors.push(`El origen debe estar en ${enabledRegions.map(c => REGION_CONFIG[c]?.name || c).join(', ')}`)
    }
    
    if (!enabledRegions.includes(destinationValidation.countryCode)) {
      errors.push(`El destino debe estar en ${enabledRegions.map(c => REGION_CONFIG[c]?.name || c).join(', ')}`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Función para administradores: habilitar/deshabilitar regiones
export const toggleRegionForAdmin = (regionCode: string, enabled: boolean): void => {
  const adminConfig = getAdminConfig()
  
  if (!adminConfig.isAdmin) {
    throw new Error('No tienes permisos de administrador')
  }
  
  const region = REGION_CONFIG[regionCode]
  if (!region) {
    throw new Error(`Región ${regionCode} no encontrada`)
  }
  
  // Actualizar configuración de admin
  const updatedEnabledRegions = enabled
    ? [...new Set([...adminConfig.enabledRegions, regionCode])]
    : adminConfig.enabledRegions.filter(code => code !== regionCode)
  
  const updatedConfig: AdminConfig = {
    ...adminConfig,
    enabledRegions: updatedEnabledRegions
  }
  
  localStorage.setItem('transportes_edimburgo_admin', JSON.stringify(updatedConfig))
}

// Obtener información de regiones para UI de admin
export const getRegionInfo = (): Array<RegionConfig & { isEnabled: boolean }> => {
  const enabledRegions = getEnabledRegions()
  
  return Object.values(REGION_CONFIG).map(region => ({
    ...region,
    isEnabled: enabledRegions.includes(region.code)
  }))
}






