// Client-side piece logic helpers

// Get all valid moves for a piece
function getValidMoves(board, row, col, playerColor) {
  const piece = board[row][col];
  if (!piece || piece.color !== playerColor) return [];
  
  const moves = [];
  
  switch (piece.type) {
    case 'king':
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (isValidSquare(nr, nc) && canMoveTo(board, nr, nc, playerColor)) {
            moves.push({ row: nr, col: nc });
          }
        }
      }
      break;
      
    case 'queen':
      moves.push(...getRookMoves(board, row, col, playerColor));
      moves.push(...getBishopMoves(board, row, col, playerColor));
      break;
      
    case 'rook':
      moves.push(...getRookMoves(board, row, col, playerColor));
      break;
      
    case 'bishop':
      moves.push(...getBishopMoves(board, row, col, playerColor));
      break;
      
    case 'knight':
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of knightMoves) {
        const nr = row + dr;
        const nc = col + dc;
        if (isValidSquare(nr, nc) && canMoveTo(board, nr, nc, playerColor)) {
          moves.push({ row: nr, col: nc });
        }
      }
      break;
      
    case 'pawn':
      const direction = playerColor === 'white' ? -1 : 1;
      const startRow = playerColor === 'white' ? 6 : 1;
      
      // Forward move
      const forward = row + direction;
      if (isValidSquare(forward, col) && !board[forward][col]) {
        moves.push({ row: forward, col: col });
        
        // Double move from start
        const doubleForward = row + 2 * direction;
        if (row === startRow && !board[doubleForward][col]) {
          moves.push({ row: doubleForward, col: col });
        }
      }
      
      // Diagonal captures
      for (const dc of [-1, 1]) {
        const nc = col + dc;
        if (isValidSquare(forward, nc)) {
          const target = board[forward][nc];
          if (target && target.color !== playerColor) {
            moves.push({ row: forward, col: nc });
          }
        }
      }
      break;
  }
  
  return moves;
}

// Get shoot targets for king
function getShootTargets(board, playerColor) {
  // Find king position
  let kingRow, kingCol;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'king' && piece.color === playerColor) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
    if (kingRow !== undefined) break;
  }
  
  if (kingRow === undefined) return [];
  
  const targets = [];
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],  // Rook directions
    [-1, -1], [-1, 1], [1, -1], [1, 1]  // Bishop directions
  ];
  
  for (const [dr, dc] of directions) {
    let r = kingRow + dr;
    let c = kingCol + dc;
    
    while (isValidSquare(r, c)) {
      const piece = board[r][c];
      if (piece) {
        // Can shoot enemy pieces (except king)
        if (piece.color !== playerColor && piece.type !== 'king') {
          targets.push({ row: r, col: c });
        }
        break; // Blocked by this piece
      }
      r += dr;
      c += dc;
    }
  }
  
  return targets;
}

// Helper functions
function isValidSquare(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function canMoveTo(board, row, col, playerColor) {
  const piece = board[row][col];
  return !piece || piece.color !== playerColor;
}

function getRookMoves(board, row, col, playerColor) {
  const moves = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;
    
    while (isValidSquare(r, c)) {
      const piece = board[r][c];
      if (!piece) {
        moves.push({ row: r, col: c });
      } else if (piece.color !== playerColor) {
        moves.push({ row: r, col: c });
        break;
      } else {
        break;
      }
      r += dr;
      c += dc;
    }
  }
  
  return moves;
}

function getBishopMoves(board, row, col, playerColor) {
  const moves = [];
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;
    
    while (isValidSquare(r, c)) {
      const piece = board[r][c];
      if (!piece) {
        moves.push({ row: r, col: c });
      } else if (piece.color !== playerColor) {
        moves.push({ row: r, col: c });
        break;
      } else {
        break;
      }
      r += dr;
      c += dc;
    }
  }
  
  return moves;
}

// Get king position
function getKingPosition(board, playerColor) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'king' && piece.color === playerColor) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}
