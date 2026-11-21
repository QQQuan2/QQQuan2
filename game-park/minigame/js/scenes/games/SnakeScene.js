// 贪吃蛇游戏 - 像素复古风
const BaseScene = require('../../core/BaseScene');
const dataManager = require('../../core/DataManager');
const levelSystem = require('../../core/LevelSystem');

class SnakeScene extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.level = this.params.level;
    this.levelConfig = this.params.levelConfig;
    
    // 游戏区域
    this.gridSize = 15;
    this.cols = Math.floor((this.width - 40) / this.gridSize);
    this.rows = Math.floor((this.height - 200) / this.gridSize);
    this.offsetX = (this.width - this.cols * this.gridSize) / 2;
    this.offsetY = 140;
    
    // 蛇
    this.snake = [];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    
    // 食物
    this.food = null;
    
    // 游戏状态
    this.score = 0;
    this.stars = 0;
    this.gameOver = false;
    this.paused = false;
    this.won = false;
    
    // 移动计时
    this.moveInterval = Math.max(80, 150 - this.level * 5);
    this.moveTimer = 0;
    
    // 粒子效果
    this.particles = [];
    
    // 天气效果计时
    this.weatherTimer = 0;
    
    this.initGame();
    this.createUI();
  }
  
  initGame() {
    // 初始化蛇
    const startX = Math.floor(this.cols / 2);
    const startY = Math.floor(this.rows / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    
    // 生成食物
    this.spawnFood();
  }
  
  spawnFood() {
    let valid = false;
    while (!valid) {
      const x = Math.floor(Math.random() * this.cols);
      const y = Math.floor(Math.random() * this.rows);
      
      valid = true;
      for (const segment of this.snake) {
        if (segment.x === x && segment.y === y) {
          valid = false;
          break;
        }
      }
      
      if (valid) {
        this.food = { x, y };
      }
    }
  }
  
  createUI() {
    // 返回按钮
    this.createBackButton(() => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    });
    
    // 暂停按钮
    this.createButton(this.width - 60, 20, 40, 40, '⏸', () => {
      this.paused = !this.paused;
    }, { bgColor: '#F39C12', fontSize: 18 });
  }
  
  update(deltaTime, touchEvents) {
    if (this.gameOver || this.paused) {
      this.handleTouchEvents(touchEvents);
      return;
    }
    
    // 处理滑动控制
    this.handleTouchEvents(touchEvents);
    
    // 天气效果影响
    const weatherEffect = levelSystem.getWeatherEffect(this.levelConfig.weather.id);
    
    // 移动计时
    this.moveTimer += deltaTime * weatherEffect.speedMod;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;
      this.moveSnake();
    }
    
    // 更新粒子
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= deltaTime;
      p.vy += 0.1; // 重力
      return p.life > 0;
    });
    
    // 更新天气动画
    this.weatherTimer += deltaTime;
  }
  
  handleTouchEvents(touchEvents) {
    if (touchEvents.length === 0) return;
    
    const event = touchEvents[0];
    if (event.type === 'start') {
      this.touchStart = { x: event.x, y: event.y };
    } else if (event.type === 'end' && this.touchStart) {
      const dx = event.x - this.touchStart.x;
      const dy = event.y - this.touchStart.y;
      const minSwipe = 30;
      
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
        // 水平滑动
        if (dx > 0 && this.direction.x !== -1) {
          this.nextDirection = { x: 1, y: 0 };
        } else if (dx < 0 && this.direction.x !== 1) {
          this.nextDirection = { x: -1, y: 0 };
        }
      } else if (Math.abs(dy) > minSwipe) {
        // 垂直滑动
        if (dy > 0 && this.direction.y !== -1) {
          this.nextDirection = { x: 0, y: 1 };
        } else if (dy < 0 && this.direction.y !== 1) {
          this.nextDirection = { x: 0, y: -1 };
        }
      }
      
      this.touchStart = null;
    }
    
    // 调用父类处理按钮
    super.handleTouchEvents(touchEvents);
  }
  
  moveSnake() {
    this.direction = this.nextDirection;
    
    const head = this.snake[0];
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y
    };
    
    // 墙壁碰撞检测
    if (newHead.x < 0 || newHead.x >= this.cols || 
        newHead.y < 0 || newHead.y >= this.rows) {
      this.endGame();
      return;
    }
    
    // 自身碰撞检测
    for (const segment of this.snake) {
      if (newHead.x === segment.x && newHead.y === segment.y) {
        this.endGame();
        return;
      }
    }
    
    this.snake.unshift(newHead);
    
    // 吃食物
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += 10 * this.level;
      this.createParticles(
        this.offsetX + this.food.x * this.gridSize + this.gridSize / 2,
        this.offsetY + this.food.y * this.gridSize + this.gridSize / 2,
        '#FF6B6B'
      );
      this.spawnFood();
      
      // 检查胜利条件
      if (this.score >= this.levelConfig.targetScore) {
        this.winGame();
      }
    } else {
      this.snake.pop();
    }
  }
  
  createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 500,
        color: color
      });
    }
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
    const ratio = this.score / this.levelConfig.targetScore;
    if (ratio >= 1.5) this.stars = 3;
    else if (ratio >= 1.0) this.stars = 2;
    else if (ratio >= 0.5) this.stars = 1;
    else this.stars = 0;
  }
  
  render(ctx) {
    // 背景 - 根据地区颜色
    ctx.fillStyle = this.levelConfig.region.color;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 时间效果
    ctx.fillStyle = this.levelConfig.time.bgColor;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;
    
    // 游戏区域背景
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(this.offsetX - 2, this.offsetY - 2, 
                 this.cols * this.gridSize + 4, this.rows * this.gridSize + 4);
    
    // 绘制网格（像素风格）
    ctx.strokeStyle = '#16213E';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX + x * this.gridSize, this.offsetY);
      ctx.lineTo(this.offsetX + x * this.gridSize, this.offsetY + this.rows * this.gridSize);
      ctx.stroke();
    }
    for (let y = 0; y <= this.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX, this.offsetY + y * this.gridSize);
      ctx.lineTo(this.offsetX + this.cols * this.gridSize, this.offsetY + y * this.gridSize);
      ctx.stroke();
    }
    
    // 绘制蛇（像素风格）
    this.snake.forEach((segment, index) => {
      const x = this.offsetX + segment.x * this.gridSize;
      const y = this.offsetY + segment.y * this.gridSize;
      
      // 身体
      ctx.fillStyle = index === 0 ? '#4ECDC4' : '#44A08D';
      ctx.fillRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
      
      // 像素高光
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x + 2, y + 2, 4, 4);
    });
    
    // 绘制食物（像素苹果）
    if (this.food) {
      const fx = this.offsetX + this.food.x * this.gridSize;
      const fy = this.offsetY + this.food.y * this.gridSize;
      ctx.fillStyle = '#FF6B6B';
      ctx.fillRect(fx + 2, fy + 2, this.gridSize - 4, this.gridSize - 4);
      ctx.fillStyle = '#2ECC71';
      ctx.fillRect(fx + 6, fy, 3, 3);
    }
    
    // 绘制粒子
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 500;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
    
    // 天气效果
    levelSystem.drawWeatherEffect(ctx, this.width, this.height, 
                                   this.levelConfig.weather, this.levelConfig.time);
    
    // UI
    this.renderUI(ctx);
    
    // 游戏结束/胜利画面
    if (this.gameOver) {
      this.renderGameOver(ctx);
    }
    
    // 暂停画面
    if (this.paused && !this.gameOver) {
      this.renderPause(ctx);
    }
  }
  
  renderUI(ctx) {
    // 顶部信息栏
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, this.width, 70);
    
    // 返回和暂停按钮
    this.buttons.forEach(btn => btn.render(ctx));
    
    // 关卡信息
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Level ${this.level} ${this.levelConfig.region.icon}`, this.width / 2, 45);
    
    // 分数
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 120, 45);
    
    // 目标
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '12px Arial';
    ctx.fillText(`Target: ${this.levelConfig.targetScore}`, 120, 60);
    
    // 天气图标
    ctx.font = '20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(this.levelConfig.weather.id === 'sunny' ? '☀️' : 
                 this.levelConfig.weather.id === 'rainy' ? '🌧️' :
                 this.levelConfig.weather.id === 'snowy' ? '❄️' :
                 this.levelConfig.weather.id === 'foggy' ? '🌫️' : '⛈️', 
                 this.width - 80, 45);
  }
  
  renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = this.won ? '#2ECC71' : '#E74C3C';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.won ? '🎉 胜利!' : '💀 游戏结束', this.width / 2, this.height / 2 - 60);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(`得分: ${this.score}`, this.width / 2, this.height / 2);
    
    // 星星
    let starsStr = '';
    for (let i = 0; i < 3; i++) {
      starsStr += i < this.stars ? '⭐' : '⚫';
    }
    ctx.font = '30px Arial';
    ctx.fillText(starsStr, this.width / 2, this.height / 2 + 50);
    
    // 按钮
    this.createButton(this.width / 2 - 80, this.height / 2 + 100, 70, 40, '重试', () => {
      this.game.switchScene(SnakeScene, this.params);
    }, { bgColor: '#3498DB' });
    
    this.createButton(this.width / 2 + 10, this.height / 2 + 100, 70, 40, '返回', () => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    }, { bgColor: '#95A5A6' });
    
    this.buttons.slice(-2).forEach(btn => btn.render(ctx));
  }
  
  renderPause(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ 暂停', this.width / 2, this.height / 2);
    
    ctx.font = '16px Arial';
    ctx.fillText('点击继续', this.width / 2, this.height / 2 + 40);
  }
}

module.exports = SnakeScene;
