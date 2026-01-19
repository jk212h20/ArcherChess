const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Game constants
const ENERGY_MAX = 5;
const ENERGY_REGEN_RATE = 0.5; // per second (half as fast)
const TICK_RATE = 60; // server ticks per second
const TICK_INTERVAL = 1000 / TICK_RATE;

// Energy costs
const ENERGY_COSTS = {
  king: 1,
  queen: 4,
  rook: 3,
  bishop: 2,
  knight: 2,
  pawn: 1,
  shoot: 2,
  castle: 2 // Castling costs 2 energy
};

// Active games
const games = new Map();

// Create initial board state
function createInitialBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Black pieces (row 0-1)
  board[0][0] = { type: 'rook', color: 'black', id: 'br1' };
  board[0][1] = { type: 'knight', color: 'black', id: 'bn1' };
  board[0][2] = { type: 'bishop', color: 'black', id: 'bb1' };
  board[0][3] = { type: 'queen', color: 'black', id: 'bq' };
  board[0][4] = { type: 'king', color: 'black', id: 'bk' };
  board[0][5] = { type: 'bishop', color: 'black', id: 'bb2' };
  board[0][6] = { type: 'knight', color: 'black', id: 'bn2' };
  board[0][7] = { type: 'rook', color: 'black', id: 'br2' };
  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: 'pawn', color: 'black', id: `bp${i}`, hasMoved: false };
  }
  
  // White pieces (row 6-7)
  for (let i = 0; i < 8; i++) {
    board[6][i] = { type: 'pawn', color: 'white', id: `wp${i}`, hasMoved: false };
  }
  board[7][0] = { type: 'rook', color: 'white', id: 'wr1' };
  board[7][1] = { type: 'knight', color: 'white', id: 'wn1' };
  board[7][2] = { type: 'bishop', color: 'white', id: 'wb1' };
  board[7][3] = { type: 'queen', color: 'white', id: 'wq' };
  board[7][4] = { type: 'king', color: 'white', id: 'wk' };
  board[7][5] = { type: 'bishop', color: 'white', id: 'wb2' };
  board[7][6] = { type: 'knight', color: 'white', id: 'wn2' };
  board[7][7] = { type: 'rook', color: 'white', id: 'wr2' };
  
  return board;
}

// Validate move based on piece type
function isValidMove(board, fromRow, fromCol, toRow, toCol, piece) {
  if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
  
  const target = board[toRow][toCol];
  if (target && target.color === piece.color) return false; // Can't capture own piece
  
  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;
  const absRowDiff = Math.abs(rowDiff);
  const absColDiff = Math.abs(colDiff);
  
  switch (piece.type) {
    case 'king':
      return absRowDiff <= 1 && absColDiff <= 1 && (absRowDiff + absColDiff > 0);
      
    case 'queen':
      return (isValidRookMove(board, fromRow, fromCol, toRow, toCol) ||
              isValidBishopMove(board, fromRow, fromCol, toRow, toCol));
      
    case 'rook':
      return isValidRookMove(board, fromRow, fromCol, toRow, toCol);
      
    case 'bishop':
      return isValidBishopMove(board, fromRow, fromCol, toRow, toCol);
      
    case 'knight':
      return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
      
    case 'pawn':
      const direction = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;
      
      // Forward move
      if (colDiff === 0 && !target) {
        if (rowDiff === direction) return true;
        if (rowDiff === 2 * direction && fromRow === startRow && !board[fromRow + direction][fromCol]) return true;
      }
      // Capture diagonally
      if (absColDiff === 1 && rowDiff === direction && target && target.color !== piece.color) {
        return true;
      }
      return false;
      
    default:
      return false;
  }
}

function isValidRookMove(board, fromRow, fromCol, toRow, toCol) {
  if (fromRow !== toRow && fromCol !== toCol) return false;
  
  const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
  const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
  
  let r = fromRow + rowStep;
  let c = fromCol + colStep;
  while (r !== toRow || c !== toCol) {
    if (board[r][c]) return false;
    r += rowStep;
    c += colStep;
  }
  return true;
}

function isValidBishopMove(board, fromRow, fromCol, toRow, toCol) {
  const absRowDiff = Math.abs(toRow - fromRow);
  const absColDiff = Math.abs(toCol - fromCol);
  if (absRowDiff !== absColDiff || absRowDiff === 0) return false;
  
  const rowStep = toRow > fromRow ? 1 : -1;
  const colStep = toCol > fromCol ? 1 : -1;
  
  let r = fromRow + rowStep;
  let c = fromCol + colStep;
  while (r !== toRow) {
    if (board[r][c]) return false;
    r += rowStep;
    c += colStep;
  }
  return true;
}

