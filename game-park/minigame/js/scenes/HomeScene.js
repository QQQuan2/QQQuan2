// 主页场景 - 卡通游乐园风格
const BaseScene = require('../core/BaseScene');
const dataManager = require('../core/DataManager');

class HomeScene extends BaseScene {
  init() {
    this.backgroundColor = '#FF6B6B';
    this.titleY = 80;
    this.clouds = [];
    this.balloons = [];
    this.time = 0;
    
    // 初始化装饰元素
    this.initDecorations();
    
    // 游戏列表
    this.games = [
      { id: 'snake', name: '贪吃蛇', style: '像素复古', color: '#8BC34A', icon: '🐍' },
      { id: 'breakout', name: '打砖块', style: '霓虹赛博', color: '#E91E63', icon: '🧱' },
      { id: 'tetris', name: '俄罗斯方块', style: '复古街机', color: '#FF9800', icon: '🟦' },
      { id: 'match3', name: '消消乐', style: '糖果缤纷', color: '#9C27B0', icon: '🍬' },
      { id: 'g2048', name: '2048', style: '简洁扁平', color: '#00BCD4', icon: '🔢' },
      { id: 'shooter', name: '飞机大战', style: '卡通可爱', color: '#FF5722', icon: '✈️' },
      { id: 'memory', name: '记忆翻牌', style: '中国水墨', color: '#795548', icon: '🎴' },
      { id: 'minesweeper', name: '扫雷', style: '极简几何', color: '#607D8B', icon: '💣' }
    ];
    
    // 创建游戏卡片
    this.createGameCards();
    
    // 创建统计按钮
    this.createButton(this.width - 100, 20, 80, 36, '🏆', () => {
      this.showStats();
    }, { bgColor: '#FFD93D', fontSize: 20 });

    // 帮助按钮：随时重看新手指引
    this.createButton(this.width - 100, 66, 80, 36, '❓ 帮助', () => {
      this.showGuide();
    }, { bgColor: '#4ECDC4', fontSize: 13 });

    // 首次进入显示新手指引
    if (!dataManager.data.guideSeen) {
      this.showGuide();
    }
  }

  // ========== 新手指引 ==========
  showGuide() {
    this.guide = {
      active: true,
      page: 0,
      pages: [
        {
          icon: '🎮',
          title: '欢迎来到游戏乐园！',
          lines: ['这里有 8 款小游戏：', '贪吃蛇、俄罗斯方块、2048、', '扫雷、记忆翻牌等。', '点击卡片即可开始游戏。']
        },
        {
          icon: '⭐',
          title: '通关攒星星',
          lines: ['每款游戏有 12 个关卡。', '通关可以拿到 1~3 颗星星，', '前一款游戏攒满 3 颗星星，', '就能解锁下一款新游戏。']
        },
        {
          icon: '💾',
          title: '进度自动保存',
          lines: ['关卡、星星、最高分', '都会自动保存。', '随时回来继续冒险！']
        }
      ]
    };
  }

  closeGuide() {
    this.guide.active = false;
    if (!dataManager.data.guideSeen) {
      dataManager.data.guideSeen = true;
      dataManager.save();
    }
  }

  handleTouchEvents(touchEvents) {
    // 引导层激活时拦截所有点击：点屏幕任意位置翻页
    if (this.guide && this.guide.active) {
      touchEvents.forEach(event => {
        if (event.type === 'end') {
          if (this.guide.page < this.guide.pages.length - 1) {
            this.guide.page++;
          } else {
            this.closeGuide();
          }
        }
      });
      return;
    }
    super.handleTouchEvents(touchEvents);
  }
  
