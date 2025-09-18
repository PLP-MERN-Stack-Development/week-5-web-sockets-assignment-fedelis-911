import { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { ScrollArea } from '@/components/ui/scroll-area.jsx'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import FileUpload from './components/FileUpload.jsx'
import { useNotifications } from './hooks/useNotifications.js'
import { 
  Send, 
  Users, 
  MessageCircle, 
  Settings, 
  Smile,
  Phone,
  Video,
  MoreVertical,
  Search,
  Paperclip,
  Mic
} from 'lucide-react'
import { format } from 'date-fns'
import './App.css'

const SOCKET_URL = 'https://5000-icunrtsc1a3j808ljp9f7-4b4915e2.manusvm.computer'

function App() {
  const [socket, setSocket] = useState(null)
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [currentRoom, setCurrentRoom] = useState('general')
  const [rooms, setRooms] = useState([{ id: 'general', name: 'General', userCount: 0 }])
  const [isTyping, setIsTyping] = useState(false)
  const [privateChats, setPrivateChats] = useState(new Map())
  const [selectedChat, setSelectedChat] = useState({ type: 'room', id: 'general' })
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState(new Map())
  const [isWindowFocused, setIsWindowFocused] = useState(true)
  
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Notifications hook
  const {
    requestPermission,
    showMessageNotification,
    showUserJoinedNotification,
    showUserLeftNotification,
    showFileSharedNotification
  } = useNotifications()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Window focus/blur detection for notifications
  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true)
      // Clear unread count for current chat when window is focused
      if (selectedChat) {
        const chatKey = selectedChat.type === 'room' ? selectedChat.id : selectedChat.id
        setUnreadCounts(prev => {
          const updated = new Map(prev)
          updated.delete(chatKey)
          return updated
        })
      }
    }

    const handleBlur = () => {
      setIsWindowFocused(false)
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    // Request notification permission on component mount
    requestPermission()

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [selectedChat, requestPermission])

  const connectSocket = () => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('Connected to server')
      setIsConnected(true)
      
      // Join with username
      const userData = {
        username: username,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`
      }
      
      newSocket.emit('join', userData)
      setUser(userData)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server')
      setIsConnected(false)
    })

    newSocket.on('onlineUsers', (users) => {
      setOnlineUsers(users)
    })

    newSocket.on('messageHistory', (history) => {
      setMessages(history)
    })

    newSocket.on('newMessage', (message) => {
      setMessages(prev => [...prev, message])
      
      // Handle notifications and unread counts for messages from others
      if (message.sender.username !== username) {
        playNotificationSound()
        
        // Show browser notification if window is not focused
        if (!isWindowFocused) {
          if (message.type === 'file') {
            showFileSharedNotification(message.file.originalName, message.sender.username)
          } else {
            showMessageNotification(message.text, message.sender.username)
          }
        }
        
        // Update unread count if not viewing the current room
        const messageRoom = message.room || 'general'
        if (selectedChat.type !== 'room' || selectedChat.id !== messageRoom) {
          setUnreadCounts(prev => {
            const updated = new Map(prev)
            const current = updated.get(messageRoom) || 0
            updated.set(messageRoom, current + 1)
            return updated
          })
        }
      }
    })

    newSocket.on('newPrivateMessage', (message) => {
      const chatKey = message.sender.username === username 
        ? message.recipient.username 
        : message.sender.username
      
      setPrivateChats(prev => {
        const updated = new Map(prev)
        const existing = updated.get(chatKey) || []
        updated.set(chatKey, [...existing, message])
        return updated
      })
      
      if (message.sender.username !== username) {
        playNotificationSound()
        
        // Show browser notification if window is not focused
        if (!isWindowFocused) {
          if (message.file) {
            showFileSharedNotification(message.file.originalName, message.sender.username)
          } else {
            showMessageNotification(message.text, message.sender.username)
          }
        }
        
        // Update unread count if not viewing this private chat
        if (selectedChat.type !== 'private' || selectedChat.id !== chatKey) {
          setUnreadCounts(prev => {
            const updated = new Map(prev)
            const current = updated.get(`private-${chatKey}`) || 0
            updated.set(`private-${chatKey}`, current + 1)
            return updated
          })
        }
      }
    })

    newSocket.on('userJoined', (newUser) => {
      setOnlineUsers(prev => [...prev, newUser])
      // Show join notification
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        text: `${newUser.username} joined the chat`,
        timestamp: new Date()
      }])
      
      // Show browser notification
      if (!isWindowFocused) {
        showUserJoinedNotification(newUser.username)
      }
    })

    newSocket.on('userLeft', (leftUser) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== leftUser.id))
      // Show leave notification
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        text: `${leftUser.username} left the chat`,
        timestamp: new Date()
      }])
      
      // Show browser notification
      if (!isWindowFocused) {
        showUserLeftNotification(leftUser.username)
      }
    })

    newSocket.on('userTyping', (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => {
          if (!prev.find(u => u.id === data.user.id)) {
            return [...prev, data.user]
          }
          return prev
        })
      } else {
        setTypingUsers(prev => prev.filter(u => u.id !== data.user.id))
      }
    })

    newSocket.on('messageReaction', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, reactions: data.reactions }
          : msg
      ))
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }

  const playNotificationSound = () => {
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)
  }

  const handleJoin = (e) => {
    e.preventDefault()
    if (username.trim()) {
      connectSocket()
    }
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (newMessage.trim() && socket) {
      if (selectedChat.type === 'room') {
        socket.emit('sendMessage', {
          text: newMessage,
          room: selectedChat.id
        })
      } else {
        const recipient = onlineUsers.find(u => u.username === selectedChat.id)
        if (recipient) {
          socket.emit('sendPrivateMessage', {
            text: newMessage,
            recipient: recipient
          })
        }
      }
      setNewMessage('')
      setIsTyping(false)
    }
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    
    if (!isTyping && socket) {
      setIsTyping(true)
      socket.emit('typing', { isTyping: true, room: currentRoom })
    }

    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      if (socket) {
        socket.emit('typing', { isTyping: false, room: currentRoom })
      }
    }, 1000)
  }

  const addReaction = (messageId, emoji) => {
    if (socket) {
      socket.emit('addReaction', { messageId, emoji })
    }
  }

  const startPrivateChat = (targetUser) => {
    setSelectedChat({ type: 'private', id: targetUser.username })
    if (!privateChats.has(targetUser.username)) {
      setPrivateChats(prev => new Map(prev.set(targetUser.username, [])))
    }
    
    // Clear unread count for this private chat
    setUnreadCounts(prev => {
      const updated = new Map(prev)
      updated.delete(`private-${targetUser.username}`)
      return updated
    })
  }

  const selectRoom = (roomId) => {
    setSelectedChat({ type: 'room', id: roomId })
    
    // Clear unread count for this room
    setUnreadCounts(prev => {
      const updated = new Map(prev)
      updated.delete(roomId)
      return updated
    })
  }

  const handleFileUpload = (fileInfo) => {
    if (socket) {
      if (selectedChat.type === 'room') {
        socket.emit('sendFileMessage', {
          text: `Shared a file: ${fileInfo.originalName}`,
          room: selectedChat.id,
          file: fileInfo
        })
      } else {
        const recipient = onlineUsers.find(u => u.username === selectedChat.id)
        if (recipient) {
          socket.emit('sendPrivateMessage', {
            text: `Shared a file: ${fileInfo.originalName}`,
            recipient: recipient,
            file: fileInfo
          })
        }
      }
    }
    setShowFileUpload(false)
  }

  const getCurrentMessages = () => {
    if (selectedChat.type === 'room') {
      return messages.filter(msg => !msg.room || msg.room === selectedChat.id)
    } else {
      return privateChats.get(selectedChat.id) || []
    }
  }

  const formatTime = (timestamp) => {
    return format(new Date(timestamp), 'HH:mm')
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-800">
              Join Chat Room
            </CardTitle>
            <p className="text-gray-600">Enter your username to start chatting</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <Input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
                required
              />
              <Button type="submit" className="w-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                Join Chat
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">Chat App</h1>
            <div className="flex items-center space-x-2">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "Online" : "Offline"}
              </Badge>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="mt-2 flex items-center space-x-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-gray-700">{user?.username}</span>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search conversations..." className="pl-10" />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Rooms */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                Rooms
              </h3>
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => selectRoom(room.id)}
                  className={`w-full p-3 rounded-lg text-left hover:bg-gray-50 transition-colors ${
                    selectedChat.type === 'room' && selectedChat.id === room.id
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{room.name}</p>
                        <p className="text-xs text-gray-500">{room.userCount} members</p>
                      </div>
                    </div>
                    {unreadCounts.get(room.id) > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {unreadCounts.get(room.id)}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <Separator />

            {/* Online Users */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                Online Users ({onlineUsers.length})
              </h3>
              {onlineUsers.filter(u => u.username !== user?.username).map((onlineUser) => (
                <button
                  key={onlineUser.id}
                  onClick={() => startPrivateChat(onlineUser)}
                  className={`w-full p-3 rounded-lg text-left hover:bg-gray-50 transition-colors ${
                    selectedChat.type === 'private' && selectedChat.id === onlineUser.username
                      ? 'bg-green-50 border-l-4 border-green-500'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={onlineUser.avatar} />
                          <AvatarFallback>{onlineUser.username[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{onlineUser.username}</p>
                        <p className="text-xs text-green-600">Online</p>
                      </div>
                    </div>
                    {unreadCounts.get(`private-${onlineUser.username}`) > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {unreadCounts.get(`private-${onlineUser.username}`)}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                {selectedChat.type === 'room' ? (
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                ) : (
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={onlineUsers.find(u => u.username === selectedChat.id)?.avatar} />
                    <AvatarFallback>{selectedChat.id[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">
                  {selectedChat.type === 'room' 
                    ? rooms.find(r => r.id === selectedChat.id)?.name || selectedChat.id
                    : selectedChat.id
                  }
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedChat.type === 'room' 
                    ? `${onlineUsers.length} members online`
                    : 'Private conversation'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Video className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {getCurrentMessages().map((message) => (
              <div key={message.id} className={`flex ${
                message.type === 'system' 
                  ? 'justify-center' 
                  : message.sender?.username === user?.username 
                    ? 'justify-end' 
                    : 'justify-start'
              }`}>
                {message.type === 'system' ? (
                  <div className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
                    {message.text}
                  </div>
                ) : (
                  <div className={`max-w-xs lg:max-w-md ${
                    message.sender?.username === user?.username ? 'order-1' : 'order-2'
                  }`}>
                    <div className={`flex items-end space-x-2 ${
                      message.sender?.username === user?.username ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={message.sender?.avatar} />
                        <AvatarFallback>{message.sender?.username?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className={`px-4 py-2 rounded-lg ${
                        message.sender?.username === user?.username
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-200'
                      }`}>
                        {message.type === 'file' && message.file ? (
                          <div className="space-y-2">
                            <p className="text-sm">{message.text}</p>
                            <div className="flex items-center space-x-2 p-2 bg-black bg-opacity-10 rounded">
                              <Paperclip className="w-4 h-4" />
                              <a 
                                href={`https://5000-icunrtsc1a3j808ljp9f7-4b4915e2.manusvm.computer${message.file.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm underline hover:no-underline"
                              >
                                {message.file.originalName}
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm">{message.text}</p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-xs ${
                            message.sender?.username === user?.username ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.timestamp)}
                          </p>
                          {message.reactions && Object.keys(message.reactions).length > 0 && (
                            <div className="flex space-x-1 ml-2">
                              {Object.entries(message.reactions).map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(message.id, emoji)}
                                  className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-1 flex items-center space-x-1"
                                >
                                  <span>{emoji}</span>
                                  <span>{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-1 mt-1">
                      <button
                        onClick={() => addReaction(message.id, '👍')}
                        className="text-xs hover:bg-gray-100 rounded p-1"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => addReaction(message.id, '❤️')}
                        className="text-xs hover:bg-gray-100 rounded p-1"
                      >
                        ❤️
                      </button>
                      <button
                        onClick={() => addReaction(message.id, '😂')}
                        className="text-xs hover:bg-gray-100 rounded p-1"
                      >
                        😂
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-600 text-sm px-3 py-2 rounded-lg">
                  {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => setShowFileUpload(true)}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleTyping}
                className="pr-10"
              />
              <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <Smile className="w-4 h-4" />
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm">
              <Mic className="w-4 h-4" />
            </Button>
            <Button type="submit" disabled={!newMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <FileUpload
            onFileUpload={handleFileUpload}
            onClose={() => setShowFileUpload(false)}
          />
        </div>
      )}
    </div>
  )
}

export default App