// Check if castling is valid
function canCastle(board, color, side) {
  const row = color === 'white' ? 7 : 0;
  const king = board[row][4];
  
  // King must be in place and not moved
  if (!king || king.type !== 'king' || king.color !== color || king.hasMoved) {
    return false;
  }
  
  if (side === 'kingside') {
    // Check rook at h-file (col 7)
    const rook = board[row][7];
    if (!rook || rook.type !== 'rook' || rook.color !== color || rook.hasMoved) {
      return false;
    }
    // Check squares between king and rook are empty
    if (board[row][5] || board[row][6]) {
      return false;
    }
    return true;
  } else if (side === 'queenside') {
    // Check rook at a-file (col 0)
    const rook = board[row][0];
    if (!rook || rook.type !== 'rook' || rook.color !== color || rook.hasMoved) {
      return false;
    }
    // Check squares between king and rook are empty
    if (board[row][1] || board[row][2] || board[row][3]) {
      return false;
    }
    return true;
  }
  return false;
}

// Check if king can shoot target (line of sight)
function canShootTarget(board, kingRow, kingCol, targetRow, targetCol, kingColor) {
  const target = board[targetRow][targetCol];
  if (!target || target.color === kingColor) return false;
  if (target.type === 'king') return false; // Can't shoot enemy king
  
  const rowDiff = targetRow - kingRow;
  const colDiff = targetCol - kingCol;
  const absRowDiff = Math.abs(rowDiff);
  const absColDiff = Math.abs(colDiff);
  
  // Must be in straight line (rook-style) or diagonal (bishop-style)
  if (rowDiff === 0 || colDiff === 0 || absRowDiff === absColDiff) {
    // Check line of sight
    const rowStep = rowDiff === 0 ? 0 : (rowDiff > 0 ? 1 : -1);
    const colStep = colDiff === 0 ? 0 : (colDiff > 0 ? 1 : -1);
    
    let r = kingRow + rowStep;
    let c = kingCol + colStep;
    while (r !== targetRow || c !== targetCol) {
      if (board[r][c]) return false; // Blocked
      r += rowStep;
      c += colStep;
    }
    return true;
  }
  return false;
}

// Create a new game
function createGame(gameId) {
  return {
    id: gameId,
    board: createInitialBoard(),
    players: {
      white: null,
      black: null
    },
    energy: {
      white: 0,
      black: 0
    },
    premoves: {
      white: null,
      black: null
    },
    arrows: [], // Active arrows in flight
    gameOver: false,
    winner: null,
    startTime: null,
    lastTick: null
  };
}

// Process game tick
function processTick(game) {
  if (game.gameOver || !game.startTime) return;
  
  const now = Date.now();
  const deltaTime = (now - game.lastTick) / 1000;
  game.lastTick = now;
  
  // Regenerate energy
  game.energy.white = Math.min(ENERGY_MAX, game.energy.white + ENERGY_REGEN_RATE * deltaTime);
  game.energy.black = Math.min(ENERGY_MAX, game.energy.black + ENERGY_REGEN_RATE * deltaTime);
  
  // Collect actions ready to execute
  const actionsToExecute = [];
  
  // Check white premove
  if (game.premoves.white && game.energy.white >= game.premoves.white.cost) {
    actionsToExecute.push({ ...game.premoves.white, color: 'white' });
    game.energy.white -= game.premoves.white.cost;
    game.premoves.white = null;
  }
  
  // Check black premove
  if (game.premoves.black && game.energy.black >= game.premoves.black.cost) {
    actionsToExecute.push({ ...game.premoves.black, color: 'black' });
    game.energy.black -= game.premoves.black.cost;
    game.premoves.black = null;
  }
  
  // Process simultaneous actions
  if (actionsToExecute.length > 0) {
    processSimultaneousActions(game, actionsToExecute);
  }
  
  // Update arrows
  updateArrows(game, deltaTime);
  
  // Check win condition
  checkWinCondition(game);
}

