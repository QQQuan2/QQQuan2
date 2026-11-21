// 扫雷 - 极简几何风
const BaseScene = require('../../core/BaseScene');
const dataManager = require('../../core/DataManager');

class MinesweeperScene extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.level = this.params.level;
    this.levelConfig = this.params.levelConfig;

    // 棋盘：9 列，行数随关卡增加
    this.cols = 9;
    this.rows = Math.min(9 + Math.floor(this.level / 2), 12);
    const totalCells = this.cols * this.rows;
    this.mineCount = Math.max(5, Math.round(totalCells * (0.10 + this.level * 0.008)));

    // 格子尺寸
    this.cellSize = 36;
    this.gap = 3;
    this.offsetX = (this.width - (this.cols * this.cellSize + (this.cols - 1) * this.gap)) / 2;
    this.offsetY = 150;

    // 游戏状态
    this.cells = [];        // { mine, revealed, flagged, adjacent }
    this.firstClick = true;
    this.flagMode = false;
    this.revealedCount = 0;
    this.flaggedCount = 0;
    this.elapsed = 0;
    this.score = 0;
    this.stars = 0;
    this.gameOver = false;
    this.won = false;
    this.overlayBuilt = false;

    this.initBoard();
    this.createUI();
  }

  initBoard() {
    for (let i = 0; i < this.cols * this.rows; i++) {
      this.cells.push({ mine: false, revealed: false, flagged: false, adjacent: 0 });
    }
  }

  // 首次点击后再布雷，保证第一步必安全
  placeMines(safeIndex) {
    const total = this.cells.length;
    const banned = new Set([safeIndex, ...this.neighbors(safeIndex)]);
    let placed = 0;
    while (placed < this.mineCount) {
      const idx = Math.floor(Math.random() * total);
      if (this.cells[idx].mine || banned.has(idx)) continue;
      this.cells[idx].mine = true;
      placed++;
    }
    for (let i = 0; i < total; i++) {
      this.cells[i].adjacent = this.neighbors(i).filter(n => this.cells[n].mine).length;
    }
  }

  neighbors(index) {
    const r = Math.floor(index / this.cols);
    const c = index % this.cols;
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          result.push(nr * this.cols + nc);
        }
      }
    }
    return result;
  }

  createUI() {
    this.createBackButton(() => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    });
    // 旗子模式切换
    const flagBtn = this.createButton(this.width - 100, 20, 80, 36, '🚩 旗', () => {
      this.flagMode = !this.flagMode;
      flagBtn.bgColor = this.flagMode ? '#E67E22' : '#95A5A6';
    }, { bgColor: '#95A5A6', fontSize: 14 });
  }

  update(deltaTime, touchEvents) {
    if (!this.gameOver) {
      this.elapsed += deltaTime / 1000;
    }

    touchEvents.forEach(event => {
      if (event.type === 'end' && !this.gameOver) {
        this.handleTap(event.x, event.y);
      }
    });

    this.handleTouchEvents(touchEvents);
  }

  cellAt(x, y) {
    if (x < this.offsetX || y < this.offsetY) return -1;
    const c = Math.floor((x - this.offsetX) / (this.cellSize + this.gap));
    const r = Math.floor((y - this.offsetY) / (this.cellSize + this.gap));
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return -1;
    const lx = x - this.offsetX - c * (this.cellSize + this.gap);
    const ly = y - this.offsetY - r * (this.cellSize + this.gap);
    if (lx > this.cellSize || ly > this.cellSize) return -1;
    return r * this.cols + c;
  }

  handleTap(x, y) {
    // 旗子按钮的状态由 createButton 管理，这里只处理棋盘
    if (y < this.offsetY) return;
    const idx = this.cellAt(x, y);
    if (idx < 0) return;

    // 顶部按钮区域内的点击交给 handleTouchEvents，避开棋盘逻辑误判
    if (y >= 20 && y <= 56 && x >= this.width - 100) return;

    const cell = this.cells[idx];
    if (cell.revealed) return;

    if (this.flagMode) {
      this.toggleFlag(idx);
      return;
    }

    if (cell.flagged) return;

    if (this.firstClick) {
      this.placeMines(idx);
      this.firstClick = false;
    }

    if (cell.mine) {
      this.loseGame();
      return;
    }
    this.reveal(idx);
    this.checkWin();
  }

  toggleFlag(idx) {
    const cell = this.cells[idx];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    this.flaggedCount += cell.flagged ? 1 : -1;
    // 同步旗子按钮颜色
    const flagBtn = this.buttons[this.buttons.length - 1];
    if (flagBtn) flagBtn.bgColor = this.flagMode ? '#E67E22' : '#95A5A6';
  }

  reveal(index) {
    const stack = [index];
    while (stack.length > 0) {
      const idx = stack.pop();
      const cell = this.cells[idx];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      this.revealedCount++;
      if (cell.adjacent === 0 && !cell.mine) {
        this.neighbors(idx).forEach(n => {
          if (!this.cells[n].revealed) stack.push(n);
        });
      }
    }
  }

  checkWin() {
    const total = this.cells.length;
    if (this.revealedCount === total - this.mineCount) {
      this.won = true;
      this.gameOver = true;
      // 星星：按用时评级
      const par = this.cells.length * 1.1;
      if (this.elapsed <= par) this.stars = 3;
      else if (this.elapsed <= par * 2.2) this.stars = 2;
      else this.stars = 1;
      this.score = this.level * 500 + Math.max(0, Math.round(1000 - this.elapsed));
      dataManager.updateGameProgress(this.gameId, this.level + 1, this.score, this.stars);
    }
  }

  loseGame() {
    this.won = false;
    this.gameOver = true;
    // 揭示所有雷
    this.cells.forEach(cell => {
      if (cell.mine) cell.revealed = true;
    });
  }

  render(ctx) {
    // 浅灰底 + 几何色块
    ctx.fillStyle = '#ECF0F1';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = 'rgba(96, 125, 139, 0.08)';
    for (let i = 0; i < 6; i++) {
      const x = (i * 131 + 30) % this.width;
      const y = (i * 89 + 60) % this.height;
      ctx.fillRect(x, y, 60, 60);
    }

    // 顶部信息栏
    ctx.fillStyle = 'rgba(96, 125, 139, 0.15)';
    ctx.fillRect(0, 0, this.width, 70);
    this.buttons.forEach(btn => btn.render(ctx));

    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('扫雷', this.width / 2, 35);

    ctx.fillStyle = '#607D8B';
    ctx.font = '14px Arial';
    ctx.fillText(`Level ${this.level} | 💣 ${this.mineCount - this.flaggedCount} | ⏱ ${Math.floor(this.elapsed)}s`, this.width / 2, 58);

    // 棋盘
    this.cells.forEach((cell, idx) => this.drawCell(ctx, idx, cell));

    if (this.gameOver) this.renderOverlay(ctx);
  }

  drawCell(ctx, idx, cell) {
    const c = idx % this.cols;
    const r = Math.floor(idx / this.cols);
    const x = this.offsetX + c * (this.cellSize + this.gap);
    const y = this.offsetY + r * (this.cellSize + this.gap);

    if (cell.revealed) {
      if (cell.mine) {
        ctx.fillStyle = '#E74C3C';
      } else {
        ctx.fillStyle = '#FFFFFF';
      }
    } else {
      ctx.fillStyle = '#95A5A6';
    }
    ctx.fillRect(x, y, this.cellSize, this.cellSize);

    ctx.strokeStyle = cell.revealed ? '#BDC3C7' : '#7F8C8D';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, this.cellSize, this.cellSize);

    if (cell.revealed) {
      if (cell.mine) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', x + this.cellSize / 2, y + this.cellSize / 2 + 1);
      } else if (cell.adjacent > 0) {
        const colors = ['', '#2980B9', '#27AE60', '#E67E22', '#8E44AD', '#C0392B', '#16A085', '#2C3E50', '#7F8C8D'];
        ctx.fillStyle = colors[cell.adjacent];
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(cell.adjacent), x + this.cellSize / 2, y + this.cellSize / 2 + 1);
      }
    } else if (cell.flagged) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚩', x + this.cellSize / 2, y + this.cellSize / 2 + 1);
    }
  }

  renderOverlay(ctx) {
    if (!this.overlayBuilt) {
      this.overlayBuilt = true;
      if (this.won) {
        this.createButton(this.width / 2 - 80, this.height / 2 + 60, 70, 35, '下一关', () => {
          const GameSelectScene = require('../GameSelectScene');
          this.game.switchScene(GameSelectScene, { gameId: this.gameId });
        }, { bgColor: '#27AE60' });
      } else {
        this.createButton(this.width / 2 - 80, this.height / 2 + 60, 70, 35, '重新挑战', () => {
          const MinesweeperScene = require('./MinesweeperScene');
          this.game.switchScene(MinesweeperScene, {
            gameId: this.gameId, level: this.level, levelConfig: this.levelConfig
          });
        }, { bgColor: '#E74C3C' });
      }
      this.createButton(this.width / 2 + 10, this.height / 2 + 60, 70, 35, '返回', () => {
        const GameSelectScene = require('../GameSelectScene');
        this.game.switchScene(GameSelectScene, { gameId: this.gameId });
      }, { bgColor: '#95A5A6' });
    }

    ctx.fillStyle = this.won ? 'rgba(236, 240, 241, 0.95)' : 'rgba(44, 62, 80, 0.92)';
    ctx.fillRect(20, this.height / 2 - 100, this.width - 40, 200);

    ctx.strokeStyle = this.won ? '#27AE60' : '#E74C3C';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, this.height / 2 - 100, this.width - 40, 200);

    ctx.textAlign = 'center';
    if (this.won) {
      ctx.fillStyle = '#2C3E50';
      ctx.font = 'bold 32px Arial';
      ctx.fillText('✅ 排雷成功！', this.width / 2, this.height / 2 - 50);
      ctx.font = '18px Arial';
      ctx.fillText(`用时 ${Math.floor(this.elapsed)}s  得分: ${this.score}`, this.width / 2, this.height / 2 - 10);
      let starsStr = '';
      for (let i = 0; i < 3; i++) starsStr += i < this.stars ? '⭐' : '⚫';
      ctx.font = '28px Arial';
      ctx.fillText(starsStr, this.width / 2, this.height / 2 + 30);
    } else {
      ctx.fillStyle = '#ECF0F1';
      ctx.font = 'bold 32px Arial';
      ctx.fillText('💥 踩到雷了', this.width / 2, this.height / 2 - 50);
      ctx.font = '18px Arial';
      ctx.fillText(`已揭示 ${this.revealedCount} 格，再接再厉`, this.width / 2, this.height / 2 - 10);
    }

    // 只渲染最后创建的两个按钮
    this.buttons.slice(-2).forEach(btn => btn.render(ctx));
  }
}

module.exports = MinesweeperScene;
