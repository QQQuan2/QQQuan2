// 消消乐 - 糖果缤纷风
const BaseScene = require('../../core/BaseScene');
const dataManager = require('../../core/DataManager');
const levelSystem = require('../../core/LevelSystem');

class Match3Scene extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.level = this.params.level;
    this.levelConfig = this.params.levelConfig;
    
    // 游戏区域
    this.cols = 8;
    this.rows = 8;
    this.cellSize = Math.min((this.width - 40) / this.cols, (this.height - 220) / this.rows);
    this.offsetX = (this.width - this.cols * this.cellSize) / 2;
    this.offsetY = 130;
    
    // 糖果类型
    this.candyTypes = [
      { color: '#FF6B6B', shape: 'circle', emoji: '🔴' },
      { color: '#4ECDC4', shape: 'square', emoji: '🟦' },
      { color: '#FFE66D', shape: 'diamond', emoji: '🔶' },
      { color: '#95E1D3', shape: 'triangle', emoji: '🔺' },
      { color: '#F38181', shape: 'heart', emoji: '❤️' },
      { color: '#AA96DA', shape: 'star', emoji: '⭐' }
    ];
    
    // 游戏板
    this.board = [];
    this.selectedCell = null;
    this.isAnimating = false;
    
    // 游戏状态
    this.score = 0;
    this.moves = 20 + this.level * 2;
    this.targetScore = this.levelConfig.targetScore;
    this.stars = 0;
    this.gameOver = false;
    this.won = false;
    
    // 动画
    this.animations = [];
    this.floatingTexts = [];
    
    this.initBoard();
    this.createUI();
  }
  
  initBoard() {
    do {
      this.board = [];
      for (let y = 0; y < this.rows; y++) {
        const row = [];
        for (let x = 0; x < this.cols; x++) {
          row.push(this.randomCandy());
        }
        this.board.push(row);
      }
    } while (this.findMatches().length > 0);
  }
  
  randomCandy() {
    // 根据关卡调整糖果种类
    const types = Math.min(4 + Math.floor(this.level / 2), this.candyTypes.length);
    return Math.floor(Math.random() * types);
  }
  
  createUI() {
    this.createBackButton(() => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    });
  }
  
  update(deltaTime, touchEvents) {
    if (this.gameOver) {
      this.handleTouchEvents(touchEvents);
      return;
    }
    
    if (this.isAnimating) {
      // 更新动画
      this.animations = this.animations.filter(anim => {
        anim.progress += deltaTime / anim.duration;
        if (anim.progress >= 1) {
          anim.onComplete();
          return false;
        }
        return true;
      });
      
      if (this.animations.length === 0) {
        this.isAnimating = false;
        // 检查连锁反应
        const matches = this.findMatches();
        if (matches.length > 0) {
          this.removeMatches(matches);
        }
      }
      return;
    }
    
    // 处理触摸
    touchEvents.forEach(event => {
      if (event.type === 'end') {
        this.handleTouch(event.x, event.y);
      }
    });
    
    this.handleTouchEvents(touchEvents);
    
    // 更新浮动文字
    this.floatingTexts = this.floatingTexts.filter(ft => {
      ft.y -= deltaTime * 0.05;
      ft.life -= deltaTime;
      return ft.life > 0;
    });
  }
  
  handleTouch(x, y) {
    const col = Math.floor((x - this.offsetX) / this.cellSize);
    const row = Math.floor((y - this.offsetY) / this.cellSize);
    
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    
    if (!this.selectedCell) {
      this.selectedCell = { x: col, y: row };
    } else {
      const dx = Math.abs(col - this.selectedCell.x);
      const dy = Math.abs(row - this.selectedCell.y);
      
      if (dx + dy === 1) {
        // 相邻，尝试交换
        this.trySwap(this.selectedCell.x, this.selectedCell.y, col, row);
      }
      
      this.selectedCell = null;
    }
  }
  
  trySwap(x1, y1, x2, y2) {
    // 交换
    [this.board[y1][x1], this.board[y2][x2]] = [this.board[y2][x2], this.board[y1][x1]];
    
    // 检查是否有匹配
    const matches = this.findMatches();
    if (matches.length > 0) {
      this.moves--;
      this.removeMatches(matches);
      
      if (this.moves <= 0 && this.score < this.targetScore) {
        this.endGame();
      }
    } else {
      // 没有匹配，交换回来
      [this.board[y1][x1], this.board[y2][x2]] = [this.board[y2][x2], this.board[y1][x1]];
    }
  }
  
  findMatches() {
    const matches = [];
    const visited = new Set();
    
    // 水平匹配
    for (let y = 0; y < this.rows; y++) {
      let count = 1;
      for (let x = 1; x <= this.cols; x++) {
        if (x < this.cols && this.board[y][x] === this.board[y][x - 1]) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = x - count; i < x; i++) {
              const key = `${i},${y}`;
              if (!visited.has(key)) {
                visited.add(key);
                matches.push({ x: i, y: y });
              }
            }
          }
          count = 1;
        }
      }
    }
    
    // 垂直匹配
    for (let x = 0; x < this.cols; x++) {
      let count = 1;
      for (let y = 1; y <= this.rows; y++) {
        if (y < this.rows && this.board[y][x] === this.board[y - 1][x]) {
          count++;
        } else {
          if (count >= 3) {
            for (let i = y - count; i < y; i++) {
              const key = `${x},${i}`;
              if (!visited.has(key)) {
                visited.add(key);
                matches.push({ x: x, y: i });
              }
            }
          }
          count = 1;
        }
      }
    }
    
    return matches;
  }
  
  removeMatches(matches) {
    this.isAnimating = true;
    
    // 计算得分
    const points = matches.length * 10 * this.level;
    this.score += points;
    
    // 添加浮动文字
    const centerX = matches.reduce((sum, m) => sum + m.x, 0) / matches.length;
    const centerY = matches.reduce((sum, m) => sum + m.y, 0) / matches.length;
    this.floatingTexts.push({
      x: this.offsetX + centerX * this.cellSize + this.cellSize / 2,
      y: this.offsetY + centerY * this.cellSize,
      text: `+${points}`,
      life: 1000
    });
    
    // 标记要删除的
    matches.forEach(m => {
      this.animations.push({
        type: 'remove',
        x: m.x,
        y: m.y,
        progress: 0,
        duration: 300,
        onComplete: () => {
          this.board[m.y][m.x] = -1;
        }
      });
    });
    
    // 延迟后下落
    setTimeout(() => {
      this.applyGravity();
    }, 350);
    
    // 检查胜利
    if (this.score >= this.targetScore) {
      this.winGame();
    }
  }
  
  applyGravity() {
    // 下落
    for (let x = 0; x < this.cols; x++) {
      let writePos = this.rows - 1;
      for (let y = this.rows - 1; y >= 0; y--) {
        if (this.board[y][x] !== -1) {
          if (y !== writePos) {
            this.board[writePos][x] = this.board[y][x];
            this.board[y][x] = -1;
          }
          writePos--;
        }
      }
      
      // 填充新糖果
      for (let y = writePos; y >= 0; y--) {
        this.board[y][x] = this.randomCandy();
      }
    }
    
    this.isAnimating = false;
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
    const ratio = this.score / this.targetScore;
    if (ratio >= 1.5) this.stars = 3;
    else if (ratio >= 1.0) this.stars = 2;
    else if (ratio >= 0.5) this.stars = 1;
    else this.stars = 0;
  }
  
  render(ctx) {
    // 糖果色背景
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#FFB6C1');
    gradient.addColorStop(0.5, '#FFC0CB');
    gradient.addColorStop(1, '#FF69B4');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 装饰圆点
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (let i = 0; i < 20; i++) {
      const x = (i * 37) % this.width;
      const y = (i * 53) % this.height;
      ctx.beginPath();
      ctx.arc(x, y, 10 + (i % 5) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 游戏板背景
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.roundRect(this.offsetX - 5, this.offsetY - 5, 
                  this.cols * this.cellSize + 10, this.rows * this.cellSize + 10, 15);
    ctx.fill();
    
    // 绘制糖果
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.board[y][x] !== -1) {
          const candy = this.candyTypes[this.board[y][x]];
          const cx = this.offsetX + x * this.cellSize + this.cellSize / 2;
          const cy = this.offsetY + y * this.cellSize + this.cellSize / 2;
          
          // 选中效果
          if (this.selectedCell && this.selectedCell.x === x && this.selectedCell.y === y) {
            ctx.fillStyle = 'rgba(255,255,0,0.5)';
            ctx.beginPath();
            ctx.arc(cx, cy, this.cellSize / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // 绘制糖果
          this.drawCandy(ctx, cx, cy, candy, this.cellSize * 0.35);
        }
      }
    }
    
    // 浮动文字
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    this.floatingTexts.forEach(ft => {
      ctx.globalAlpha = ft.life / 1000;
      ctx.fillStyle = '#FFD700';
      ctx.fillText(ft.text, ft.x, ft.y);
    });
    ctx.globalAlpha = 1;
    
    // UI
    this.renderUI(ctx);
    
    if (this.gameOver) this.renderGameOver(ctx);
  }
  
  drawCandy(ctx, x, y, candy, size) {
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(x + 3, y + 3, size, 0, Math.PI * 2);
    ctx.fill();
    
    // 主体
    ctx.fillStyle = candy.color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.3, y - size * 0.3, size * 0.3, size * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // 表情
    ctx.font = `${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(candy.emoji, x, y + 2);
  }
  
  renderUI(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(0, 0, this.width, 70);
    
    this.buttons.forEach(btn => btn.render(ctx));
    
    ctx.fillStyle = '#E91E63';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`🍬 Candy Crush - Level ${this.level}`, this.width / 2, 35);
    
    // 进度条
    const barWidth = 150;
    const barX = (this.width - barWidth) / 2;
    ctx.fillStyle = '#DDD';
    ctx.fillRect(barX, 50, barWidth, 12);
    ctx.fillStyle = this.score >= this.targetScore ? '#4CAF50' : '#FF9800';
    ctx.fillRect(barX, 50, barWidth * Math.min(this.score / this.targetScore, 1), 12);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, 50, barWidth, 12);
    
    // 分数
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.fillText(`${this.score}/${this.targetScore}`, this.width / 2, 80);
    
    // 剩余步数
    ctx.fillStyle = this.moves <= 5 ? '#F44336' : '#2196F3';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Moves: ${this.moves}`, this.width - 20, 45);
  }
  
  renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = this.won ? '#E91E63' : '#666';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.won ? '🍭 SWEET!' : 'Game Over', this.width / 2, this.height / 2 - 60);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2);
    
    let starsStr = '';
    for (let i = 0; i < 3; i++) starsStr += i < this.stars ? '⭐' : '⚫';
    ctx.font = '30px Arial';
    ctx.fillText(starsStr, this.width / 2, this.height / 2 + 50);
    
    this.createButton(this.width / 2 - 80, this.height / 2 + 100, 70, 40, 'Retry', () => {
      this.game.switchScene(Match3Scene, this.params);
    }, { bgColor: '#E91E63' });
    
    this.createButton(this.width / 2 + 10, this.height / 2 + 100, 70, 40, 'Back', () => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    }, { bgColor: '#999' });
    
    this.buttons.slice(-2).forEach(btn => btn.render(ctx));
  }
}

module.exports = Match3Scene;