  initDecorations() {
    // 云朵
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * this.width,
        y: 30 + Math.random() * 60,
        size: 30 + Math.random() * 20,
        speed: 0.2 + Math.random() * 0.3
      });
    }
    
    // 气球
    for (let i = 0; i < 8; i++) {
      this.balloons.push({
        x: 30 + Math.random() * (this.width - 60),
        y: this.height - 50 - Math.random() * 100,
        color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'][Math.floor(Math.random() * 4)],
        size: 15 + Math.random() * 10,
        offset: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5
      });
    }
  }
  
  createGameCards() {
    const cols = 2;
    const cardWidth = (this.width - 60) / cols;
    const cardHeight = 100;
    const startY = 160;
    const gap = 15;
    
    this.games.forEach((game, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = 20 + col * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);
      
      const gameData = dataManager.getGameData(game.id);
      const isLocked = gameData.unlockedLevel <= 1 && index > 0 && 
                       dataManager.getGameData(this.games[index - 1].id).totalStars < 3;
      
      this.createGameCard(x, y, cardWidth, cardHeight, game, gameData, isLocked);
    });
  }
  
  createGameCard(x, y, width, height, game, gameData, isLocked) {
    const scene = this;
    const card = {
      x, y, width, height, game, gameData, isLocked,
      
      isPointInside(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
      },
      
      onClick: function () {
        if (!this.isLocked) {
          const GameSelectScene = require('./GameSelectScene');
          scene.game.switchScene(GameSelectScene, { gameId: game.id });
        }
      },
      
      render(ctx) {
        // 卡片背景
        ctx.fillStyle = this.isLocked ? '#BDC3C7' : this.game.color;
        this.roundRect(ctx, this.x, this.y, this.width, this.height, 15);
        ctx.fill();
        
        // 内阴影效果
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, 30);
        
        // 游戏图标
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.game.icon, this.x + 35, this.y + 55);
        
        // 游戏名称
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(this.game.name, this.x + 65, this.y + 45);
        
        // 风格标签
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '12px Arial';
        ctx.fillText(this.game.style, this.x + 65, this.y + 62);
        
        // 进度显示
        if (!this.isLocked) {
          ctx.fillStyle = '#FFD700';
          ctx.font = '14px Arial';
          ctx.textAlign = 'right';
          ctx.fillText(`⭐${this.gameData.totalStars}`, this.x + this.width - 10, this.y + 85);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(`Lv.${this.gameData.unlockedLevel}`, this.x + this.width - 50, this.y + 85);
        } else {
          ctx.fillStyle = '#7F8C8D';
          ctx.font = '20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('🔒', this.x + this.width / 2, this.y + 75);
        }
      },
      
      roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      }
    };
    
    this.buttons.push(card);
  }
  
  update(deltaTime, touchEvents) {
    super.update(deltaTime, touchEvents);
    this.time += deltaTime;
    
    // 更新云朵位置
    this.clouds.forEach(cloud => {
      cloud.x += cloud.speed;
      if (cloud.x > this.width + cloud.size) {
        cloud.x = -cloud.size;
      }
    });
    
    // 更新气球
    this.balloons.forEach(balloon => {
      balloon.y -= balloon.speed * 0.3;
      balloon.x += Math.sin(this.time * 0.002 + balloon.offset) * 0.5;
      if (balloon.y < -50) {
        balloon.y = this.height + 50;
        balloon.x = Math.random() * this.width;
      }
    });
  }
  
  render(ctx) {
    // 渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#FF6B6B');
    gradient.addColorStop(0.5, '#FF8E53');
    gradient.addColorStop(1, '#FF6B6B');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 绘制云朵
    this.clouds.forEach(cloud => this.drawCloud(ctx, cloud));
    
    // 绘制标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillText('🎮 游戏乐园', this.width / 2, this.titleY);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '14px Arial';
    ctx.fillText('选择你喜欢的游戏开始冒险！', this.width / 2, this.titleY + 25);
    
    // 绘制按钮（游戏卡片）
    this.buttons.forEach(btn => btn.render(ctx));
    
    // 绘制气球
    this.balloons.forEach(balloon => this.drawBalloon(ctx, balloon));
    
    // 底部装饰
    this.drawGround(ctx);

    // 新手指引层（最后绘制，盖在最上面）
    if (this.guide && this.guide.active) {
      this.drawGuide(ctx);
    }
  }

  drawGuide(ctx) {
    const page = this.guide.pages[this.guide.page];

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, this.width, this.height);

    // 引导卡片
    const cw = this.width - 60;
    const cx = 30;
    const ch = 240;
    const cy = (this.height - ch) / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    const r = 16;
    ctx.moveTo(cx + r, cy);
    ctx.lineTo(cx + cw - r, cy);
    ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + r);
    ctx.lineTo(cx + cw, cy + ch - r);
    ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - r, cy + ch);
    ctx.lineTo(cx + r, cy + ch);
    ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - r);
    ctx.lineTo(cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy);
    ctx.closePath();
    ctx.fill();

    // 图标与标题
    ctx.fillStyle = '#2C3E50';
    ctx.textAlign = 'center';
    ctx.font = '44px Arial';
    ctx.fillText(page.icon, cx + cw / 2, cy + 62);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#E74C3C';
    ctx.fillText(page.title, cx + cw / 2, cy + 100);

    // 正文
    ctx.fillStyle = '#34495E';
    ctx.font = '15px Arial';
    page.lines.forEach((line, i) => {
      ctx.fillText(line, cx + cw / 2, cy + 138 + i * 24);
    });

    // 页码圆点
    for (let i = 0; i < this.guide.pages.length; i++) {
      ctx.beginPath();
      ctx.arc(cx + cw / 2 - 20 + i * 20, cy + ch - 24, 5, 0, Math.PI * 2);
      ctx.fillStyle = i === this.guide.page ? '#E74C3C' : '#BDC3C7';
      ctx.fill();
    }

    // 提示
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '14px Arial';
    ctx.fillText(
      this.guide.page < this.guide.pages.length - 1 ? '点击任意位置继续 ▶' : '点击任意位置开始游戏 🎮',
      this.width / 2, cy + ch + 36
    );
  }
  
  drawCloud(ctx, cloud) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.8, cloud.y - cloud.size * 0.3, cloud.size * 0.7, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 1.5, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  
  drawBalloon(ctx, balloon) {
    // 气球线
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(balloon.x, balloon.y + balloon.size);
    ctx.lineTo(balloon.x, balloon.y + balloon.size + 30);
    ctx.stroke();
    
    // 气球
    ctx.fillStyle = balloon.color;
    ctx.beginPath();
    ctx.ellipse(balloon.x, balloon.y, balloon.size * 0.7, balloon.size, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(balloon.x - balloon.size * 0.2, balloon.y - balloon.size * 0.3, 
                balloon.size * 0.2, balloon.size * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  drawGround(ctx) {
    // 草地
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, this.height - 40, this.width, 40);
    
    // 草地装饰
    ctx.fillStyle = '#388E3C';
    for (let i = 0; i < this.width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, this.height - 40);
      ctx.lineTo(i + 10, this.height - 50);
      ctx.lineTo(i + 20, this.height - 40);
      ctx.fill();
    }
  }
  
  showStats() {
    // 显示统计弹窗
    console.log('显示统计');
  }
}

module.exports = HomeScene;
