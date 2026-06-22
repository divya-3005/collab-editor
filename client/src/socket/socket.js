import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const SOCKET_URL = API_URL.replace('/api', '')

const socket = io(SOCKET_URL, {
  autoConnect: false
})

export default socket