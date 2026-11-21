// 打砖块游戏 - 霓虹赛博风
const BaseScene = require('../../core/BaseScene');
const dataManager = require('../../core/DataManager');
const levelSystem = require('../../core/LevelSystem');

class BreakoutScene extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.level = this.params.level;
    this.levelConfig = this.params.levelConfig;
    
    // 游戏区域
    this.gameWidth = this.width - 40;
    this.gameHeight = this.height - 220;
    this.offsetX = 20;
    this.offsetY = 120;
    
    // 球拍
    this.paddle = {
      width: 80,
      height: 12,
      x: this.gameWidth / 2,
      y: this.gameHeight - 30
    };
    
    // 球
    this.ball = {
      x: this.gameWidth / 2,
      y: this.gameHeight / 2,
      radius: 6,
      vx: 4,
      vy: -4,
      speed: 5
    };
    
    // 砖块
    this.bricks = [];
    this.brickRows = 5 + Math.floor(this.level / 2);
    this.brickCols = 8;
    this.brickWidth = this.gameWidth / this.brickCols - 4;
    this.brickHeight = 20;
    
    // 游戏状态
    this.score = 0;
    this.stars = 0;
    this.lives = 3;
    this.gameOver = false;
    this.won = false;
    this.paused = false;
    this.ballLaunched = false;
    
    // 粒子效果
    this.particles = [];
    
    // 霓虹效果
    this.glowIntensity = 0;
    this.glowDirection = 1;
    
    this.initBricks();
    this.createUI();
  }
  
  initBricks() {
    const colors = ['#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3A86FF'];
    
    for (let row = 0; row < this.brickRows; row++) {
      for (let col = 0; col < this.brickCols; col++) {
        // 根据关卡增加难度，有些位置不放砖块
        if (this.level > 3 && Math.random() < 0.2) continue;
        
        this.bricks.push({
          x: this.offsetX + col * (this.brickWidth + 4) + 2,
          y: this.offsetY + row * (this.brickHeight + 4) + 2,
          width: this.brickWidth,
          height: this.brickHeight,
          color: colors[row % colors.length],
          health: this.level > 5 ? 2 : 1,
          maxHealth: this.level > 5 ? 2 : 1
        });
      }
    }
  }
  
  createUI() {
    this.createBackButton(() => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    });
    
    this.createButton(this.width - 60, 20, 40, 40, '⏸', () => {
      this.paused = !this.paused;
    }, { bgColor: '#F39C12', fontSize: 18 });
  }
  
  update(deltaTime, touchEvents) {
    if (this.gameOver || this.paused) {
      this.handleTouchEvents(touchEvents);
      return;
    }
    
    // 霓虹闪烁效果
    this.glowIntensity += 0.05 * this.glowDirection;
    if (this.glowIntensity > 1) this.glowDirection = -1;
    if (this.glowIntensity < 0.3) this.glowDirection = 1;
    
    // 触摸控制球拍
    touchEvents.forEach(event => {
      if (event.type === 'move' || event.type === 'start') {
        const relativeX = event.x - this.offsetX;
        this.paddle.x = Math.max(this.paddle.width / 2, 
                                 Math.min(this.gameWidth - this.paddle.width / 2, relativeX));
        
        if (!this.ballLaunched && event.type === 'start') {
          this.ballLaunched = true;
        }
      }
    });
    
    if (!this.ballLaunched) {
      this.ball.x = this.paddle.x;
      this.ball.y = this.paddle.y - this.ball.radius - 5;
      this.handleTouchEvents(touchEvents);
      return;
    }
    
    // 天气效果影响
    const weatherEffect = levelSystem.getWeatherEffect(this.levelConfig.weather.id);
    const speedMod = weatherEffect.speedMod;
    
    // 移动球
    this.ball.x += this.ball.vx * speedMod;
    this.ball.y += this.ball.vy * speedMod;
    
    // 墙壁碰撞
    if (this.ball.x - this.ball.radius < 0 || 
        this.ball.x + this.ball.radius > this.gameWidth) {
      this.ball.vx = -this.ball.vx;
      this.createParticles(this.ball.x + this.offsetX, this.ball.y + this.offsetY, '#FFFFFF', 3);
    }
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.vy = -this.ball.vy;
      this.createParticles(this.ball.x + this.offsetX, this.ball.y + this.offsetY, '#FFFFFF', 3);
    }
    
    // 底部掉落
    if (this.ball.y > this.gameHeight) {
      this.lives--;
      if (this.lives <= 0) {
        this.endGame();
      } else {
        this.resetBall();
      }
    }
    
    // 球拍碰撞
    if (this.ball.y + this.ball.radius >= this.paddle.y - this.paddle.height / 2 &&
        this.ball.y - this.ball.radius <= this.paddle.y + this.paddle.height / 2 &&
        this.ball.x >= this.paddle.x - this.paddle.width / 2 &&
        this.ball.x <= this.paddle.x + this.paddle.width / 2) {
      
      // 根据击中位置改变角度
      const hitPos = (this.ball.x - this.paddle.x) / (this.paddle.width / 2);
      this.ball.vx = hitPos * 5;
      this.ball.vy = -Math.abs(this.ball.vy);
      
      this.createParticles(this.ball.x + this.offsetX, this.ball.y + this.offsetY, '#00F5FF', 5);
    }
    
    // 砖块碰撞
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const brick = this.bricks[i];
      if (this.checkBallBrickCollision(this.ball, brick)) {
        brick.health--;
        this.createParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 8);
        
        if (brick.health <= 0) {
          this.score += 10 * this.level * brick.maxHealth;
          this.bricks.splice(i, 1);
        }
        
        // 检查胜利
        if (this.bricks.length === 0) {
          this.winGame();
        }
        break;
      }
    }
    
    // 更新粒子
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= deltaTime;
      return p.life > 0;
    });
    
    this.handleTouchEvents(touchEvents);
  }
  
  checkBallBrickCollision(ball, brick) {
    const closestX = Math.max(brick.x, Math.min(ball.x + this.offsetX, brick.x + brick.width));
    const closestY = Math.max(brick.y, Math.min(ball.y + this.offsetY, brick.y + brick.height));
    
    const dx = ball.x + this.offsetX - closestX;
    const dy = ball.y + this.offsetY - closestY;
    
    if (dx * dx + dy * dy < ball.radius * ball.radius) {
      // 确定碰撞方向
      if (Math.abs(dx) > Math.abs(dy)) {
        ball.vx = -ball.vx;
      } else {
        ball.vy = -ball.vy;
      }
      return true;
    }
    return false;
  }
  
  resetBall() {
    this.ballLaunched = false;
    this.ball.x = this.paddle.x;
    this.ball.y = this.paddle.y - this.ball.radius - 5;
    this.ball.vx = 4 * (Math.random() > 0.5 ? 1 : -1);
    this.ball.vy = -4;
  }
  
  createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 400 + Math.random() * 200,
        color: color,
        size: 2 + Math.random() * 3
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
    // 深色背景
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 网格背景（赛博朋克风格）
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    
    // 游戏区域边框
    ctx.strokeStyle = '#00F5FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.offsetX, this.offsetY, this.gameWidth, this.gameHeight);
    
    // 绘制砖块（霓虹效果）
    this.bricks.forEach(brick => {
      // 发光效果
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 10 + this.glowIntensity * 5;
      
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      
      // 内部高光
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(brick.x, brick.y, brick.width, 3);
      
      // 血条显示
      if (brick.maxHealth > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(brick.x + 2, brick.y + brick.height - 5, brick.width - 4, 3);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(brick.x + 2, brick.y + brick.height - 5, 
                     (brick.width - 4) * (brick.health / brick.maxHealth), 3);
      }
      
      ctx.shadowBlur = 0;
    });
    
    // 绘制球拍
    ctx.shadowColor = '#00F5FF';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#00F5FF';
    ctx.fillRect(
      this.offsetX + this.paddle.x - this.paddle.width / 2,
      this.offsetY + this.paddle.y - this.paddle.height / 2,
      this.paddle.width,
      this.paddle.height
    );
    ctx.shadowBlur = 0;
    
    // 绘制球
    ctx.shadowColor = '#FF006E';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FF006E';
    ctx.beginPath();
    ctx.arc(
      this.offsetX + this.ball.x,
      this.offsetY + this.ball.y,
      this.ball.radius,
      0, Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // 绘制粒子
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life / 600;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    
    // UI
    this.renderUI(ctx);
    
    if (this.gameOver) this.renderGameOver(ctx);
    if (this.paused && !this.gameOver) this.renderPause(ctx);
  }
  
  renderUI(ctx) {
    // 顶部信息
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.width, 70);
    
    this.buttons.forEach(btn => btn.render(ctx));
    
    ctx.fillStyle = '#00F5FF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`NEON BREAKOUT - Level ${this.level}`, this.width / 2, 45);
    
    ctx.fillStyle = '#FF006E';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 120, 45);
    
    // 生命
    ctx.fillStyle = '#FF006E';
    ctx.textAlign = 'right';
    let hearts = '';
    for (let i = 0; i < this.lives; i++) hearts += '❤️';
    ctx.fillText(hearts, this.width - 80, 45);
    
    // 提示
    if (!this.ballLaunched) {
      ctx.fillStyle = 'rgba(0, 245, 255, 0.8)';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('滑动移动球拍，点击发射', this.width / 2, this.height - 50);
    }
  }
  
  renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = this.won ? '#00F5FF' : '#FF006E';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.won ? 'SYSTEM CLEARED!' : 'GAME OVER', this.width / 2, this.height / 2 - 60);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2);
    
    let starsStr = '';
    for (let i = 0; i < 3; i++) starsStr += i < this.stars ? '⭐' : '⚫';
    ctx.font = '30px Arial';
    ctx.fillText(starsStr, this.width / 2, this.height / 2 + 50);
    
    this.createButton(this.width / 2 - 80, this.height / 2 + 100, 70, 40, 'RETRY', () => {
      this.game.switchScene(BreakoutScene, this.params);
    }, { bgColor: '#00F5FF', textColor: '#000' });
    
    this.createButton(this.width / 2 + 10, this.height / 2 + 100, 70, 40, 'BACK', () => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    }, { bgColor: '#FF006E' });
    
    this.buttons.slice(-2).forEach(btn => btn.render(ctx));
  }
  
  renderPause(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = '#00F5FF';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', this.width / 2, this.height / 2);
  }
}

module.exports = BreakoutScene;
