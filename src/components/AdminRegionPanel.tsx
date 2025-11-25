import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getRegionInfo, toggleRegionForAdmin, getAdminConfig } from '@/lib/regionValidation'
import { Shield, CheckCircle, XCircle } from 'lucide-react'

export const AdminRegionPanel = () => {
  const [regions, setRegions] = useState<ReturnType<typeof getRegionInfo>>([])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const adminConfig = getAdminConfig()
    setIsAdmin(adminConfig.isAdmin)
    
    if (adminConfig.isAdmin) {
      setRegions(getRegionInfo())
    }
  }, [])

  const handleToggleRegion = (regionCode: string, currentEnabled: boolean) => {
    try {
      toggleRegionForAdmin(regionCode, !currentEnabled)
      setRegions(getRegionInfo())
    } catch (error) {
      console.error('Error al cambiar región:', error)
      // No usar alert, solo loggear
    }
  }

  if (!isAdmin) {
    return null // No mostrar panel si no es admin
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-yellow-600" />
          <CardTitle className="text-lg">Panel de Administración - Regiones</CardTitle>
        </div>
        <CardDescription>
          Gestiona las regiones permitidas para las rutas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {regions.map((region) => (
            <div
              key={region.code}
              className="flex items-center justify-between p-3 bg-white rounded-lg border"
            >
              <div>
                <p className="font-medium">{region.name}</p>
                <p className="text-sm text-muted-foreground">
                  Código: {region.code}
                  {region.adminOnly && ' • Requiere permisos de admin'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {region.isEnabled ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Habilitada
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    Deshabilitada
                  </span>
                )}
                {region.adminOnly && (
                  <Button
                    variant={region.isEnabled ? 'destructive' : 'default'}
                    size="sm"
                    onClick={() => handleToggleRegion(region.code, region.isEnabled)}
                  >
                    {region.isEnabled ? 'Deshabilitar' : 'Habilitar'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p className="font-medium mb-1">Regiones habilitadas actualmente:</p>
          <p className="text-xs">
            {regions.filter(r => r.isEnabled).map(r => r.name).join(', ') || 'Ninguna'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}





