/**
 * Socket.io client singleton.
 *
 * We export a single pre-configured socket instance that is shared across the
 * entire app. This avoids accidentally creating multiple connections.
 *
 * `autoConnect: false` means the socket does NOT connect immediately on import.
 * Instead, each page calls `socket.connect()` when it mounts and
 * `socket.disconnect()` when it unmounts — giving us precise control over
 * the connection lifecycle and preventing stale connections after navigation.
 */

import { io } from 'socket.io-client';

// Strip '/api' suffix from the REST API URL to get the root WebSocket URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const SOCKET_URL = API_URL.replace('/api', '');

const socket = io(SOCKET_URL, {
  autoConnect: false // Connect explicitly in page components, not on module load
});

export default socket;