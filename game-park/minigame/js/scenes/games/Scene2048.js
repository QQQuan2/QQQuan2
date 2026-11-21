// 2048 - 简洁扁平风
const BaseScene = require('../../core/BaseScene');
const dataManager = require('../../core/DataManager');
const levelSystem = require('../../core/LevelSystem');

class Scene2048 extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.level = this.params.level;
    this.levelConfig = this.params.levelConfig;
    
    // 根据关卡调整目标
    this.targetNumber = Math.min(2048, 128 * Math.pow(2, Math.floor(this.level / 2)));
    this.gridSize = this.level > 3 ? 5 : 4;
    
    // 游戏区域
    this.cellSize = 65;
    this.gap = 10;
    this.boardWidth = this.gridSize * this.cellSize + (this.gridSize + 1) * this.gap;
    this.offsetX = (this.width - this.boardWidth) / 2;
    this.offsetY = 140;
    
    // 游戏板
    this.board = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(0));
    
    // 游戏状态
    this.score = 0;
    this.stars = 0;
    this.gameOver = false;
    this.won = false;
    
    // 动画
    this.animations = [];
    this.newTiles = [];
    
    this.initGame();
    this.createUI();
  }
  
  initGame() {
    this.addRandomTile();
    this.addRandomTile();
  }
  
  addRandomTile() {
    const emptyCells = [];
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.board[y][x] === 0) {
          emptyCells.push({ x, y });
        }
      }
    }
    
    if (emptyCells.length > 0) {
      const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      this.board[cell.y][cell.x] = Math.random() < 0.9 ? 2 : 4;
      this.newTiles.push({ x: cell.x, y: cell.y, time: Date.now() });
    }
  }
  
  createUI() {
    this.createBackButton(() => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    });
    
    // 新游戏按钮
    this.createButton(this.width - 100, 20, 80, 36, 'New', () => {
      this.game.switchScene(Scene2048, this.params);
    }, { bgColor: '#8F7A66', fontSize: 14 });
  }
  
  update(deltaTime, touchEvents) {
    if (this.gameOver) {
      this.handleTouchEvents(touchEvents);
      return;
    }
    
    // 处理滑动手势
    this.handleSwipe(touchEvents);
    this.handleTouchEvents(touchEvents);
    
    // 清理新方块标记
    this.newTiles = this.newTiles.filter(t => Date.now() - t.time < 300);
  }
  
  handleSwipe(touchEvents) {
    touchEvents.forEach(event => {
      if (event.type === 'start') {
        this.touchStart = { x: event.x, y: event.y };
      } else if (event.type === 'end' && this.touchStart) {
        const dx = event.x - this.touchStart.x;
        const dy = event.y - this.touchStart.y;
        const minSwipe = 50;
        
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
          this.move(dx > 0 ? 'right' : 'left');
        } else if (Math.abs(dy) > minSwipe) {
          this.move(dy > 0 ? 'down' : 'up');
        }
        
        this.touchStart = null;
      }
    });
  }
  
  move(direction) {
    let moved = false;
    const newBoard = this.board.map(row => [...row]);
    
    const moveLeft = (row) => {
      // 移除0
      let filtered = row.filter(x => x !== 0);
      // 合并
      for (let i = 0; i < filtered.length - 1; i++) {
        if (filtered[i] === filtered[i + 1]) {
          filtered[i] *= 2;
          this.score += filtered[i];
          filtered[i + 1] = 0;
        }
      }
      // 再次移除0
      filtered = filtered.filter(x => x !== 0);
      // 补0
      while (filtered.length < this.gridSize) {
        filtered.push(0);
      }
      return filtered;
    };
    
    if (direction === 'left') {
      for (let y = 0; y < this.gridSize; y++) {
        const newRow = moveLeft(newBoard[y]);
        if (newRow.toString() !== newBoard[y].toString()) moved = true;
        newBoard[y] = newRow;
      }
    } else if (direction === 'right') {
      for (let y = 0; y < this.gridSize; y++) {
        const newRow = moveLeft(newBoard[y].reverse()).reverse();
        if (newRow.toString() !== newBoard[y].toString()) moved = true;
        newBoard[y] = newRow;
      }
    } else if (direction === 'up') {
      for (let x = 0; x < this.gridSize; x++) {
        const col = [];
        for (let y = 0; y < this.gridSize; y++) col.push(newBoard[y][x]);
        const newCol = moveLeft(col);
        for (let y = 0; y < this.gridSize; y++) {
          if (newBoard[y][x] !== newCol[y]) moved = true;
          newBoard[y][x] = newCol[y];
        }
      }
    } else if (direction === 'down') {
      for (let x = 0; x < this.gridSize; x++) {
        const col = [];
        for (let y = 0; y < this.gridSize; y++) col.push(newBoard[y][x]);
        const newCol = moveLeft(col.reverse()).reverse();
        for (let y = 0; y < this.gridSize; y++) {
          if (newBoard[y][x] !== newCol[y]) moved = true;
          newBoard[y][x] = newCol[y];
        }
      }
    }
    
    if (moved) {
      this.board = newBoard;
      this.addRandomTile();
      
      // 检查胜利
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if (this.board[y][x] >= this.targetNumber) {
            this.winGame();
            return;
          }
        }
      }
      
      // 检查游戏结束
      if (this.isGameOver()) {
        this.endGame();
      }
    }
  }
  
  isGameOver() {
    // 检查是否有空位
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.board[y][x] === 0) return false;
      }
    }
    
    // 检查是否可以合并
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const val = this.board[y][x];
        if ((x < this.gridSize - 1 && this.board[y][x + 1] === val) ||
            (y < this.gridSize - 1 && this.board[y + 1][x] === val)) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  endGame() {
    this.gameOver = true;
    this.calculateStars();
    dataManager.updateGameProgress(this.gameId, this.level, this.score, this.stars);
  }
  
  winGame() {
    this.won = true;
    this.gameOver = true;
    this.calculateStars();
    dataManager.updateGameProgress(this.gameId, this.level + 1, this.score, this.stars);
  }
  
  calculateStars() {
    const maxTile = Math.max(...this.board.flat());
    const ratio = maxTile / this.targetNumber;
    if (ratio >= 2) this.stars = 3;
    else if (ratio >= 1) this.stars = 2;
    else if (ratio >= 0.5) this.stars = 1;
    else this.stars = 0;
  }
  
  getTileColor(value) {
    const colors = {
      0: '#CDC1B4',
      2: '#EEE4DA',
      4: '#EDE0C8',
      8: '#F2B179',
      16: '#F59563',
      32: '#F67C5F',
      64: '#F65E3B',
      128: '#EDCF72',
      256: '#EDCC61',
      512: '#EDC850',
      1024: '#EDC53F',
      2048: '#EDC22E'
    };
    return colors[value] || '#3C3A32';
  }
  
  getTextColor(value) {
    return value <= 4 ? '#776E65' : '#F9F6F2';
  }
  
  render(ctx) {
    // 简洁背景
    ctx.fillStyle = '#FAF8EF';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 标题
    ctx.fillStyle = '#776E65';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('2048', 20, 55);
    
    // 分数面板
    ctx.fillStyle = '#BBADA0';
    ctx.beginPath();
    ctx.roundRect(this.width - 160, 15, 70, 50, 5);
    ctx.fill();
    ctx.fillStyle = '#EEE4DA';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCORE', this.width - 125, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(this.score.toString(), this.width - 125, 52);
    
    // 目标
    ctx.fillStyle = '#BBADA0';
    ctx.beginPath();
    ctx.roundRect(this.width - 85, 15, 70, 50, 5);
    ctx.fill();
    ctx.fillStyle = '#EEE4DA';
    ctx.font = '10px Arial';
    ctx.fillText('TARGET', this.width - 50, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(this.targetNumber.toString(), this.width - 50, 52);
    
    // 游戏板背景
    ctx.fillStyle = '#BBADA0';
    ctx.beginPath();
    ctx.roundRect(this.offsetX, this.offsetY, this.boardWidth, this.boardWidth, 10);
    ctx.fill();
    
    // 绘制格子
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const value = this.board[y][x];
        const cx = this.offsetX + this.gap + x * (this.cellSize + this.gap);
        const cy = this.offsetY + this.gap + y * (this.cellSize + this.gap);
        
        // 新方块动画
        const isNew = this.newTiles.some(t => t.x === x && t.y === y);
        const scale = isNew ? 0.9 + 0.1 * Math.sin(Date.now() * 0.02) : 1;
        
        // 背景
        ctx.fillStyle = this.getTileColor(value);
        const size = this.cellSize * scale;
        const offset = (this.cellSize - size) / 2;
        ctx.beginPath();
        ctx.roundRect(cx + offset, cy + offset, size, size, 5);
        ctx.fill();
        
        // 数字
        if (value > 0) {
          ctx.fillStyle = this.getTextColor(value);
          ctx.font = `bold ${value >= 1000 ? 20 : value >= 100 ? 24 : 28}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(value.toString(), cx + this.cellSize / 2, cy + this.cellSize / 2);
        }
      }
    }
    
    // 按钮
    this.buttons.forEach(btn => btn.render(ctx));
    
    // 提示文字
    ctx.fillStyle = '#8F7A66';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('滑动屏幕移动方块', this.width / 2, this.height - 40);
    
    if (this.gameOver) this.renderGameOver(ctx);
  }
  
  renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(238, 228, 218, 0.8)';
    ctx.fillRect(this.offsetX, this.offsetY, this.boardWidth, this.boardWidth);
    
    ctx.fillStyle = '#776E65';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.won ? 'You Win!' : 'Game Over!', 
                 this.offsetX + this.boardWidth / 2, this.offsetY + this.boardWidth / 2 - 40);
    
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${this.score}`, 
                 this.offsetX + this.boardWidth / 2, this.offsetY + this.boardWidth / 2 + 10);
    
    let starsStr = '';
    for (let i = 0; i < 3; i++) starsStr += i < this.stars ? '⭐' : '⚫';
    ctx.font = '24px Arial';
    ctx.fillText(starsStr, this.offsetX + this.boardWidth / 2, this.offsetY + this.boardWidth / 2 + 50);
    
    this.createButton(this.width / 2 - 80, this.offsetY + this.boardWidth / 2 + 80, 70, 35, 'Try Again', () => {
      this.game.switchScene(Scene2048, this.params);
    }, { bgColor: '#8F7A66', fontSize: 12 });
    
    this.createButton(this.width / 2 + 10, this.offsetY + this.boardWidth / 2 + 80, 70, 35, 'Back', () => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    }, { bgColor: '#BBADA0', fontSize: 12 });
    
    this.buttons.slice(-2).forEach(btn => btn.render(ctx));
  }
}

module.exports = Scene2048;
