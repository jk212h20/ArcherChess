# ♛ Archer Chess ♚

A real-time chess variant where the King has a bow and can shoot enemy pieces!

## 🎮 Game Rules

### Overview
Archer Chess is a **real-time** chess game (no turns!) where both players move simultaneously. The King has a special ability to shoot enemy pieces with a bow.

### Energy System
- **Max Energy:** 5 units
- **Regeneration:** 1 unit per second
- **Starting Energy:** 0 units

### Movement Costs
| Piece  | Energy Cost |
|--------|-------------|
| King   | 1 |
| Pawn   | 1 |
| Knight | 2 |
| Bishop | 2 |
| Rook   | 3 |
| Queen  | 4 |
| **King Shoot** | 2 |

### King's Shooting Ability
- The King can shoot any enemy piece (except the enemy King) in a straight line (horizontal, vertical, or diagonal)
- Line of sight required - pieces block the shot
- Cost: 2 energy

### Win Condition
**Capture the enemy King!** There is no check or checkmate - the King can be captured like any other piece.

### Premove System
- Queue your next action even without enough energy
- Action executes automatically when energy is sufficient
- Cancel queued actions anytime

### Simultaneous Resolution
- Both pieces moving to the same square = both destroyed
- Piece arrives at occupied square = captures the piece
- Target moves away before shot hits = shot misses

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Open in browser
open http://localhost:3000
```

## 🚂 Deploy to Railway

1. Fork or push this repo to GitHub
2. Go to [Railway.app](https://railway.app)
3. Create new project → Deploy from GitHub repo
4. Railway will auto-detect and deploy!

Or use the Railway CLI:
```bash
railway login
railway init
railway up
```

## 📱 How to Play

1. **Create/Join Game:** Enter a game ID or leave blank to create a new game
2. **Share the game ID** with a friend to play together
3. **Select a piece** by tapping/clicking it
4. **Move:** Tap a highlighted square to queue the move
5. **Shoot:** Press the 🏹 Shoot Mode button, then tap a red-highlighted enemy piece
6. **Cancel:** Press ✕ Cancel to cancel your queued action

## 🛠 Tech Stack
- **Server:** Node.js, Express, Socket.io
- **Client:** Vanilla JavaScript, HTML5 Canvas
- **Deployment:** Railway.app

## 📄 License
MIT
