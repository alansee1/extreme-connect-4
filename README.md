# Extreme Connect-N

A configurable Connect 4-style game where you can customize the board size and the number of pieces needed to win. Play locally or online with friends!

## Features

- **Configurable Board Size**: Set rows and columns from 4x4 up to 20x20
- **Configurable Win Condition**: Choose how many pieces in a row to win (3-10)
- **Multiple Game Modes**:
  - **Local Game**: Play with someone on the same device
  - **Online Multiplayer**: Create a room and play with someone remotely
- **Real-time Multiplayer**: Instant synchronization using WebSockets
- **Smooth Animations**: Physics-based piece dropping with gravity
- **Hover Preview**: See where your piece will land before clicking
- **Win Detection**: Checks all directions (horizontal, vertical, both diagonals)
- **Visual Feedback**: Winning pieces highlighted in green
- **Modern UI**: Clean, responsive design with smooth animations

## Development

### Prerequisites

- Node.js (v14 or higher)

### Setup

```bash
# Install dependencies
npm install

# Start development server (includes multiplayer server)
npm run dev
```

The game will be available at `http://localhost:3000`.

## How to Play

### Local Game

1. Click "Local Game" on the home screen
2. Configure your game settings:
   - **Rows**: Number of rows on the board (4-20)
   - **Columns**: Number of columns on the board (4-20)
   - **Connect**: How many pieces in a row needed to win (3-10)
3. Click "Start New Game" to begin
4. Players take turns clicking on columns to drop their pieces
5. First player to connect N pieces in a row wins!

### Online Multiplayer

#### Creating a Room

1. Click "Create Room" on the home screen
2. Enter your name
3. Configure the game settings (rows, columns, connect)
4. Share the room code with your friend
5. Wait for them to join
6. Game starts automatically when both players are ready!

#### Joining a Room

1. Click "Join Room" on the home screen
2. Enter your name
3. Enter the room code shared by your friend
4. Game starts immediately!

### Gameplay Tips

- In multiplayer mode, you can only make moves during your turn
- The current player's turn is displayed at the top
- Winning pieces are highlighted in green
- Click "Reset Game" to play again with the same settings

## Deployment

### For Production Use

When deploying to a live server:

1. Update the server URL in `game.js`:
   ```javascript
   // Change from:
   this.socket = io('http://localhost:3000');

   // To your production URL:
   this.socket = io('https://your-domain.com');
   ```

2. Start the server:
   ```bash
   node server.js
   ```

3. For production deployment, consider using:
   - PM2 for process management
   - Nginx as a reverse proxy
   - Environment variables for configuration

### Embedding in Your Website

You can embed the game in your site as an iframe:

```html
<iframe src="https://your-game-url.com" width="900" height="800"></iframe>
```

## Project Structure

```
extreme-connect-4/
├── index.html      # Main HTML file with game UI
├── game.js         # Client-side game logic and Socket.io client
├── styles.css      # All styling and animations
├── server.js       # Node.js/Express server with Socket.io
└── package.json    # Dependencies and scripts
```

## Customization

The game colors and styling can be customized in `styles.css`. Key color variables are defined in the JavaScript `colors` object in `game.js`:

```javascript
this.colors = {
    board: '#2c3e50',
    empty: '#34495e',
    player1: '#e74c3c',    // Red
    player2: '#f1c40f',    // Yellow
    hover: 'rgba(255, 255, 255, 0.3)',
    winning: '#2ecc71'     // Green
};
```

## Technologies Used

- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **Dev Tools**: Vite (for future builds)

## License

ISC
