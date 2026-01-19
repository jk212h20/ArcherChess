// Network manager for Socket.io communication

class NetworkManager {
  constructor() {
    this.socket = null;
    this.gameId = null;
    this.playerColor = null;
    this.callbacks = {};
  }
  
  connect() {
    this.socket = io();
    
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.emit('connected');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.emit('disconnected');
    });
    
    this.socket.on('joined', (data) => {
      console.log('Joined game:', data);
      this.gameId = data.gameId;
      this.playerColor = data.color;
      this.emit('joined', data);
    });
    
    this.socket.on('gameStart', (data) => {
      console.log('Game started:', data);
      this.emit('gameStart', data);
    });
    
    this.socket.on('gameState', (data) => {
      this.emit('gameState', data);
    });
    
    this.socket.on('premoveSet', (data) => {
      console.log('Premove set:', data);
      this.emit('premoveSet', data);
    });
    
    this.socket.on('premoveCancelled', () => {
      console.log('Premove cancelled');
      this.emit('premoveCancelled');
    });
    
    this.socket.on('gameOver', (data) => {
      console.log('Game over:', data);
      this.emit('gameOver', data);
    });
    
    this.socket.on('error', (message) => {
      console.error('Server error:', message);
      this.emit('error', message);
    });
  }
  
  joinGame(gameId) {
    if (!gameId) {
      // Generate random game ID
      gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    this.socket.emit('joinGame', gameId);
    return gameId;
  }
  
  sendPremove(data) {
    this.socket.emit('premove', data);
  }
  
  cancelPremove() {
    this.socket.emit('cancelPremove');
  }
  
  // Event handling
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }
  
  off(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }
  
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }
}

// Global network instance
const network = new NetworkManager();
