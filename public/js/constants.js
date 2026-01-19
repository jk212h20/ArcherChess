// Game constants
const BOARD_SIZE = 8;
const ENERGY_MAX = 5;

// Energy costs (must match server)
const ENERGY_COSTS = {
  king: 1,
  queen: 4,
  rook: 3,
  bishop: 2,
  knight: 2,
  pawn: 1,
  shoot: 2,
  castle: 2
};

// Colors
const COLORS = {
  boardLight: '#eeeed2',
  boardDark: '#769656',
  highlight: 'rgba(255, 255, 0, 0.5)',
  validMove: 'rgba(0, 200, 100, 0.4)',
  premove: 'rgba(0, 150, 255, 0.5)',
  shootTarget: 'rgba(255, 50, 50, 0.5)',
  selected: 'rgba(255, 200, 0, 0.6)',
  arrow: '#e94560',
  lastMove: 'rgba(155, 199, 0, 0.4)'
};

// Piece symbols (Unicode chess pieces)
const PIECE_SYMBOLS = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙'
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟'
  }
};
