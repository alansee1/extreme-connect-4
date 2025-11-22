class ConnectNGame {
    constructor() {
        this.canvas = document.getElementById('game-board');
        this.ctx = this.canvas.getContext('2d');
        this.rows = 6;
        this.cols = 7;
        this.connectN = 4;
        this.gameMode = 'classic'; // 'classic' or 'capture'
        this.cellSize = 70;
        this.padding = 10;
        this.radius = 28;
        this.board = [];
        this.currentPlayer = 1;
        this.gameOver = false;
        this.animatingPiece = null;
        this.flippingPieces = []; // Array of {row, col, progress, fromPlayer, toPlayer}
        this.multiplayerMode = false;
        this.socket = null;
        this.roomCode = null;
        this.playerNumber = null;
        this.playerName = null;
        this.opponentName = null;
        this.moveCount = 0;
        this.gameStartTime = null;
        this.gameDuration = 0;
        this.connectionStats = {
            player1: { [this.connectN - 2]: 0, [this.connectN - 1]: 0, [this.connectN]: 0 },
            player2: { [this.connectN - 2]: 0, [this.connectN - 1]: 0, [this.connectN]: 0 }
        };

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
            this.startCreateRoom();
        });

        document.getElementById('join-room-btn').addEventListener('click', () => {
            this.showNamePrompt('join');
        });

        // Handle connect-N option selection
        document.querySelectorAll('.connect-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.connect-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Mode selector event listeners
        document.querySelectorAll('.mode-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.getElementById('start-game').addEventListener('click', () => {
            const selectedOption = document.querySelector('.connect-option.active');
            this.connectN = parseInt(selectedOption.dataset.connect);

            // Get selected game mode
            const selectedMode = document.querySelector('.mode-option.active');
            this.gameMode = selectedMode.dataset.mode;

            // Auto-calculate board size based on connect-N
            const boardSizes = {
                4: { rows: 6, cols: 7 },
                5: { rows: 8, cols: 9 },
                6: { rows: 9, cols: 11 },
                7: { rows: 11, cols: 12 },
                8: { rows: 12, cols: 14 },
                9: { rows: 14, cols: 16 },
                10: { rows: 15, cols: 18 }
            };

            const size = boardSizes[this.connectN];
            this.rows = size.rows;
            this.cols = size.cols;

            // Check if this is for creating a room or local game
            if (this.creatingRoom) {
                this.showNamePrompt('create');
            } else {
                this.validateAndStartGame();
            }
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

        // Modal event listeners
        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('modal-ok').addEventListener('click', () => {
            this.handleModalOk();
        });

        // Enter key support for modal
        document.getElementById('player-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleModalOk();
            }
        });

        document.getElementById('room-code-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleModalOk();
            }
        });

        // Stats modal close button
        document.getElementById('stats-close').addEventListener('click', () => {
            document.getElementById('stats-modal').style.display = 'none';
        });
    }

    showNamePrompt(action) {
        this.modalAction = action;
        const modal = document.getElementById('name-modal');
        const titleEl = document.getElementById('modal-title');
        const roomCodeContainer = document.getElementById('room-code-input-container');
        const nameInput = document.getElementById('player-name-input');
        const roomCodeInput = document.getElementById('room-code-input');

        nameInput.value = '';
        roomCodeInput.value = '';

        if (action === 'create') {
            titleEl.textContent = 'Create Room';
            roomCodeContainer.style.display = 'none';
        } else {
            titleEl.textContent = 'Join Room';
            roomCodeContainer.style.display = 'block';
        }

        modal.style.display = 'flex';
        nameInput.focus();
    }

    hideModal() {
        document.getElementById('name-modal').style.display = 'none';
    }

    handleModalOk() {
        const name = document.getElementById('player-name-input').value.trim();
        if (!name) {
            alert('Please enter your name');
            return;
        }

        this.playerName = name;

        if (this.modalAction === 'create') {
            this.hideModal();
            this.createRoom();
        } else {
            const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
            if (!roomCode) {
                alert('Please enter a room code');
                return;
            }
            this.hideModal();
            this.joinRoom(roomCode);
        }
    }

    startLocalGame() {
        this.multiplayerMode = false;
        this.creatingRoom = false;
        document.getElementById('mode-selection').style.display = 'none';
        document.getElementById('config-panel').style.display = 'flex';
        document.getElementById('game-area').style.display = 'none';
        document.getElementById('start-game').textContent = 'Start Game';
    }

    startCreateRoom() {
        this.multiplayerMode = true;
        this.creatingRoom = true;
        document.getElementById('mode-selection').style.display = 'none';
        document.getElementById('config-panel').style.display = 'flex';
        document.getElementById('game-area').style.display = 'none';
        document.getElementById('start-game').textContent = 'Next';
    }

    createRoom() {
        this.multiplayerMode = true;
        this.connectToServer();

        // Rows, cols, and connectN are already set from config panel selection
        if (!this.validateConfig()) return;

        this.socket.emit('create-room', {
            rows: this.rows,
            cols: this.cols,
            connectN: this.connectN,
            gameMode: this.gameMode,
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

        this.socket = io('https://extreme-connect-4.onrender.com');

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
            this.gameMode = config.gameMode || 'classic';

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
            this.gameMode = config.gameMode || 'classic';

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
                    this.moveCount++;

                    // Check for captures in capture mode (multiplayer)
                    const capturedPieces = this.checkAndCapturePieces(row, col, player);
                    if (capturedPieces.length > 0) {
                        this.capturePieces(capturedPieces, player);
                    }

                    if (winner) {
                        this.gameOver = true;
                        this.gameDuration = Date.now() - this.gameStartTime;
                        this.calculateConnectionStats();
                        this.winningCells = winningCells;
                        const winnerName = winner === this.playerNumber ? 'You' : this.opponentName;
                        this.updateGameStatus(`${winnerName} Win!`, 'winner');
                        setTimeout(() => this.showStatsModal(winner), 1000);
                    } else if (draw) {
                        this.gameOver = true;
                        this.gameDuration = Date.now() - this.gameStartTime;
                        this.calculateConnectionStats();
                        this.updateGameStatus("It's a Draw!", 'draw');
                        setTimeout(() => this.showStatsModal(null), 1000);
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
            this.gameMode = config.gameMode || 'classic';
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
        document.getElementById('config-panel').style.display = 'none';
        document.getElementById('game-area').style.display = 'block';
        this.initGame();
    }

    initGame() {
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
        this.currentPlayer = 1;
        this.gameOver = false;
        this.animatingPiece = null;
        this.winningCells = [];

        // Reset game stats
        this.moveCount = 0;
        this.gameStartTime = Date.now();
        this.gameDuration = 0;
        this.connectionStats = {
            player1: { [this.connectN - 2]: 0, [this.connectN - 1]: 0, [this.connectN]: 0 },
            player2: { [this.connectN - 2]: 0, [this.connectN - 1]: 0, [this.connectN]: 0 }
        };

        // Calculate optimal cell size based on board dimensions
        const maxWidth = Math.min(900, window.innerWidth - 100);
        const maxHeight = Math.min(700, window.innerHeight - 400);

        const cellSizeByWidth = (maxWidth - this.padding * 2) / this.cols;
        const cellSizeByHeight = (maxHeight - this.padding * 2) / this.rows;

        this.cellSize = Math.min(70, Math.floor(Math.min(cellSizeByWidth, cellSizeByHeight)));
        this.radius = Math.floor(this.cellSize * 0.4);

        this.canvas.width = this.cols * this.cellSize + this.padding * 2;
        this.canvas.height = this.rows * this.cellSize + this.padding * 2;

        // Update game config display
        const configDisplay = document.getElementById('game-config-display');
        const modeLabelMap = {
            'classic': 'Classic',
            'capture': 'Capture Mode',
            'extreme-capture': 'Extreme Capture'
        };
        const modeLabel = modeLabelMap[this.gameMode] || 'Classic';
        configDisplay.textContent = `${this.rows}×${this.cols} board • Connect ${this.connectN} to win • ${modeLabel}`;

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
            const placedRow = this.animatingPiece.targetRow;
            const placedCol = this.animatingPiece.col;
            const placedPlayer = this.animatingPiece.player;

            this.board[placedRow][placedCol] = placedPlayer;
            this.animatingPiece = null;
            this.moveCount++;

            // Check for captures in capture mode
            const capturedPieces = this.checkAndCapturePieces(placedRow, placedCol, placedPlayer);
            if (capturedPieces.length > 0) {
                this.capturePieces(capturedPieces, placedPlayer);
            }

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
            this.gameDuration = Date.now() - this.gameStartTime;
            this.calculateConnectionStats();
            this.updateGameStatus(`Player ${winner} Wins!`, 'winner');
            setTimeout(() => this.showStatsModal(winner), 1000);
            return;
        }

        if (this.isBoardFull()) {
            this.gameOver = true;
            this.gameDuration = Date.now() - this.gameStartTime;
            this.calculateConnectionStats();
            this.updateGameStatus("It's a Draw!", 'draw');
            setTimeout(() => this.showStatsModal(null), 1000);
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

    countPieces() {
        let player1Count = 0;
        let player2Count = 0;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === 1) player1Count++;
                else if (this.board[row][col] === 2) player2Count++;
            }
        }

        return { player1: player1Count, player2: player2Count };
    }

    calculateConnectionStats() {
        // Reset stats
        this.connectionStats = {
            player1: { [this.connectN - 2]: 0, [this.connectN - 1]: 0, [this.connectN]: 0 },
            player2: { [this.connectN - 2]: 0, [this.connectN - 1]: 0, [this.connectN]: 0 }
        };

        const directions = [
            { dr: 0, dc: 1 },   // Horizontal
            { dr: 1, dc: 0 },   // Vertical
            { dr: 1, dc: 1 },   // Diagonal down-right
            { dr: 1, dc: -1 }   // Diagonal down-left
        ];

        // Track which cells we've already counted in a connection to avoid duplicates
        const counted = new Set();

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const player = this.board[row][col];
                if (player === 0) continue;

                for (const { dr, dc } of directions) {
                    // Count consecutive pieces in this direction
                    let count = 1;
                    let r = row + dr;
                    let c = col + dc;

                    while (r >= 0 && r < this.rows && c >= 0 && c < this.cols &&
                           this.board[r][c] === player) {
                        count++;
                        r += dr;
                        c += dc;
                    }

                    // Only count if this is the "start" of the connection (to avoid counting same connection multiple times)
                    // Check if there's no same-player piece in the opposite direction
                    const prevR = row - dr;
                    const prevC = col - dc;
                    const isStart = prevR < 0 || prevR >= this.rows || prevC < 0 || prevC >= this.cols ||
                                   this.board[prevR][prevC] !== player;

                    if (isStart && count >= this.connectN - 2) {
                        const playerKey = `player${player}`;

                        // Count this exact connection length (not all lengths up to it)
                        if (count === this.connectN - 2) {
                            this.connectionStats[playerKey][this.connectN - 2]++;
                        } else if (count === this.connectN - 1) {
                            this.connectionStats[playerKey][this.connectN - 1]++;
                        } else if (count >= this.connectN) {
                            this.connectionStats[playerKey][this.connectN]++;
                        }
                    }
                }
            }
        }
    }

    isBoardFull() {
        return this.board.every(row => row.every(cell => cell !== 0));
    }

    checkAndCapturePieces(lastRow, lastCol, currentPlayer) {
        if (this.gameMode === 'extreme-capture') {
            return this.checkAndCaptureGroups(lastRow, lastCol, currentPlayer);
        }
        if (this.gameMode !== 'capture') return [];

        const capturedPieces = [];
        const opponent = currentPlayer === 1 ? 2 : 1;

        // Check all 8 adjacent positions for opponent pieces
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],  // top-left, top, top-right
            [0, -1],           [0, 1],    // left, right
            [1, -1],  [1, 0],  [1, 1]     // bottom-left, bottom, bottom-right
        ];

        // For each cell on the board, check if it's an opponent piece that's now surrounded
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === opponent) {
                    // Check if this opponent piece is completely surrounded
                    let isSurrounded = true;

                    for (const [dr, dc] of directions) {
                        const newRow = row + dr;
                        const newCol = col + dc;

                        // If position is out of bounds, treat as surrounded (edge rule)
                        if (newRow < 0 || newRow >= this.rows || newCol < 0 || newCol >= this.cols) {
                            continue; // Out of bounds = surrounded on that side
                        }

                        // If adjacent cell is not the current player's piece, not surrounded
                        if (this.board[newRow][newCol] !== currentPlayer) {
                            isSurrounded = false;
                            break;
                        }
                    }

                    if (isSurrounded) {
                        capturedPieces.push({ row, col });
                    }
                }
            }
        }

        return capturedPieces;
    }

    capturePieces(pieces, newPlayer) {
        const oldPlayer = newPlayer === 1 ? 2 : 1;

        // Start flip animation for each captured piece
        pieces.forEach(({ row, col }) => {
            this.flippingPieces.push({
                row,
                col,
                progress: 0,
                fromPlayer: oldPlayer,
                toPlayer: newPlayer
            });
        });

        // Animate the flips
        this.animateFlips();
    }

    checkAndCaptureGroups(lastRow, lastCol, currentPlayer) {
        const capturedPieces = [];
        const opponent = currentPlayer === 1 ? 2 : 1;

        // Check all opponent groups on the board for capture
        const visited = new Set();

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const key = `${row},${col}`;

                if (this.board[row][col] === opponent && !visited.has(key)) {
                    // Found an opponent piece, check if its group is captured
                    const group = this.findGroup(row, col, opponent);
                    group.forEach(pos => visited.add(`${pos.row},${pos.col}`));

                    // Check if this group has any liberties
                    const liberties = this.countLiberties(group);

                    if (liberties === 0) {
                        // Group is captured!
                        capturedPieces.push(...group);
                    }
                }
            }
        }

        return capturedPieces;
    }

    findGroup(startRow, startCol, player) {
        // Flood-fill to find all connected pieces of the same color
        const group = [];
        const visited = new Set();
        const queue = [{ row: startRow, col: startCol }];

        while (queue.length > 0) {
            const { row, col } = queue.shift();
            const key = `${row},${col}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (this.board[row][col] !== player) continue;

            group.push({ row, col });

            // Check 4 adjacent cells (not diagonals for Go-style)
            const directions = [
                [-1, 0], [1, 0], [0, -1], [0, 1]
            ];

            for (const [dr, dc] of directions) {
                const newRow = row + dr;
                const newCol = col + dc;

                if (newRow >= 0 && newRow < this.rows &&
                    newCol >= 0 && newCol < this.cols &&
                    !visited.has(`${newRow},${newCol}`)) {
                    queue.push({ row: newRow, col: newCol });
                }
            }
        }

        return group;
    }

    countLiberties(group) {
        // Count unique empty spaces adjacent to the group
        const liberties = new Set();

        for (const { row, col } of group) {
            // Check 4 adjacent cells
            const directions = [
                [-1, 0], [1, 0], [0, -1], [0, 1]
            ];

            for (const [dr, dc] of directions) {
                const newRow = row + dr;
                const newCol = col + dc;

                if (newRow >= 0 && newRow < this.rows &&
                    newCol >= 0 && newCol < this.cols &&
                    this.board[newRow][newCol] === 0) {
                    liberties.add(`${newRow},${newCol}`);
                }
            }
        }

        return liberties.size;
    }

    animateFlips() {
        if (this.flippingPieces.length === 0) return;

        let allComplete = true;

        this.flippingPieces.forEach(piece => {
            piece.progress += 0.15; // Animation speed
            if (piece.progress < 1) {
                allComplete = false;
            } else {
                // Flip is complete, update the board
                this.board[piece.row][piece.col] = piece.toPlayer;
            }
        });

        this.draw();

        if (!allComplete) {
            requestAnimationFrame(() => this.animateFlips());
        } else {
            // All flips complete, clear the array
            this.flippingPieces = [];
            this.draw();
        }
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

                // Check if this piece is currently flipping
                const flippingPiece = this.flippingPieces.find(
                    p => p.row === row && p.col === col
                );

                let currentRadius = this.radius;
                let fillColor;

                if (flippingPiece) {
                    // Create a shrink/grow flip animation
                    const progress = flippingPiece.progress;
                    if (progress < 0.5) {
                        // Shrinking phase (first half)
                        currentRadius = this.radius * (1 - progress * 2);
                        fillColor = flippingPiece.fromPlayer === 1 ? this.colors.player1 : this.colors.player2;
                    } else {
                        // Growing phase (second half)
                        currentRadius = this.radius * ((progress - 0.5) * 2);
                        fillColor = flippingPiece.toPlayer === 1 ? this.colors.player1 : this.colors.player2;
                    }
                } else {
                    // Normal rendering
                    if (this.board[row][col] === 0) {
                        fillColor = this.colors.empty;
                    } else if (isWinningCell) {
                        fillColor = this.colors.winning;
                    } else {
                        fillColor = this.board[row][col] === 1 ? this.colors.player1 : this.colors.player2;
                    }
                }

                this.ctx.fillStyle = fillColor;
                this.ctx.beginPath();
                this.ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
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

    showStatsModal(winner) {
        const modal = document.getElementById('stats-modal');
        const title = document.getElementById('stats-title');

        // Set title based on outcome
        if (winner) {
            if (this.multiplayerMode) {
                const winnerName = winner === this.playerNumber ? 'You' : this.opponentName;
                title.textContent = `${winnerName} Win!`;
            } else {
                title.textContent = `Player ${winner} Wins!`;
            }
        } else {
            title.textContent = "It's a Draw!";
        }

        // Set total moves
        document.getElementById('total-moves').textContent = this.moveCount;

        // Format and set game duration
        const durationSeconds = Math.floor(this.gameDuration / 1000);
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        document.getElementById('game-duration').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Set player names
        const player1Name = this.multiplayerMode ?
            (this.playerNumber === 1 ? this.playerName : this.opponentName) :
            'Player 1';
        const player2Name = this.multiplayerMode ?
            (this.playerNumber === 2 ? this.playerName : this.opponentName) :
            'Player 2';

        document.getElementById('player1-name').textContent = player1Name;
        document.getElementById('player2-name').textContent = player2Name;

        // Show/hide piece counts for capture mode
        const player1PieceCount = document.getElementById('player1-piece-count');
        const player2PieceCount = document.getElementById('player2-piece-count');

        if (this.gameMode === 'capture') {
            const pieceCounts = this.countPieces();
            player1PieceCount.innerHTML = `Pieces on Board: <span class="count">${pieceCounts.player1}</span>`;
            player2PieceCount.innerHTML = `Pieces on Board: <span class="count">${pieceCounts.player2}</span>`;
            player1PieceCount.style.display = 'block';
            player2PieceCount.style.display = 'block';
        } else {
            player1PieceCount.style.display = 'none';
            player2PieceCount.style.display = 'none';
        }

        // Populate connection stats
        this.populateConnectionStats('player1-connections', this.connectionStats.player1);
        this.populateConnectionStats('player2-connections', this.connectionStats.player2);

        // Show modal
        modal.style.display = 'flex';
    }

    populateConnectionStats(elementId, stats) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';

        // Create rows for each connection length (N-2, N-1, N)
        const lengths = [this.connectN - 2, this.connectN - 1, this.connectN];

        lengths.forEach(length => {
            const row = document.createElement('div');
            row.className = 'connection-stat-row';

            const label = document.createElement('span');
            label.className = 'connection-label';
            label.textContent = `Connect-${length}`;

            const count = document.createElement('span');
            count.className = 'connection-count';
            count.textContent = stats[length] || 0;

            row.appendChild(label);
            row.appendChild(count);
            container.appendChild(row);
        });
    }
}

const game = new ConnectNGame();