function processSimultaneousActions(game, actions) {
  const moves = actions.filter(a => a.type === 'move');
  const shots = actions.filter(a => a.type === 'shoot');
  const castles = actions.filter(a => a.type === 'castle');
  
  // Process castling first (atomic action)
  for (const castle of castles) {
    const row = castle.color === 'white' ? 7 : 0;
    const king = game.board[row][4];
    
    if (castle.side === 'kingside') {
      const rook = game.board[row][7];
      // Move king to g-file, rook to f-file
      game.board[row][4] = null;
      game.board[row][7] = null;
      game.board[row][6] = { ...king, hasMoved: true };
      game.board[row][5] = { ...rook, hasMoved: true };
    } else {
      const rook = game.board[row][0];
      // Move king to c-file, rook to d-file
      game.board[row][4] = null;
      game.board[row][0] = null;
      game.board[row][2] = { ...king, hasMoved: true };
      game.board[row][3] = { ...rook, hasMoved: true };
    }
  }
  
  // First, record where pieces are moving FROM
  const movingFrom = new Map();
  for (const move of moves) {
    movingFrom.set(`${move.fromRow},${move.fromCol}`, move);
  }
  
  // Track destinations for collision detection
  const destinations = new Map();
  for (const move of moves) {
    const key = `${move.toRow},${move.toCol}`;
    if (!destinations.has(key)) destinations.set(key, []);
    destinations.get(key).push(move);
  }
  
  // Process moves
  const piecesToRemove = [];
  const piecesToAdd = [];
  
  for (const move of moves) {
    const destKey = `${move.toRow},${move.toCol}`;
    const destMoves = destinations.get(destKey);
    
    if (destMoves.length > 1) {
      // Multiple pieces arriving at same square - both destroyed
      for (const m of destMoves) {
        piecesToRemove.push({ row: m.fromRow, col: m.fromCol });
      }
    } else {
      // Single piece moving
      const piece = game.board[move.fromRow][move.fromCol];
      const targetPiece = game.board[move.toRow][move.toCol];
      
      // Check if target is moving away
      const targetKey = `${move.toRow},${move.toCol}`;
      const targetMovingAway = movingFrom.has(targetKey);
      
      if (targetPiece && !targetMovingAway) {
        // Capture - target is there and not moving
        piecesToRemove.push({ row: move.toRow, col: move.toCol });
      }
      
      piecesToRemove.push({ row: move.fromRow, col: move.fromCol });
      piecesToAdd.push({ row: move.toRow, col: move.toCol, piece: { ...piece, hasMoved: true } });
    }
  }
  
  // Process shots
  for (const shot of shots) {
    const targetPiece = game.board[shot.targetRow][shot.targetCol];
    const targetKey = `${shot.targetRow},${shot.targetCol}`;
    const targetMovingAway = movingFrom.has(targetKey);
    
    if (targetPiece && !targetMovingAway) {
      // Target is there - shoot it
      piecesToRemove.push({ row: shot.targetRow, col: shot.targetCol });
      
      // Add arrow animation
      game.arrows.push({
        fromRow: shot.fromRow,
        fromCol: shot.fromCol,
        toRow: shot.targetRow,
        toCol: shot.targetCol,
        progress: 0,
        speed: 5 // squares per second
      });
    }
    // If target moved away, shot misses (arrow still flies but hits nothing)
    else {
      game.arrows.push({
        fromRow: shot.fromRow,
        fromCol: shot.fromCol,
        toRow: shot.targetRow,
        toCol: shot.targetCol,
        progress: 0,
        speed: 5,
        missed: true
      });
    }
  }
  
  // Apply removals first
  for (const rem of piecesToRemove) {
    game.board[rem.row][rem.col] = null;
  }
  
  // Apply additions
  for (const add of piecesToAdd) {
    game.board[add.row][add.col] = add.piece;
    
    // Pawn promotion
    if (add.piece.type === 'pawn') {
      if ((add.piece.color === 'white' && add.row === 0) ||
          (add.piece.color === 'black' && add.row === 7)) {
        game.board[add.row][add.col] = { ...add.piece, type: 'queen' };
      }
    }
  }
}

function updateArrows(game, deltaTime) {
  game.arrows = game.arrows.filter(arrow => {
    arrow.progress += arrow.speed * deltaTime;
    const distance = Math.sqrt(
      Math.pow(arrow.toRow - arrow.fromRow, 2) + 
      Math.pow(arrow.toCol - arrow.fromCol, 2)
    );
    return arrow.progress < distance;
  });
}

