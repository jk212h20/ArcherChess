// Main game logic and rendering

class Game {
  constructor() {
    // DOM elements
    this.screens = {
      menu: document.getElementById('menu-screen'),
      waiting: document.getElementById('waiting-screen'),
      game: document.getElementById('game-screen'),
      gameover: document.getElementById('gameover-screen')
    };
    
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Game state
    this.board = null;
    this.playerColor = null;
    this.energy = { white: 0, black: 0 };
    this.gameStarted = false;
    this.gameOver = false;
    
    // Interaction state
    this.selectedPiece = null;
    this.validMoves = [];
    this.shootMode = false;
    this.shootTargets = [];
    this.premove = null;
    this.arrows = [];
    
    // Board rendering
    this.squareSize = 0;
    this.boardOffset = { x: 0, y: 0 };
    
    this.init();
  }
  
  init() {
    // Setup event listeners
    this.setupMenuListeners();
    this.setupGameListeners();
    this.setupNetworkListeners();
    
    // Connect to server
    network.connect();
    
    // Start render loop
    this.render();
  }
  
  setupMenuListeners() {
    document.getElementById('join-btn').addEventListener('click', () => {
      const gameIdInput = document.getElementById('game-id-input');
      const gameId = network.joinGame(gameIdInput.value.trim() || null);
      document.getElementById('waiting-game-id').textContent = gameId;
      this.showScreen('waiting');
    });
    
    document.getElementById('play-again-btn').addEventListener('click', () => {
      window.location.reload();
    });
  }
  
