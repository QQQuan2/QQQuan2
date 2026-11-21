// 飞机大战 - 卡通可爱风
const BaseScene = require('../../core/BaseScene');
const dataManager = require('../../core/DataManager');
const levelSystem = require('../../core/LevelSystem');

class ShooterScene extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.level = this.params.level;
    this.levelConfig = this.params.levelConfig;
    
    // 游戏区域
    this.gameWidth = this.width;
    this.gameHeight = this.height - 100;
    
    // 玩家飞机
    this.player = {
      x: this.gameWidth / 2,
      y: this.gameHeight - 80,
      width: 40,
      height: 40,
      speed: 5
    };
    
    // 子弹
    this.bullets = [];
    this.bulletSpeed = 8;
    this.shootCooldown = 0;
    
    // 敌机
    this.enemies = [];
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = Math.max(500, 1500 - this.level * 100);
    
    // 道具
    this.powerUps = [];
    
    // 游戏状态
    this.score = 0;
    this.stars = 0;
    this.lives = 3;
    this.gameOver = false;
    this.won = false;
    
    // 粒子效果
    this.particles = [];
    
    // 背景云朵
    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * this.gameWidth,
        y: Math.random() * this.gameHeight,
        size: 30 + Math.random() * 40,
        speed: 0.5 + Math.random() * 1
      });
    }
    
    this.createUI();
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
    
    // 触摸控制
    touchEvents.forEach(event => {
      if (event.type === 'move' || event.type === 'start') {
        this.player.x = Math.max(this.player.width / 2, 
                                 Math.min(this.gameWidth - this.player.width / 2, event.x));
        this.player.y = Math.max(this.gameHeight / 2, 
                                 Math.min(this.gameHeight - this.player.height / 2, event.y));
      }
    });
    
    // 自动射击
    this.shootCooldown -= deltaTime;
    if (this.shootCooldown <= 0) {
      this.bullets.push({
        x: this.player.x,
        y: this.player.y - this.player.height / 2,
        width: 4,
        height: 12
      });
      this.shootCooldown = 200;
    }
    
    // 更新子弹
    this.bullets = this.bullets.filter(b => {
      b.y -= this.bulletSpeed;
      return b.y > -20;
    });
    
    // 生成敌机
    this.enemySpawnTimer += deltaTime;
    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.spawnEnemy();
      this.enemySpawnTimer = 0;
    }
    
    // 更新敌机
    this.enemies = this.enemies.filter(e => {
      e.y += e.speed;
      e.x += Math.sin(e.y * 0.02) * 0.5; // 摇摆
      
      // 碰撞检测 - 子弹
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (this.checkCollision(b, e)) {
          this.bullets.splice(i, 1);
          e.hp--;
          this.createParticles(e.x, e.y, '#FF6B6B', 5);
          
          if (e.hp <= 0) {
            this.score += e.score * this.level;
            this.createParticles(e.x, e.y, e.color, 10);
            
            // 掉落道具
            if (Math.random() < 0.1) {
              this.powerUps.push({ x: e.x, y: e.y, type: 'heart' });
            }
            
            // 检查胜利
            if (this.score >= this.levelConfig.targetScore) {
              this.winGame();
            }
            
            return false;
          }
        }
      }
      
      // 碰撞检测 - 玩家
      if (this.checkCollision(this.player, e)) {
        this.lives--;
        this.createParticles(this.player.x, this.player.y, '#FFD93D', 15);
        if (this.lives <= 0) {
          this.endGame();
        }
        return false;
      }
      
      return e.y < this.gameHeight + 50;
    });
    
    // 更新道具
    this.powerUps = this.powerUps.filter(p => {
      p.y += 2;
      
      if (this.checkCollision(this.player, { x: p.x, y: p.y, width: 25, height: 25 })) {
        if (p.type === 'heart' && this.lives < 5) {
          this.lives++;
        }
        return false;
      }
      
      return p.y < this.gameHeight;
    });
    
    // 更新粒子
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= deltaTime;
      return p.life > 0;
    });
    
    // 更新背景
    this.clouds.forEach(c => {
      c.y += c.speed;
      if (c.y > this.gameHeight + c.size) {
        c.y = -c.size;
        c.x = Math.random() * this.gameWidth;
      }
    });
    
    this.handleTouchEvents(touchEvents);
  }
  
  spawnEnemy() {
    const types = [
      { width: 30, height: 30, hp: 1, speed: 2, score: 10, color: '#E74C3C', emoji: '👾' },
      { width: 40, height: 40, hp: 2, speed: 1.5, score: 20, color: '#9B59B6', emoji: '👽' },
      { width: 50, height: 35, hp: 3, speed: 1, score: 30, color: '#E91E63', emoji: '🛸' }
    ];
    
    const type = this.level > 3 && Math.random() < 0.3 ? types[2] : 
                 this.level > 1 && Math.random() < 0.5 ? types[1] : types[0];
    
    this.enemies.push({
      x: 30 + Math.random() * (this.gameWidth - 60),
      y: -50,
      ...type
    });
  }
  
  checkCollision(a, b) {
    return Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
           Math.abs(a.y - b.y) < (a.height + b.height) / 2;
  }
  
  createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 400 + Math.random() * 300,
        color: color,
        size: 3 + Math.random() * 4
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
    // 天空背景
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 绘制云朵
    this.clouds.forEach(c => this.drawCloud(ctx, c));
    
    // 绘制道具
    this.powerUps.forEach(p => {
      ctx.font = '25px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('❤️', p.x, p.y);
    });
    
    // 绘制子弹
    ctx.fillStyle = '#FFD700';
    this.bullets.forEach(b => {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 子弹尾焰
      ctx.fillStyle = 'rgba(255, 200, 0, 0.5)';
      ctx.fillRect(b.x - 2, b.y + 5, 4, 8);
      ctx.fillStyle = '#FFD700';
    });
    
    // 绘制敌机
    this.enemies.forEach(e => {
      ctx.font = '30px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.emoji, e.x, e.y);
      
      // 血条
      if (e.hp < e.hp) {
        ctx.fillStyle = 'red';
        ctx.fillRect(e.x - 15, e.y - 25, 30, 4);
        ctx.fillStyle = 'green';
        ctx.fillRect(e.x - 15, e.y - 25, 30 * (e.hp / e.hp), 4);
      }
    });
    
    // 绘制玩家飞机
    this.drawPlayer(ctx);
    
    // 绘制粒子
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life / 700;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // UI
    this.renderUI(ctx);
    
    if (this.gameOver) this.renderGameOver(ctx);
  }
  
  drawCloud(ctx, c) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
    ctx.arc(c.x + c.size * 0.8, c.y - c.size * 0.3, c.size * 0.7, 0, Math.PI * 2);
    ctx.arc(c.x + c.size * 1.5, c.y, c.size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  
  drawPlayer(ctx) {
    const { x, y, width, height } = this.player;
    
    // 飞机阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 5, y + 5, width / 2, height / 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 飞机身体
    ctx.fillStyle = '#4ECDC4';
    ctx.beginPath();
    ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 驾驶舱
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.arc(x, y - 5, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // 机翼
    ctx.fillStyle = '#44A08D';
    ctx.fillRect(x - width / 2 - 5, y, width + 10, 8);
    
    // 尾翼
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 10);
    ctx.lineTo(x + 8, y + 10);
    ctx.lineTo(x, y + 20);
    ctx.fill();
    
    // 螺旋桨
    ctx.fillStyle = '#FFD93D';
    ctx.fillRect(x - 15, y - 18, 30, 4);
    ctx.fillRect(x - 2, y - 22, 4, 12);
  }
  
  renderUI(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, 0, this.width, 70);
    
    this.buttons.forEach(btn => btn.render(ctx));
    
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`✈️ Sky Battle - Level ${this.level}`, this.width / 2, 35);
    
    ctx.fillStyle = '#E74C3C';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 110, 45);
    
    // 生命
    ctx.textAlign = 'right';
    let hearts = '';
    for (let i = 0; i < this.lives; i++) hearts += '❤️';
    ctx.fillText(hearts, this.width - 20, 45);
  }
  
  renderGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = this.won ? '#4ECDC4' : '#E74C3C';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.won ? '🎉 Mission Complete!' : '💥 Game Over', this.width / 2, this.height / 2 - 60);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2);
    
    let starsStr = '';
    for (let i = 0; i < 3; i++) starsStr += i < this.stars ? '⭐' : '⚫';
    ctx.font = '32px Arial';
    ctx.fillText(starsStr, this.width / 2, this.height / 2 + 50);
    
    this.createButton(this.width / 2 - 80, this.height / 2 + 100, 70, 40, 'Retry', () => {
      this.game.switchScene(ShooterScene, this.params);
    }, { bgColor: '#4ECDC4' });
    
    this.createButton(this.width / 2 + 10, this.height / 2 + 100, 70, 40, 'Back', () => {
      const GameSelectScene = require('../GameSelectScene');
      this.game.switchScene(GameSelectScene, { gameId: this.gameId });
    }, { bgColor: '#95A5A6' });
    
    this.buttons.slice(-2).forEach(btn => btn.render(ctx));
  }
}

module.exports = ShooterScene;