function checkWinCondition(game) {
  let whiteKingAlive = false;
  let blackKingAlive = false;
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = game.board[r][c];
      if (piece && piece.type === 'king') {
        if (piece.color === 'white') whiteKingAlive = true;
        if (piece.color === 'black') blackKingAlive = true;
      }
    }
  }
  
  if (!whiteKingAlive && !blackKingAlive) {
    game.gameOver = true;
    game.winner = 'draw';
  } else if (!whiteKingAlive) {
    game.gameOver = true;
    game.winner = 'black';
  } else if (!blackKingAlive) {
    game.gameOver = true;
    game.winner = 'white';
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Create or join game
  socket.on('joinGame', (gameId) => {
    let game = games.get(gameId);
    
    if (!game) {
      game = createGame(gameId);
      games.set(gameId, game);
    }
    
    // Assign player color
    let playerColor = null;
    if (!game.players.white) {
      game.players.white = socket.id;
      playerColor = 'white';
    } else if (!game.players.black) {
      game.players.black = socket.id;
      playerColor = 'black';
    } else {
      socket.emit('error', 'Game is full');
      return;
    }
    
    socket.join(gameId);
    socket.gameId = gameId;
    socket.playerColor = playerColor;
    
    socket.emit('joined', { 
      gameId, 
      color: playerColor,
      board: game.board,
      energy: game.energy
    });
    
    // Start game if both players present
    if (game.players.white && game.players.black && !game.startTime) {
      game.startTime = Date.now();
      game.lastTick = Date.now();
      io.to(gameId).emit('gameStart', { board: game.board });
    }
  });
  
  // Handle premove
  socket.on('premove', (data) => {
    const game = games.get(socket.gameId);
    if (!game || game.gameOver) return;
    
    const color = socket.playerColor;
    if (!color) return;
    
    // Validate the action
    if (data.type === 'move') {
      const piece = game.board[data.fromRow][data.fromCol];
      if (!piece || piece.color !== color) return;
      if (!isValidMove(game.board, data.fromRow, data.fromCol, data.toRow, data.toCol, piece)) return;
      
      const cost = ENERGY_COSTS[piece.type];
      game.premoves[color] = { ...data, cost };
      
      socket.emit('premoveSet', { ...data, cost });
    } else if (data.type === 'castle') {
      // Validate castling
      if (!canCastle(game.board, color, data.side)) return;
      
      game.premoves[color] = { 
        type: 'castle',
        side: data.side,
        cost: ENERGY_COSTS.castle 
      };
      
      socket.emit('premoveSet', { type: 'castle', side: data.side, cost: ENERGY_COSTS.castle });
    } else if (data.type === 'shoot') {
      // Find king
      let kingRow, kingCol;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = game.board[r][c];
          if (p && p.type === 'king' && p.color === color) {
            kingRow = r;
            kingCol = c;
          }
        }
      }
      
      if (kingRow === undefined) return;
      if (!canShootTarget(game.board, kingRow, kingCol, data.targetRow, data.targetCol, color)) return;
      
      game.premoves[color] = { 
        type: 'shoot',
        fromRow: kingRow,
        fromCol: kingCol,
        targetRow: data.targetRow,
        targetCol: data.targetCol,
        cost: ENERGY_COSTS.shoot 
      };
      
      socket.emit('premoveSet', { ...data, cost: ENERGY_COSTS.shoot });
    }
  });
  
  // Cancel premove
  socket.on('cancelPremove', () => {
    const game = games.get(socket.gameId);
    if (!game) return;
    
    const color = socket.playerColor;
    if (color) {
      game.premoves[color] = null;
      socket.emit('premoveCancelled');
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const game = games.get(socket.gameId);
    if (game) {
      if (game.players.white === socket.id) {
        game.players.white = null;
        if (!game.gameOver) {
          game.gameOver = true;
          game.winner = 'black';
          io.to(socket.gameId).emit('gameOver', { winner: 'black', reason: 'disconnect' });
        }
      } else if (game.players.black === socket.id) {
        game.players.black = null;
        if (!game.gameOver) {
          game.gameOver = true;
          game.winner = 'white';
          io.to(socket.gameId).emit('gameOver', { winner: 'white', reason: 'disconnect' });
        }
      }
      
      // Clean up empty games
      if (!game.players.white && !game.players.black) {
        games.delete(socket.gameId);
      }
    }
  });
});

// Game loop
setInterval(() => {
  for (const [gameId, game] of games) {
    if (game.startTime && !game.gameOver) {
      processTick(game);
      
      io.to(gameId).emit('gameState', {
        board: game.board,
        energy: game.energy,
        premoves: {
          white: game.premoves.white ? true : false,
          black: game.premoves.black ? true : false
        },
        arrows: game.arrows,
        gameOver: game.gameOver,
        winner: game.winner
      });
    }
  }
}, TICK_INTERVAL);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Archer Chess server running on port ${PORT}`);
});
