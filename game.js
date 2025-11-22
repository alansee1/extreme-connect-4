class ConnectNGame {
    constructor() {
        this.canvas = document.getElementById('game-board');
        this.ctx = this.canvas.getContext('2d');
        this.rows = 6;
        this.cols = 7;
        this.connectN = 4;
        this.cellSize = 70;
        this.padding = 10;
        this.radius = 28;
        this.board = [];
        this.currentPlayer = 1;
        this.gameOver = false;
        this.animatingPiece = null;
        this.multiplayerMode = false;
        this.socket = null;
        this.roomCode = null;
        this.playerNumber = null;
        this.playerName = null;
        this.opponentName = null;

        this.colors = {
            board: '#2c3e50',
            empty: '#34495e',
            player1: '#e74c3c',
            player2: '#f1c40f',
            hover: 'rgba(255, 255, 255, 0.3)',
            winning: '#2ecc71'
        };

        this.setupEventListeners();
        this.initGame();
    }

    setupEventListeners() {
        document.getElementById('local-game-btn').addEventListener('click', () => {
            this.startLocalGame();
        });

        document.getElementById('create-room-btn').addEventListener('click', () => {
            this.showNamePrompt('create');
        });

        document.getElementById('join-room-btn').addEventListener('click', () => {
            this.showNamePrompt('join');
        });

        document.getElementById('start-game').addEventListener('click', () => {
            this.rows = parseInt(document.getElementById('rows').value);
            this.cols = parseInt(document.getElementById('cols').value);
            this.connectN = parseInt(document.getElementById('connect').value);
            this.validateAndStartGame();
        });

        document.getElementById('reset-game').addEventListener('click', () => {
            if (this.multiplayerMode && this.socket) {
                this.socket.emit('reset-game', { roomCode: this.roomCode });
            } else {
                this.initGame();
            }
        });

        document.getElementById('copy-room-code').addEventListener('click', () => {
            const codeDisplay = document.getElementById('room-code-display');
            navigator.clipboard.writeText(codeDisplay.textContent);
            alert('Room code copied to clipboard!');
        });

        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    }

    showNamePrompt(action) {
        const name = prompt('Enter your name:');
        if (!name) return;

        this.playerName = name;

        if (action === 'create') {
            this.createRoom();
        } else {
            const roomCode = prompt('Enter room code:');
            if (roomCode) {
                this.joinRoom(roomCode.toUpperCase());
            }
        }
    }

    startLocalGame() {
        this.multiplayerMode = false;
        document.getElementById('mode-selection').style.display = 'none';
        document.getElementById('config-panel').style.display = 'flex';
        document.getElementById('game-area').style.display = 'block';
        this.initGame();
    }

    createRoom() {
        this.multiplayerMode = true;
        this.connectToServer();

        this.rows = parseInt(document.getElementById('rows').value);
        this.cols = parseInt(document.getElementById('cols').value);
        this.connectN = parseInt(document.getElementById('connect').value);

        if (!this.validateConfig()) return;

        this.socket.emit('create-room', {
            rows: this.rows,
            cols: this.cols,
            connectN: this.connectN,
            playerName: this.playerName
        });
    }

    joinRoom(roomCode) {
        this.multiplayerMode = true;
        this.roomCode = roomCode;
        this.connectToServer();

        this.socket.emit('join-room', {
            roomCode: roomCode,
            playerName: this.playerName
        });
    }

    connectToServer() {
        if (this.socket) return;

        this.socket = io('http://localhost:3000');

        this.socket.on('room-created', ({ roomCode, playerNumber }) => {
            this.roomCode = roomCode;
            this.playerNumber = playerNumber;

            document.getElementById('mode-selection').style.display = 'none';
            document.getElementById('config-panel').style.display = 'none';
            document.getElementById('game-area').style.display = 'block';
            document.getElementById('room-info').style.display = 'block';
            document.getElementById('room-code-display').textContent = roomCode;

            this.initGame();
            this.updateGameStatus('Waiting for opponent to join...', 'waiting');
        });

        this.socket.on('room-joined', ({ roomCode, playerNumber, config }) => {
            this.roomCode = roomCode;
            this.playerNumber = playerNumber;
            this.rows = config.rows;
            this.cols = config.cols;
            this.connectN = config.connectN;

            document.getElementById('mode-selection').style.display = 'none';
            document.getElementById('config-panel').style.display = 'none';
            document.getElementById('game-area').style.display = 'block';
            document.getElementById('room-info').style.display = 'block';
            document.getElementById('room-code-display').textContent = roomCode;
            document.getElementById('copy-room-code').style.display = 'none';
        });

        this.socket.on('game-start', ({ players, config, currentPlayer }) => {
            this.rows = config.rows;
            this.cols = config.cols;
            this.connectN = config.connectN;

            const opponent = players.find(p => p.number !== this.playerNumber);
            this.opponentName = opponent ? opponent.name : 'Opponent';

            this.initGame();
            this.currentPlayer = currentPlayer;
            this.updatePlayerIndicator();
            this.updateGameStatus('Game started!', 'success');
            setTimeout(() => this.updateGameStatus(''), 2000);
        });

        this.socket.on('move-made', ({ row, col, player, nextPlayer, winner, winningCells, draw }) => {
            this.animatingPiece = {
                col: col,
                currentRow: -1,
                targetRow: row,
                player: player,
                speed: 0.5
            };

            const animateMove = () => {
                if (!this.animatingPiece) return;

                this.animatingPiece.currentRow += this.animatingPiece.speed;
                this.animatingPiece.speed += 0.3;

                if (this.animatingPiece.currentRow >= this.animatingPiece.targetRow) {
                    this.board[row][col] = player;
                    this.animatingPiece = null;

                    if (winner) {
                        this.gameOver = true;
                        this.winningCells = winningCells;
                        const winnerName = winner === this.playerNumber ? 'You' : this.opponentName;
                        this.updateGameStatus(`${winnerName} Win!`, 'winner');
                    } else if (draw) {
                        this.gameOver = true;
                        this.updateGameStatus("It's a Draw!", 'draw');
                    } else {
                        this.currentPlayer = nextPlayer;
                        this.updatePlayerIndicator();
                    }
                    this.draw();
                } else {
                    this.draw();
                    requestAnimationFrame(animateMove);
                }
            };

            animateMove();
        });

        this.socket.on('game-reset', ({ config, currentPlayer }) => {
            this.rows = config.rows;
            this.cols = config.cols;
            this.connectN = config.connectN;
            this.initGame();
            this.currentPlayer = currentPlayer;
            this.updatePlayerIndicator();
        });

        this.socket.on('player-disconnected', ({ player }) => {
            this.updateGameStatus(`${player} disconnected. Game ended.`, 'error');
            this.gameOver = true;
        });

        this.socket.on('error', ({ message }) => {
            alert(message);
        });
    }

    validateConfig() {
        if (this.connectN > Math.max(this.rows, this.cols)) {
            alert(`Connect value (${this.connectN}) cannot be greater than the largest board dimension (${Math.max(this.rows, this.cols)})`);
            return false;
        }
        if (this.connectN < 3) {
            alert('Connect value must be at least 3');
            return false;
        }
        return true;
    }

    validateAndStartGame() {
        if (!this.validateConfig()) return;
        this.initGame();
    }

    initGame() {
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
        this.currentPlayer = 1;
        this.gameOver = false;
        this.animatingPiece = null;
        this.winningCells = [];

        this.canvas.width = this.cols * this.cellSize + this.padding * 2;
        this.canvas.height = this.rows * this.cellSize + this.padding * 2;

        if (!this.multiplayerMode) {
            this.updateGameStatus('');
        }
        this.updatePlayerIndicator();
        this.draw();
    }

    handleClick(e) {
        if (this.gameOver || this.animatingPiece) return;

        if (this.multiplayerMode && this.currentPlayer !== this.playerNumber) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const col = Math.floor((x - this.padding) / this.cellSize);

        if (col >= 0 && col < this.cols) {
            this.dropPiece(col);
        }
    }

    handleHover(e) {
        if (this.gameOver || this.animatingPiece) return;

        if (this.multiplayerMode && this.currentPlayer !== this.playerNumber) {
            this.hoveredCol = null;
            this.draw();
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const col = Math.floor((x - this.padding) / this.cellSize);

        if (col >= 0 && col < this.cols) {
            this.hoveredCol = col;
            this.draw();
        }
    }

    handleMouseLeave() {
        this.hoveredCol = null;
        this.draw();
    }

    dropPiece(col) {
        const row = this.getLowestEmptyRow(col);
        if (row === -1) return;

        if (this.multiplayerMode) {
            this.socket.emit('make-move', {
                roomCode: this.roomCode,
                col: col
            });
        } else {
            this.animatingPiece = {
                col: col,
                currentRow: -1,
                targetRow: row,
                player: this.currentPlayer,
                speed: 0.5
            };
            this.animate();
        }
    }

    animate() {
        if (!this.animatingPiece) return;

        this.animatingPiece.currentRow += this.animatingPiece.speed;
        this.animatingPiece.speed += 0.3;

        if (this.animatingPiece.currentRow >= this.animatingPiece.targetRow) {
            this.board[this.animatingPiece.targetRow][this.animatingPiece.col] = this.animatingPiece.player;
            this.animatingPiece = null;
            this.checkWin();
            if (!this.gameOver) {
                this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
                this.updatePlayerIndicator();
            }
            this.draw();
        } else {
            this.draw();
            requestAnimationFrame(() => this.animate());
        }
    }

    getLowestEmptyRow(col) {
        for (let row = this.rows - 1; row >= 0; row--) {
            if (this.board[row][col] === 0) {
                return row;
            }
        }
        return -1;
    }

    checkWin() {
        const winner = this.checkForWinner();
        if (winner) {
            this.gameOver = true;
            this.updateGameStatus(`Player ${winner} Wins!`, 'winner');
            return;
        }

        if (this.isBoardFull()) {
            this.gameOver = true;
            this.updateGameStatus("It's a Draw!", 'draw');
        }
    }

    checkForWinner() {
        const directions = [
            { dr: 0, dc: 1 },
            { dr: 1, dc: 0 },
            { dr: 1, dc: 1 },
            { dr: 1, dc: -1 }
        ];

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const player = this.board[row][col];
                if (player === 0) continue;

                for (const { dr, dc } of directions) {
                    const cells = [[row, col]];

                    for (let i = 1; i < this.connectN; i++) {
                        const newRow = row + dr * i;
                        const newCol = col + dc * i;

                        if (newRow < 0 || newRow >= this.rows ||
                            newCol < 0 || newCol >= this.cols ||
                            this.board[newRow][newCol] !== player) {
                            break;
                        }

                        cells.push([newRow, newCol]);
                    }

                    if (cells.length === this.connectN) {
                        this.winningCells = cells;
                        return player;
                    }
                }
            }
        }
        return null;
    }

    isBoardFull() {
        return this.board.every(row => row.every(cell => cell !== 0));
    }

    draw() {
        this.ctx.fillStyle = this.colors.board;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = col * this.cellSize + this.padding + this.cellSize / 2;
                const y = row * this.cellSize + this.padding + this.cellSize / 2;

                const isWinningCell = this.winningCells.some(
                    ([r, c]) => r === row && c === col
                );

                if (this.board[row][col] === 0) {
                    this.ctx.fillStyle = this.colors.empty;
                } else if (isWinningCell) {
                    this.ctx.fillStyle = this.colors.winning;
                } else {
                    this.ctx.fillStyle = this.board[row][col] === 1 ?
                        this.colors.player1 : this.colors.player2;
                }

                this.ctx.beginPath();
                this.ctx.arc(x, y, this.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        if (this.animatingPiece) {
            const x = this.animatingPiece.col * this.cellSize + this.padding + this.cellSize / 2;
            const y = this.animatingPiece.currentRow * this.cellSize + this.padding + this.cellSize / 2;

            this.ctx.fillStyle = this.animatingPiece.player === 1 ?
                this.colors.player1 : this.colors.player2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        if (this.hoveredCol !== null && !this.gameOver && !this.animatingPiece) {
            const row = this.getLowestEmptyRow(this.hoveredCol);
            if (row !== -1) {
                const x = this.hoveredCol * this.cellSize + this.padding + this.cellSize / 2;
                const y = row * this.cellSize + this.padding + this.cellSize / 2;

                this.ctx.fillStyle = this.colors.hover;
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    updatePlayerIndicator() {
        const indicator = document.getElementById('current-player');

        if (this.multiplayerMode) {
            if (this.currentPlayer === this.playerNumber) {
                indicator.textContent = 'Your Turn';
            } else {
                const opponentName = this.opponentName || 'Opponent';
                indicator.textContent = `${opponentName}'s Turn`;
            }
        } else {
            indicator.textContent = `Player ${this.currentPlayer}'s Turn`;
        }

        indicator.style.color = this.currentPlayer === 1 ? this.colors.player1 : this.colors.player2;
    }

    updateGameStatus(message, className = '') {
        const status = document.getElementById('game-status');
        status.textContent = message;
        status.className = `game-status ${className}`;
    }
}

const game = new ConnectNGame();
