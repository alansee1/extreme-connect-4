const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});

app.use(express.static('.'));

const rooms = new Map();

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ rows, cols, connectN, playerName }) => {
        const roomCode = generateRoomCode();
        const room = {
            code: roomCode,
            players: [{
                id: socket.id,
                name: playerName,
                number: 1
            }],
            config: { rows, cols, connectN },
            board: Array(rows).fill(null).map(() => Array(cols).fill(0)),
            currentPlayer: 1,
            gameStarted: false,
            gameOver: false
        };

        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.emit('room-created', { roomCode, playerNumber: 1 });
        console.log(`Room ${roomCode} created by ${playerName}`);
    });

    socket.on('join-room', ({ roomCode, playerName }) => {
        const room = rooms.get(roomCode);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.players.length >= 2) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        if (room.gameStarted) {
            socket.emit('error', { message: 'Game already in progress' });
            return;
        }

        room.players.push({
            id: socket.id,
            name: playerName,
            number: 2
        });

        socket.join(roomCode);
        room.gameStarted = true;

        socket.emit('room-joined', {
            roomCode,
            playerNumber: 2,
            config: room.config
        });

        io.to(roomCode).emit('game-start', {
            players: room.players,
            config: room.config,
            currentPlayer: room.currentPlayer
        });

        console.log(`${playerName} joined room ${roomCode}`);
    });

    socket.on('make-move', ({ roomCode, col }) => {
        const room = rooms.get(roomCode);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', { message: 'You are not in this game' });
            return;
        }

        if (player.number !== room.currentPlayer) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        if (room.gameOver) {
            socket.emit('error', { message: 'Game is over' });
            return;
        }

        const row = getLowestEmptyRow(room.board, col);
        if (row === -1) {
            socket.emit('error', { message: 'Column is full' });
            return;
        }

        room.board[row][col] = room.currentPlayer;

        const winner = checkForWinner(room.board, room.config.connectN);
        const isFull = isBoardFull(room.board);

        if (winner) {
            room.gameOver = true;
            io.to(roomCode).emit('move-made', {
                row,
                col,
                player: room.currentPlayer,
                winner,
                winningCells: findWinningCells(room.board, room.config.connectN)
            });
        } else if (isFull) {
            room.gameOver = true;
            io.to(roomCode).emit('move-made', {
                row,
                col,
                player: room.currentPlayer,
                draw: true
            });
        } else {
            room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
            io.to(roomCode).emit('move-made', {
                row,
                col,
                player: player.number,
                nextPlayer: room.currentPlayer
            });
        }
    });

    socket.on('reset-game', ({ roomCode }) => {
        const room = rooms.get(roomCode);

        if (!room) return;

        room.board = Array(room.config.rows).fill(null).map(() => Array(room.config.cols).fill(0));
        room.currentPlayer = 1;
        room.gameOver = false;

        io.to(roomCode).emit('game-reset', {
            config: room.config,
            currentPlayer: room.currentPlayer
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        for (const [roomCode, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                io.to(roomCode).emit('player-disconnected', {
                    player: room.players[playerIndex].name
                });
                rooms.delete(roomCode);
                console.log(`Room ${roomCode} deleted due to player disconnect`);
            }
        }
    });
});

function getLowestEmptyRow(board, col) {
    for (let row = board.length - 1; row >= 0; row--) {
        if (board[row][col] === 0) {
            return row;
        }
    }
    return -1;
}

function checkForWinner(board, connectN) {
    const rows = board.length;
    const cols = board[0].length;
    const directions = [
        { dr: 0, dc: 1 },
        { dr: 1, dc: 0 },
        { dr: 1, dc: 1 },
        { dr: 1, dc: -1 }
    ];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const player = board[row][col];
            if (player === 0) continue;

            for (const { dr, dc } of directions) {
                let count = 1;

                for (let i = 1; i < connectN; i++) {
                    const newRow = row + dr * i;
                    const newCol = col + dc * i;

                    if (newRow < 0 || newRow >= rows ||
                        newCol < 0 || newCol >= cols ||
                        board[newRow][newCol] !== player) {
                        break;
                    }
                    count++;
                }

                if (count === connectN) {
                    return player;
                }
            }
        }
    }
    return null;
}

function findWinningCells(board, connectN) {
    const rows = board.length;
    const cols = board[0].length;
    const directions = [
        { dr: 0, dc: 1 },
        { dr: 1, dc: 0 },
        { dr: 1, dc: 1 },
        { dr: 1, dc: -1 }
    ];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const player = board[row][col];
            if (player === 0) continue;

            for (const { dr, dc } of directions) {
                const cells = [[row, col]];

                for (let i = 1; i < connectN; i++) {
                    const newRow = row + dr * i;
                    const newCol = col + dc * i;

                    if (newRow < 0 || newRow >= rows ||
                        newCol < 0 || newCol >= cols ||
                        board[newRow][newCol] !== player) {
                        break;
                    }
                    cells.push([newRow, newCol]);
                }

                if (cells.length === connectN) {
                    return cells;
                }
            }
        }
    }
    return [];
}

function isBoardFull(board) {
    return board.every(row => row.every(cell => cell !== 0));
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
