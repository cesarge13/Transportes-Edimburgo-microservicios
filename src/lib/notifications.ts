// Sistema de notificaciones sutiles (sin alerts molestos)
import { mapsLogger } from './mapsLogger'

export type NotificationType = 'error' | 'warning' | 'info' | 'success'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  timestamp: Date
}

class NotificationManager {
  private notifications: Notification[] = []
  private listeners: Array<(notifications: Notification[]) => void> = []

  private notify() {
    this.listeners.forEach(listener => listener([...this.notifications]))
  }

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  add(type: NotificationType, message: string) {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date()
    }

    this.notifications.push(notification)
    
    // Loggear todas las notificaciones
    mapsLogger.logInfo('notification', {
      type,
      message,
      timestamp: notification.timestamp.toISOString()
    })

    // Mostrar en consola solo en desarrollo y solo para errores críticos
    // Suprimir errores de validación mientras el usuario escribe
    if (import.meta.env.DEV && type === 'error') {
      // Solo mostrar errores que no sean de validación de direcciones incompletas
      const isValidationError = message.includes('No se pudo validar') || 
                                message.includes('No se pudo determinar')
      
      // No mostrar errores de validación para direcciones muy cortas o mientras se escribe
      if (!isValidationError) {
        console.error(`[ERROR] ${message}`)
      }
    }

    // Auto-remover después de 5 segundos (excepto errores críticos)
    if (type !== 'error') {
      setTimeout(() => {
        this.remove(notification.id)
      }, 5000)
    }

    this.notify()
  }

  remove(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id)
    this.notify()
  }

  clear() {
    this.notifications = []
    this.notify()
  }

  getNotifications(): Notification[] {
    return [...this.notifications]
  }
}

export const notifications = new NotificationManager()

// Funciones helper
export const notifyError = (message: string) => {
  notifications.add('error', message)
}

export const notifyWarning = (message: string) => {
  notifications.add('warning', message)
}

export const notifyInfo = (message: string) => {
  notifications.add('info', message)
}

export const notifySuccess = (message: string) => {
  notifications.add('success', message)
}

