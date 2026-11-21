// 俄罗斯方块 - 复古街机风
const BaseScene = require('../../core/BaseScene');
const dataManager = require('../../core/DataManager');
const levelSystem = require('../../core/LevelSystem');

class TetrisScene extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.level = this.params.level;
    this.levelConfig = this.params.levelConfig;
    
    // 游戏区域
    this.cols = 10;
    this.rows = 20;
    this.cellSize = Math.min((this.width - 100) / this.cols, (this.height - 150) / this.rows);
    this.offsetX = (this.width - this.cols * this.cellSize) / 2 - 50;
    this.offsetY = 100;
    
    // 游戏板
    this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
    
    // 方块形状
    this.shapes = [
      { shape: [[1,1,1,1]], color: '#00F0F0' }, // I
      { shape: [[1,1],[1,1]], color: '#F0F000' }, // O
      { shape: [[0,1,0],[1,1,1]], color: '#A000F0' }, // T
      { shape: [[0,1,1],[1,1,0]], color: '#00F000' }, // S
      { shape: [[1,1,0],[0,1,1]], color: '#F00000' }, // Z
      { shape: [[1,0,0],[1,1,1]], color: '#0000F0' }, // J
      { shape: [[0,0,1],[1,1,1]], color: '#F0A000' }  // L
    ];
    
    // 当前方块
    this.currentPiece = null;
    this.nextPiece = null;
    
    // 游戏状态
    this.score = 0;
    this.lines = 0;
    this.stars = 0;
    this.gameOver = false;
    this.paused = false;
    
    // 下落计时
    this.dropInterval = Math.max(200, 800 - this.level * 50);
    this.dropTimer = 0;
    
    // 扫描线效果
    this.scanLineY = 0;
    
    this.spawnPiece();
    this.createUI();
  }
  
  spawnPiece() {
    if (!this.nextPiece) {
      this.nextPiece = this.randomPiece();
    }
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.randomPiece();
    
    this.currentPiece.x = Math.floor(this.cols / 2) - Math.floor(this.currentPiece.shape[0].length / 2);
    this.currentPiece.y = 0;
    
    // 检查游戏结束
    if (!this.isValidPosition(this.currentPiece)) {
      this.endGame();
    }
  }
  
  randomPiece() {
    const type = this.shapes[Math.floor(Math.random() * this.shapes.length)];
    return {
      shape: type.shape.map(row => [...row]),
      color: type.color,
      x: 0,
      y: 0
    };
  }
  
  createUI() {
    this.createBackButton(() => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    });
    
    this.createButton(this.width - 60, 20, 40, 40, '⏸', () => {
      this.paused = !this.paused;
    }, { bgColor: '#F39C12', fontSize: 18 });
    
    // 旋转按钮
    this.createButton(this.width - 70, this.height - 150, 50, 50, '↻', () => {
      this.rotatePiece();
    }, { bgColor: '#9B59B6', fontSize: 24 });
    
    // 左右下按钮
    this.createButton(20, this.height - 100, 60, 50, '←', () => {
      this.movePiece(-1, 0);
    }, { bgColor: '#3498DB', fontSize: 24 });
    
    this.createButton(90, this.height - 100, 60, 50, '↓', () => {
      this.movePiece(0, 1);
      this.score += 1;
    }, { bgColor: '#3498DB', fontSize: 24 });
    
    this.createButton(160, this.height - 100, 60, 50, '→', () => {
      this.movePiece(1, 0);
    }, { bgColor: '#3498DB', fontSize: 24 });
  }
  
  update(deltaTime, touchEvents) {
    if (this.gameOver || this.paused) {
      this.handleTouchEvents(touchEvents);
      return;
    }
    
    // 扫描线动画
    this.scanLineY += deltaTime * 0.1;
    if (this.scanLineY > this.rows * this.cellSize) {
      this.scanLineY = 0;
    }
    
    // 自动下落
    this.dropTimer += deltaTime;
    if (this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      if (!this.movePiece(0, 1)) {
        this.lockPiece();
        this.clearLines();
        this.spawnPiece();
      }
    }
    
    // 滑动手势控制
    this.handleSwipe(touchEvents);
    this.handleTouchEvents(touchEvents);
  }
  
  handleSwipe(touchEvents) {
    touchEvents.forEach(event => {
      if (event.type === 'start') {
        this.touchStart = { x: event.x, y: event.y, time: Date.now() };
      } else if (event.type === 'end' && this.touchStart) {
        const dx = event.x - this.touchStart.x;
        const dy = event.y - this.touchStart.y;
        const dt = Date.now() - this.touchStart.time;
        
        if (dt < 300) {
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
            this.movePiece(dx > 0 ? 1 : -1, 0);
          } else if (dy > 50) {
            // 快速下落
            while (this.movePiece(0, 1)) {
              this.score += 2;
            }
          } else if (dy < -30) {
            this.rotatePiece();
          }
        }
        this.touchStart = null;
      }
    });
  }
  
  movePiece(dx, dy) {
    const newPiece = {
      ...this.currentPiece,
      x: this.currentPiece.x + dx,
      y: this.currentPiece.y + dy
    };
    
    if (this.isValidPosition(newPiece)) {
      this.currentPiece = newPiece;
      return true;
    }
    return false;
  }
  
  rotatePiece() {
    const rotated = {
      ...this.currentPiece,
      shape: this.currentPiece.shape[0].map((_, i) =>
        this.currentPiece.shape.map(row => row[i]).reverse()
      )
    };
    
    // 尝试旋转，如果不行尝试左右移动
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      const testPiece = { ...rotated, x: rotated.x + kick };
      if (this.isValidPosition(testPiece)) {
        this.currentPiece = testPiece;
        return;
      }
    }
  }
  
  isValidPosition(piece) {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = piece.x + x;
          const newY = piece.y + y;
          
          if (newX < 0 || newX >= this.cols || newY >= this.rows) {
            return false;
          }
          if (newY >= 0 && this.board[newY][newX]) {
            return false;
          }
        }
      }
    }
    return true;
  }
  
  lockPiece() {
    for (let y = 0; y < this.currentPiece.shape.length; y++) {
      for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
        if (this.currentPiece.shape[y][x]) {
          const boardY = this.currentPiece.y + y;
          const boardX = this.currentPiece.x + x;
          if (boardY >= 0) {
            this.board[boardY][boardX] = this.currentPiece.color;
          }
        }
      }
    }
  }
  
  clearLines() {
    let linesCleared = 0;
    
    for (let y = this.rows - 1; y >= 0; y--) {
      if (this.board[y].every(cell => cell !== 0)) {
        this.board.splice(y, 1);
        this.board.unshift(Array(this.cols).fill(0));
        linesCleared++;
        y++; // 重新检查当前行
      }
    }
    
    if (linesCleared > 0) {
      this.lines += linesCleared;
      const points = [0, 100, 300, 600, 1000];
      this.score += points[linesCleared] * this.level;
      
      // 检查胜利
      if (this.lines >= this.level * 5) {
        this.winGame();
      }
    }
  }
  
  endGame() {
    this.gameOver = true;
    this.calculateStars();
    dataManager.updateGameProgress(this.gameId, this.level, this.score, this.stars);
  }
  
  winGame() {
    this.gameOver = true;
    this.calculateStars();
    dataManager.updateGameProgress(this.gameId, this.level + 1, this.score, this.stars);
  }
  
  calculateStars() {
    const ratio = this.score / this.levelConfig.targetScore;
    if (ratio >= 1.5) this.stars = 3;
    else if (ratio >= 1.0) this.stars = 2;
    else if (ratio >= 0.5) this.stars = 1;
    else this.stars = 0;
  }
  
  render(ctx) {
    // 复古深色背景
    ctx.fillStyle = '#0D0221';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // CRT扫描线效果
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let y = 0; y < this.height; y += 4) {
      ctx.fillRect(0, y, this.width, 2);
    }
    
    // 游戏区域边框（复古荧光）
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.offsetX - 3, this.offsetY - 3, 
                   this.cols * this.cellSize + 6, this.rows * this.cellSize + 6);
    
    // 绘制已固定的方块
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.board[y][x]) {
          this.drawCell(ctx, this.offsetX + x * this.cellSize, 
                       this.offsetY + y * this.cellSize, this.board[y][x]);
        }
      }
    }
    
    // 绘制当前方块
    if (this.currentPiece) {
      for (let y = 0; y < this.currentPiece.shape.length; y++) {
        for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
          if (this.currentPiece.shape[y][x]) {
            this.drawCell(ctx, 
              this.offsetX + (this.currentPiece.x + x) * this.cellSize,
              this.offsetY + (this.currentPiece.y + y) * this.cellSize,
              this.currentPiece.color);
          }
        }
      }
      
      // 绘制幽灵方块（预览落点）
      let ghostY = this.currentPiece.y;
      while (this.isValidPosition({ ...this.currentPiece, y: ghostY + 1 })) {
        ghostY++;
      }
      ctx.globalAlpha = 0.3;
      for (let y = 0; y < this.currentPiece.shape.length; y++) {
        for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
          if (this.currentPiece.shape[y][x]) {
            ctx.strokeStyle = this.currentPiece.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(
              this.offsetX + (this.currentPiece.x + x) * this.cellSize + 2,
              this.offsetY + (ghostY + y) * this.cellSize + 2,
              this.cellSize - 4, this.cellSize - 4
            );
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    
    // 扫描线
    ctx.fillStyle = 'rgba(0, 255, 65, 0.1)';
    ctx.fillRect(this.offsetX, this.offsetY + this.scanLineY, 
                 this.cols * this.cellSize, 3);
    
    // 侧边信息面板
    this.renderSidePanel(ctx);
    
    // UI
    this.renderUI(ctx);
    
    if (this.gameOver) this.renderGameOver(ctx);
    if (this.paused && !this.gameOver) this.renderPause(ctx);
  }
  
  drawCell(ctx, x, y, color) {
    // 主体
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
    
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(x + 1, y + 1, this.cellSize - 2, 4);
    ctx.fillRect(x + 1, y + 1, 4, this.cellSize - 2);
    
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + this.cellSize - 5, y + 1, 4, this.cellSize - 2);
    ctx.fillRect(x + 1, y + this.cellSize - 5, this.cellSize - 2, 4);
  }
  
  renderSidePanel(ctx) {
    const panelX = this.offsetX + this.cols * this.cellSize + 15;
    
    // 下一个方块预览
    ctx.fillStyle = '#00FF41';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT:', panelX, this.offsetY + 20);
    
    if (this.nextPiece) {
      const previewSize = this.cellSize * 0.8;
      const previewX = panelX;
      const previewY = this.offsetY + 40;
      
      for (let y = 0; y < this.nextPiece.shape.length; y++) {
        for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
          if (this.nextPiece.shape[y][x]) {
            ctx.fillStyle = this.nextPiece.color;
            ctx.fillRect(
              previewX + x * previewSize,
              previewY + y * previewSize,
              previewSize - 2, previewSize - 2
            );
          }
        }
      }
    }
    
    // 分数
    ctx.fillText('SCORE', panelX, this.offsetY + 150);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(this.score.toString(), panelX, this.offsetY + 175);
    
    // 行数
    ctx.fillStyle = '#00FF41';
    ctx.font = '14px Arial';
    ctx.fillText('LINES', panelX, this.offsetY + 210);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(this.lines.toString(), panelX, this.offsetY + 235);
    
    // 等级
    ctx.fillStyle = '#00FF41';
    ctx.font = '14px Arial';
    ctx.fillText('LEVEL', panelX, this.offsetY + 270);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(this.level.toString(), panelX, this.offsetY + 295);
  }
  
  renderUI(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.width, 70);
    
    this.buttons.forEach(btn => btn.render(ctx));
    
    ctx.fillStyle = '#00FF41';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`TETRIS - Level ${this.level}`, this.width / 2, 45);
  }
  
  renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = this.lines >= this.level * 5 ? '#00FF41' : '#FF0040';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.lines >= this.level * 5 ? 'COMPLETE!' : 'GAME OVER', 
                 this.width / 2, this.height / 2 - 60);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${this.score}  Lines: ${this.lines}`, this.width / 2, this.height / 2);
    
    let starsStr = '';
    for (let i = 0; i < 3; i++) starsStr += i < this.stars ? '⭐' : '⚫';
    ctx.font = '30px Arial';
    ctx.fillText(starsStr, this.width / 2, this.height / 2 + 50);
    
    this.createButton(this.width / 2 - 80, this.height / 2 + 100, 70, 40, 'RETRY', () => {
      this.game.switchScene(TetrisScene, this.params);
    }, { bgColor: '#00FF41', textColor: '#000' });
    
    this.createButton(this.width / 2 + 10, this.height / 2 + 100, 70, 40, 'BACK', () => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    }, { bgColor: '#FF0040' });
    
    this.buttons.slice(-2).forEach(btn => btn.render(ctx));
  }
  
  renderPause(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = '#00FF41';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', this.width / 2, this.height / 2);
  }
}

module.exports = TetrisScene;
