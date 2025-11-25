# Website - Transportes Edimburgo

Aplicación web para Transportes Edimburgo con calculadora de cotización integrada con Google Maps.

## 🚀 Características

- ✅ Calculadora de cotización interactiva con Google Maps
- ✅ Cálculo automático de rutas y distancias
- ✅ Autocompletado de direcciones (incluye aeropuertos y establecimientos)
- ✅ Selección de ubicaciones en mapa
- ✅ Validación de regiones (Chile por defecto, extensible)
- ✅ Sistema de logging completo para depuración
- ✅ Cálculo de precios por kilómetro según tipo de servicio
- ✅ Diseño responsive y moderno

## 📦 Instalación

```bash
# Desde la raíz del monorepo
yarn install

# O solo para el website
cd website
yarn install
```

## ⚙️ Configuración

Crea un archivo `.env` en `website/`:

```env
VITE_GOOGLE_MAPS_API_KEY=tu_api_key_aqui
```

### APIs de Google Requeridas

1. **Maps JavaScript API** - Para mostrar mapas
2. **Directions API** - Para calcular rutas
3. **Places API** - Para autocompletado y búsqueda
4. **Geocoding API** - Para convertir direcciones a coordenadas

## 🛠️ Desarrollo

```bash
# Iniciar servidor de desarrollo
yarn dev:website

# Construir para producción
yarn build:website

# Preview de producción
yarn preview
```

## 🏗️ Arquitectura

### Integración con Microservicios

El website usa el microservicio `@operations/google-maps-service` a través de wrappers en `src/lib/`:

- **`googleMaps.ts`**: Wrapper principal que usa el microservicio y agrega funcionalidades específicas del website
- **`mapsLogger.ts`**: Sistema de logging extendido
- **`notifications.ts`**: Sistema de notificaciones sutiles (sin alerts molestos)
- **`regionValidation.ts`**: Validación de regiones permitidas

### Componentes Principales

- **`IntegratedQuoteMap`**: Componente principal que integra el formulario con el mapa
- **`GooglePlacesAutocomplete`**: Componente de autocompletado de direcciones
- **`AdminRegionPanel`**: Panel de administración de regiones permitidas

## 🔧 Funcionalidades

### Calculadora de Cotización

- Selección de origen y destino (texto, mapa, o GPS)
- Cálculo automático de distancia y tiempo
- Cálculo de precio según:
  - Tipo de servicio (Aeropuerto, Hotel, Turístico, Evento, Tour)
  - Distancia en kilómetros
  - Número de pasajeros
  - Precio mínimo garantizado

### Validación de Regiones

- Validación automática de que las rutas estén en regiones permitidas
- Panel de administración para habilitar/deshabilitar regiones
- Configuración por defecto: Solo Chile habilitado

### Sistema de Logging

El website incluye logging completo para depuración:

```javascript
// En la consola del navegador (desarrollo)
window.mapsLogger.getLogs()        // Ver todos los logs
window.mapsLogger.getErrors()      // Ver solo errores
window.mapsLogger.exportLogs()     // Exportar como JSON
window.mapsLogger.downloadLogs()   // Descargar archivo
```

## 📝 Uso del Microservicio

El website usa el microservicio de Google Maps de la siguiente manera:

```typescript
// En src/lib/googleMaps.ts
import { calculateRoute as calculateRouteService } from '@operations/google-maps-service'

// Wrapper que agrega funcionalidades específicas del website
export const calculateRoute = async (origin, destination) => {
  // Lógica específica del website
  // + uso del microservicio
  return calculateRouteService(origin, destination)
}
```

## 🐛 Depuración

### Logger de Maps

```javascript
// Ver logs en consola
window.mapsLogger.getLogs()

// Filtrar por tipo
window.mapsLogger.getLogsByType('error')

// Exportar logs
window.mapsLogger.exportLogs()
```

### Notificaciones

El sistema de notificaciones registra todos los eventos sin mostrar alerts molestos. Los errores se registran en el logger.

## 📄 Licencia

MIT
