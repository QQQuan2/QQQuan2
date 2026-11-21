// 记忆翻牌 - 中国水墨风
const BaseScene = require('../../core/BaseScene');
const dataManager = require('../../core/DataManager');
const levelSystem = require('../../core/LevelSystem');

class MemoryScene extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.level = this.params.level;
    this.levelConfig = this.params.levelConfig;
    
    // 根据关卡调整
    this.pairs = Math.min(4 + this.level, 12);
    this.cols = this.pairs <= 6 ? 3 : 4;
    this.rows = Math.ceil(this.pairs * 2 / this.cols);
    
    // 游戏区域
    this.cardWidth = 60;
    this.cardHeight = 80;
    this.gap = 15;
    this.boardWidth = this.cols * this.cardWidth + (this.cols - 1) * this.gap;
    this.boardHeight = this.rows * this.cardHeight + (this.rows - 1) * this.gap;
    this.offsetX = (this.width - this.boardWidth) / 2;
    this.offsetY = 140;
    
    // 卡牌图案（中国风元素）
    this.symbols = ['🐉', '🏮', '🎋', '🌸', '⛩️', '🎎', '🐼', '🥮', '🏯', '🎐', '🍵', '🀄'];
    
    // 游戏状态
    this.cards = [];
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.attempts = 0;
    this.score = 0;
    this.stars = 0;
    this.gameOver = false;
    this.canFlip = true;
    
    // 水墨效果
    this.inkDrops = [];
    
    this.initCards();
    this.createUI();
  }
  
  initCards() {
    // 创建配对
    const selectedSymbols = this.symbols.slice(0, this.pairs);
    const cardSymbols = [...selectedSymbols, ...selectedSymbols];
    
    // 洗牌
    for (let i = cardSymbols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardSymbols[i], cardSymbols[j]] = [cardSymbols[j], cardSymbols[i]];
    }
    
    // 创建卡牌
    let index = 0;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (index < cardSymbols.length) {
          this.cards.push({
            x: this.offsetX + x * (this.cardWidth + this.gap),
            y: this.offsetY + y * (this.cardHeight + this.gap),
            symbol: cardSymbols[index],
            isFlipped: false,
            isMatched: false,
            flipProgress: 0
          });
          index++;
        }
      }
    }
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
    
    // 更新卡牌翻转动画
    this.cards.forEach(card => {
      if (card.isFlipped && card.flipProgress < 1) {
        card.flipProgress += deltaTime / 200;
        if (card.flipProgress > 1) card.flipProgress = 1;
      } else if (!card.isFlipped && card.flipProgress > 0) {
        card.flipProgress -= deltaTime / 200;
        if (card.flipProgress < 0) card.flipProgress = 0;
      }
    });
    
    // 处理触摸
    touchEvents.forEach(event => {
      if (event.type === 'end' && this.canFlip) {
        this.handleTouch(event.x, event.y);
      }
    });
    
    this.handleTouchEvents(touchEvents);
    
    // 更新水墨效果
    this.inkDrops = this.inkDrops.filter(drop => {
      drop.radius += deltaTime * 0.05;
      drop.alpha -= deltaTime * 0.0005;
      return drop.alpha > 0;
    });
  }
  
  handleTouch(x, y) {
    for (const card of this.cards) {
      if (!card.isMatched && !card.isFlipped &&
          x >= card.x && x <= card.x + this.cardWidth &&
          y >= card.y && y <= card.y + this.cardHeight) {
        
        this.flipCard(card);
        break;
      }
    }
  }
  
  flipCard(card) {
    card.isFlipped = true;
    this.flippedCards.push(card);
    
    // 添加水墨效果
    this.inkDrops.push({
      x: card.x + this.cardWidth / 2,
      y: card.y + this.cardHeight / 2,
      radius: 5,
      alpha: 0.5
    });
    
    if (this.flippedCards.length === 2) {
      this.canFlip = false;
      this.attempts++;
      
      setTimeout(() => {
        this.checkMatch();
      }, 800);
    }
  }
  
  checkMatch() {
    const [card1, card2] = this.flippedCards;
    
    if (card1.symbol === card2.symbol) {
      // 匹配成功
      card1.isMatched = true;
      card2.isMatched = true;
      this.matchedPairs++;
      this.score += 100 * this.level;
      
      // 成功水墨效果
      this.inkDrops.push({
        x: (card1.x + card2.x) / 2 + this.cardWidth / 2,
        y: (card1.y + card2.y) / 2 + this.cardHeight / 2,
        radius: 10,
        alpha: 0.8
      });
      
      // 检查胜利
      if (this.matchedPairs === this.pairs) {
        setTimeout(() => this.winGame(), 500);
      }
    } else {
      // 匹配失败
      card1.isFlipped = false;
      card2.isFlipped = false;
    }
    
    this.flippedCards = [];
    this.canFlip = true;
  }
  
  winGame() {
    this.gameOver = true;
    this.calculateStars();
    dataManager.updateGameProgress(this.gameId, this.level + 1, this.score, this.stars);
  }
  
  calculateStars() {
    // 根据尝试次数评分
    const minAttempts = this.pairs;
    const ratio = minAttempts / this.attempts;
    if (ratio >= 0.8) this.stars = 3;
    else if (ratio >= 0.6) this.stars = 2;
    else if (ratio >= 0.4) this.stars = 1;
    else this.stars = 0;
  }
  
  render(ctx) {
    // 宣纸背景
    ctx.fillStyle = '#F5F5DC';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 水墨晕染背景
    ctx.fillStyle = 'rgba(100, 100, 100, 0.05)';
    for (let i = 0; i < 5; i++) {
      const x = (i * 73) % this.width;
      const y = (i * 97) % this.height;
      ctx.beginPath();
      ctx.arc(x, y, 50 + i * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 绘制水墨效果
    this.inkDrops.forEach(drop => {
      const gradient = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, drop.radius);
      gradient.addColorStop(0, `rgba(60, 60, 60, ${drop.alpha})`);
      gradient.addColorStop(1, 'rgba(60, 60, 60, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // 绘制卡牌
    this.cards.forEach(card => this.drawCard(ctx, card));
    
    // UI
    this.renderUI(ctx);
    
    if (this.gameOver) this.renderGameOver(ctx);
  }
  
  drawCard(ctx, card) {
    const { x, y } = card;
    const progress = card.flipProgress;
    
    // 卡牌阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 3, y + 3, this.cardWidth, this.cardHeight);
    
    if (progress < 0.5) {
      // 显示背面
      const scale = 1 - progress * 2;
      const width = this.cardWidth * scale;
      const offsetX = (this.cardWidth - width) / 2;
      
      // 背面 - 水墨风格
      ctx.fillStyle = card.isMatched ? '#8BC34A' : '#8B4513';
      ctx.fillRect(x + offsetX, y, width, this.cardHeight);
      
      // 纹理
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + offsetX + 5 + i * 15, y + 10, 8, this.cardHeight - 20);
      }
      
      // 中心图案
      if (scale > 0.5) {
        ctx.fillStyle = '#D2691E';
        ctx.font = `${20 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('?', x + this.cardWidth / 2, y + this.cardHeight / 2 + 5);
      }
    } else {
      // 显示正面
      const scale = (progress - 0.5) * 2;
      const width = this.cardWidth * scale;
      const offsetX = (this.cardWidth - width) / 2;
      
      // 正面背景
      ctx.fillStyle = card.isMatched ? '#E8F5E9' : '#FFF8DC';
      ctx.fillRect(x + offsetX, y, width, this.cardHeight);
      
      // 边框
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + offsetX, y, width, this.cardHeight);
      
      // 符号
      if (scale > 0.5) {
        ctx.font = `bold ${35 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.symbol, x + this.cardWidth / 2, y + this.cardHeight / 2);
      }
    }
  }
  
  renderUI(ctx) {
    // 顶部信息栏
    ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
    ctx.fillRect(0, 0, this.width, 70);
    
    this.buttons.forEach(btn => btn.render(ctx));
    
    ctx.fillStyle = '#5D4037';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('记忆翻牌', this.width / 2, 35);
    
    ctx.fillStyle = '#8D6E63';
    ctx.font = '14px Arial';
    ctx.fillText(`Level ${this.level} | 尝试: ${this.attempts} | 得分: ${this.score}`, this.width / 2, 58);
  }
  
  renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(245, 245, 220, 0.95)';
    ctx.fillRect(20, this.height / 2 - 100, this.width - 40, 200);
    
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, this.height / 2 - 100, this.width - 40, 200);
    
    ctx.fillStyle = '#5D4037';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎋 恭喜完成！', this.width / 2, this.height / 2 - 50);
    
    ctx.font = '18px Arial';
    ctx.fillText(`尝试次数: ${this.attempts}  得分: ${this.score}`, this.width / 2, this.height / 2 - 10);
    
    let starsStr = '';
    for (let i = 0; i < 3; i++) starsStr += i < this.stars ? '⭐' : '⚫';
    ctx.font = '28px Arial';
    ctx.fillText(starsStr, this.width / 2, this.height / 2 + 30);
    
    this.createButton(this.width / 2 - 80, this.height / 2 + 60, 70, 35, '下一关', () => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    }, { bgColor: '#8B4513' });
    
    this.createButton(this.width / 2 + 10, this.height / 2 + 60, 70, 35, '返回', () => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    }, { bgColor: '#A1887F' });
    
    this.buttons.slice(-2).forEach(btn => btn.render(ctx));
  }
}

module.exports = MemoryScene;