  setupGameListeners() {
    // Shoot mode button
    document.getElementById('shoot-mode-btn').addEventListener('click', () => {
      this.toggleShootMode();
    });
    
    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.cancelPremove();
    });
    
    // Canvas input
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleCanvasClick(touch);
    });
    
    // Resize handler
    window.addEventListener('resize', () => this.resizeCanvas());
  }
  
  setupNetworkListeners() {
    network.on('joined', (data) => {
      this.playerColor = data.color;
      this.board = data.board;
      document.getElementById('player-color').textContent = data.color;
      
      // If we have both players already (reconnect case)
      if (data.energy && data.energy.white > 0) {
        this.gameStarted = true;
        this.showScreen('game');
        this.resizeCanvas();
      }
    });
    
    network.on('gameStart', (data) => {
      this.board = data.board;
      this.gameStarted = true;
      this.showScreen('game');
      this.resizeCanvas();
    });
    
    network.on('gameState', (data) => {
      this.board = data.board;
      this.energy = data.energy;
      this.arrows = data.arrows || [];
      
      // Update energy displays
      this.updateEnergyDisplay();
      
      // Check if our premove is still valid
      if (this.premove && !data.premoves[this.playerColor]) {
        // Premove executed or cancelled
        this.premove = null;
        document.getElementById('cancel-btn').disabled = true;
      }
      
      // Handle game over
      if (data.gameOver) {
        this.handleGameOver(data.winner);
      }
    });
    
    network.on('premoveSet', (data) => {
      this.premove = data;
      document.getElementById('cancel-btn').disabled = false;
      this.selectedPiece = null;
      this.validMoves = [];
      this.shootMode = false;
      this.shootTargets = [];
      this.updateShootModeButton();
    });
    
    network.on('premoveCancelled', () => {
      this.premove = null;
      document.getElementById('cancel-btn').disabled = true;
    });
    
    network.on('gameOver', (data) => {
      this.handleGameOver(data.winner, data.reason);
    });
  }
  
  showScreen(name) {
    Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
    this.screens[name].classList.add('active');
  }
  
  resizeCanvas() {
    const container = document.getElementById('game-container');
    const containerRect = container.getBoundingClientRect();
    
    // Make board fit in container while staying square
    const size = Math.min(containerRect.width, containerRect.height) - 20;
    this.canvas.width = size;
    this.canvas.height = size;
    
    this.squareSize = size / BOARD_SIZE;
    this.boardOffset = { x: 0, y: 0 };
  }
  
  handleCanvasClick(e) {
    if (!this.gameStarted || this.gameOver) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX || e.pageX) - rect.left;
    const y = (e.clientY || e.pageY) - rect.top;
    
    // Convert to board coordinates
    let col = Math.floor((x - this.boardOffset.x) / this.squareSize);
    let row = Math.floor((y - this.boardOffset.y) / this.squareSize);
    
    // Flip board for black player
    if (this.playerColor === 'black') {
      row = 7 - row;
      col = 7 - col;
    }
    
    if (row < 0 || row > 7 || col < 0 || col > 7) return;
    
    this.handleSquareClick(row, col);
  }
  
  handleSquareClick(row, col) {
    const piece = this.board[row][col];
    
    if (this.shootMode) {
      // In shoot mode, check if clicked square is a valid target
      const isTarget = this.shootTargets.some(t => t.row === row && t.col === col);
      if (isTarget) {
        this.sendShoot(row, col);
      } else {
        // Exit shoot mode
        this.shootMode = false;
        this.shootTargets = [];
        this.updateShootModeButton();
      }
      return;
    }
    
    // Check if clicking on a valid move destination
    if (this.selectedPiece) {
      const isValidMove = this.validMoves.some(m => m.row === row && m.col === col);
      if (isValidMove) {
        this.sendMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
        return;
      }
    }
    
    // Select piece
    if (piece && piece.color === this.playerColor) {
      this.selectedPiece = { row, col };
      this.validMoves = getValidMoves(this.board, row, col, this.playerColor);
    } else {
      this.selectedPiece = null;
      this.validMoves = [];
    }
  }
  
  toggleShootMode() {
    if (!this.gameStarted || this.gameOver) return;
    
    this.shootMode = !this.shootMode;
    this.selectedPiece = null;
    this.validMoves = [];
    
    if (this.shootMode) {
      this.shootTargets = getShootTargets(this.board, this.playerColor);
    } else {
      this.shootTargets = [];
    }
    
    this.updateShootModeButton();
  }
  
  updateShootModeButton() {
    const btn = document.getElementById('shoot-mode-btn');
    if (this.shootMode) {
      btn.classList.add('active');
      btn.textContent = '🏹 Cancel Shoot';
    } else {
      btn.classList.remove('active');
      btn.textContent = '🏹 Shoot Mode';
    }
  }
  
  sendMove(fromRow, fromCol, toRow, toCol) {
    network.sendPremove({
      type: 'move',
      fromRow,
      fromCol,
      toRow,
      toCol
    });
  }
  
  sendShoot(targetRow, targetCol) {
    network.sendPremove({
      type: 'shoot',
      targetRow,
      targetCol
    });
    
    this.shootMode = false;
    this.shootTargets = [];
    this.updateShootModeButton();
  }
  
  cancelPremove() {
    network.cancelPremove();
    this.premove = null;
    document.getElementById('cancel-btn').disabled = true;
  }
  
  updateEnergyDisplay() {
    const playerEnergy = this.energy[this.playerColor];
    const opponentColor = this.playerColor === 'white' ? 'black' : 'white';
    const opponentEnergy = this.energy[opponentColor];
    
    // Player energy
    const playerFill = document.getElementById('player-energy-fill');
    const playerText = document.getElementById('player-energy-text');
    playerFill.style.width = `${(playerEnergy / ENERGY_MAX) * 100}%`;
    playerText.textContent = playerEnergy.toFixed(1);
    
    // Opponent energy
    const opponentFill = document.getElementById('opponent-energy-fill');
    const opponentText = document.getElementById('opponent-energy-text');
    opponentFill.style.width = `${(opponentEnergy / ENERGY_MAX) * 100}%`;
    opponentText.textContent = opponentEnergy.toFixed(1);
  }
  
  handleGameOver(winner, reason) {
    this.gameOver = true;
    
    let title, message;
    if (winner === 'draw') {
      title = 'Draw!';
      message = 'Both kings were captured simultaneously!';
    } else if (winner === this.playerColor) {
      title = 'Victory! 🎉';
      message = reason === 'disconnect' 
        ? 'Your opponent disconnected.' 
        : 'You captured the enemy king!';
    } else {
      title = 'Defeat 😢';
      message = reason === 'disconnect'
        ? 'You disconnected from the game.'
        : 'Your king was captured!';
    }
    
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('gameover-message').textContent = message;
    this.showScreen('gameover');
  }
  
  // Rendering
  render() {
    if (this.gameStarted && !this.gameOver) {
      this.drawBoard();
    }
    requestAnimationFrame(() => this.render());
  }
  
  drawBoard() {
    const ctx = this.ctx;
    const size = this.squareSize;
    
    // Clear
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw squares
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        // Visual row/col (flipped for black)
        const vRow = this.playerColor === 'black' ? 7 - row : row;
        const vCol = this.playerColor === 'black' ? 7 - col : col;
        
        const x = this.boardOffset.x + vCol * size;
        const y = this.boardOffset.y + vRow * size;
        
        // Square color
        const isLight = (row + col) % 2 === 0;
        ctx.fillStyle = isLight ? COLORS.boardLight : COLORS.boardDark;
        ctx.fillRect(x, y, size, size);
        
        // Highlight selected
        if (this.selectedPiece && this.selectedPiece.row === row && this.selectedPiece.col === col) {
          ctx.fillStyle = COLORS.selected;
          ctx.fillRect(x, y, size, size);
        }
        
        // Highlight valid moves
        if (this.validMoves.some(m => m.row === row && m.col === col)) {
          ctx.fillStyle = COLORS.validMove;
          ctx.fillRect(x, y, size, size);
        }
        
        // Highlight shoot targets
        if (this.shootTargets.some(t => t.row === row && t.col === col)) {
          ctx.fillStyle = COLORS.shootTarget;
          ctx.fillRect(x, y, size, size);
        }
        
        // Highlight premove
        if (this.premove) {
          if (this.premove.type === 'move') {
            if ((this.premove.fromRow === row && this.premove.fromCol === col) ||
                (this.premove.toRow === row && this.premove.toCol === col)) {
              ctx.fillStyle = COLORS.premove;
              ctx.fillRect(x, y, size, size);
            }
          } else if (this.premove.type === 'shoot') {
            if (this.premove.targetRow === row && this.premove.targetCol === col) {
              ctx.fillStyle = COLORS.premove;
              ctx.fillRect(x, y, size, size);
            }
          }
        }
      }
    }
    
    // Draw pieces
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const piece = this.board[row][col];
        if (!piece) continue;
        
        const vRow = this.playerColor === 'black' ? 7 - row : row;
        const vCol = this.playerColor === 'black' ? 7 - col : col;
        
        const x = this.boardOffset.x + vCol * size + size / 2;
        const y = this.boardOffset.y + vRow * size + size / 2;
        
        this.drawPiece(ctx, piece, x, y, size);
      }
    }
    
    // Draw arrows
    this.drawArrows();
    
    // Draw shoot mode indicator
    if (this.shootMode) {
      const kingPos = getKingPosition(this.board, this.playerColor);
      if (kingPos) {
        const vRow = this.playerColor === 'black' ? 7 - kingPos.row : kingPos.row;
        const vCol = this.playerColor === 'black' ? 7 - kingPos.col : kingPos.col;
        const x = this.boardOffset.x + vCol * size + size / 2;
        const y = this.boardOffset.y + vRow * size + size / 2;
        
        ctx.strokeStyle = COLORS.arrow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, size / 2 - 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  
  drawPiece(ctx, piece, x, y, size) {
    const symbol = PIECE_SYMBOLS[piece.color][piece.type];
    
    ctx.font = `${size * 0.7}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw shadow for better visibility
    ctx.fillStyle = piece.color === 'white' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    ctx.fillText(symbol, x + 2, y + 2);
    
    // Draw piece
    ctx.fillStyle = piece.color === 'white' ? '#fff' : '#000';
    ctx.fillText(symbol, x, y);
    
    // Draw crown on king for visibility
    if (piece.type === 'king') {
      ctx.strokeStyle = piece.color === 'white' ? '#000' : '#fff';
      ctx.lineWidth = 1;
      ctx.strokeText(symbol, x, y);
    }
  }
  
  drawArrows() {
    if (!this.arrows || this.arrows.length === 0) return;
    
    const ctx = this.ctx;
    const size = this.squareSize;
    
    for (const arrow of this.arrows) {
      const fromVRow = this.playerColor === 'black' ? 7 - arrow.fromRow : arrow.fromRow;
      const fromVCol = this.playerColor === 'black' ? 7 - arrow.fromCol : arrow.fromCol;
      const toVRow = this.playerColor === 'black' ? 7 - arrow.toRow : arrow.toRow;
      const toVCol = this.playerColor === 'black' ? 7 - arrow.toCol : arrow.toCol;
      
      const fromX = this.boardOffset.x + fromVCol * size + size / 2;
      const fromY = this.boardOffset.y + fromVRow * size + size / 2;
      const toX = this.boardOffset.x + toVCol * size + size / 2;
      const toY = this.boardOffset.y + toVRow * size + size / 2;
      
      // Calculate current arrow position
      const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
      const progress = Math.min(arrow.progress * size, distance);
      const ratio = progress / distance;
      
      const currentX = fromX + (toX - fromX) * ratio;
      const currentY = fromY + (toY - fromY) * ratio;
      
      // Draw arrow
      ctx.save();
      ctx.strokeStyle = arrow.missed ? 'rgba(255,100,100,0.5)' : COLORS.arrow;
      ctx.fillStyle = arrow.missed ? 'rgba(255,100,100,0.5)' : COLORS.arrow;
      ctx.lineWidth = 3;
      
      // Arrow line
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
      
      // Arrow head
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const headSize = 10;
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(
        currentX - headSize * Math.cos(angle - Math.PI / 6),
        currentY - headSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        currentX - headSize * Math.cos(angle + Math.PI / 6),
        currentY - headSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
