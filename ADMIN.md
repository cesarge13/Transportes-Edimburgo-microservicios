# Panel de Administración - Regiones

## Habilitar Modo Administrador

Para habilitar el panel de administración y gestionar las regiones permitidas:

### Opción 1: Variable de Entorno (Recomendado para desarrollo)

Agrega al archivo `.env`:

```env
VITE_ADMIN_ENABLED=true
```

### Opción 2: LocalStorage (Para pruebas rápidas)

Abre la consola del navegador (F12) y ejecuta:

```javascript
localStorage.setItem('transportes_edimburgo_admin', JSON.stringify({
  isAdmin: true,
  enabledRegions: []
}))
```

Luego recarga la página.

## Gestión de Regiones

Una vez habilitado el modo admin, verás un panel en la parte superior de la página donde puedes:

1. **Ver todas las regiones disponibles**
   - Chile (CL) - Habilitada por defecto
   - Argentina (AR) - Requiere permisos de admin
   - Perú (PE) - Requiere permisos de admin
   - Bolivia (BO) - Requiere permisos de admin
   - Colombia (CO) - Requiere permisos de admin

2. **Habilitar/Deshabilitar regiones**
   - Haz clic en "Habilitar" o "Deshabilitar" para cada región
   - Los cambios se guardan en localStorage

## Restricciones

- **Chile (CL)**: Siempre habilitado, no puede ser deshabilitado
- **Otras regiones**: Requieren permisos de administrador para habilitar
- Las rutas que salgan de las regiones habilitadas serán rechazadas automáticamente

## Validación Automática

El sistema valida automáticamente:
- Al seleccionar una dirección en el autocompletado
- Al hacer clic en el mapa
- Al arrastrar marcadores
- Al calcular el precio
- Al calcular la ruta

## Integración con Backend (Futuro)

Para producción, se recomienda:
1. Mover la configuración de admin a un backend
2. Usar autenticación real (JWT, OAuth, etc.)
3. Guardar las regiones habilitadas en una base de datos
4. Implementar permisos granulares por usuario

## Agregar Nuevas Regiones

Para agregar nuevas regiones, edita `src/lib/regionValidation.ts`:

```typescript
export const REGION_CONFIG: Record<string, RegionConfig> = {
  // ... regiones existentes
  MX: {
    code: 'MX',
    name: 'México',
    enabled: false,
    adminOnly: true
  }
}
```






