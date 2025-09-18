import { useState, useEffect } from 'react'

export const useNotifications = () => {
  const [permission, setPermission] = useState(Notification.permission)
  const [isSupported, setIsSupported] = useState('Notification' in window)

  useEffect(() => {
    if (!isSupported) return

    // Update permission state when it changes
    const updatePermission = () => {
      setPermission(Notification.permission)
    }

    // Listen for permission changes (though this is not widely supported)
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then((result) => {
        result.addEventListener('change', updatePermission)
        return () => result.removeEventListener('change', updatePermission)
      })
    }
  }, [isSupported])

  const requestPermission = async () => {
    if (!isSupported) {
      console.warn('Notifications are not supported in this browser')
      return false
    }

    if (permission === 'granted') {
      return true
    }

    if (permission === 'denied') {
      console.warn('Notification permission has been denied')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  const showNotification = (title, options = {}) => {
    if (!isSupported || permission !== 'granted') {
      return null
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'chat-message', // This will replace previous notifications
        renotify: true,
        requireInteraction: false,
        ...options
      })

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close()
      }, 5000)

      return notification
    } catch (error) {
      console.error('Error showing notification:', error)
      return null
    }
  }

  const showMessageNotification = (message, sender) => {
    const title = `New message from ${sender}`
    const options = {
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      icon: '/favicon.ico',
      tag: `message-${sender}`,
      data: { sender, message }
    }

    return showNotification(title, options)
  }

  const showUserJoinedNotification = (username) => {
    const title = 'User Joined'
    const options = {
      body: `${username} joined the chat`,
      icon: '/favicon.ico',
      tag: 'user-joined'
    }

    return showNotification(title, options)
  }

  const showUserLeftNotification = (username) => {
    const title = 'User Left'
    const options = {
      body: `${username} left the chat`,
      icon: '/favicon.ico',
      tag: 'user-left'
    }

    return showNotification(title, options)
  }

  const showFileSharedNotification = (filename, sender) => {
    const title = `File shared by ${sender}`
    const options = {
      body: `${filename}`,
      icon: '/favicon.ico',
      tag: `file-${sender}`
    }

    return showNotification(title, options)
  }

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    showMessageNotification,
    showUserJoinedNotification,
    showUserLeftNotification,
    showFileSharedNotification
  }
}

