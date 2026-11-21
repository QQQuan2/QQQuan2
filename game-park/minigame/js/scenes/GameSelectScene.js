// 游戏选择场景 - 选择关卡
const BaseScene = require('../core/BaseScene');
const dataManager = require('../core/DataManager');
const levelSystem = require('../core/LevelSystem');

class GameSelectScene extends BaseScene {
  init() {
    this.gameId = this.params.gameId;
    this.gameData = dataManager.getGameData(this.gameId);
    
    // 游戏信息
    this.gameInfo = this.getGameInfo();
    
    // 创建返回按钮
    this.createBackButton(() => {
      const HomeScene = require('./HomeScene');
      this.game.switchScene(HomeScene);
    });
    
    // 创建关卡按钮
    this.createLevelButtons();
  }
  
  getGameInfo() {
    const games = {
      snake: { name: '贪吃蛇', color: '#8BC34A', desc: '经典像素风，吃掉食物变长！' },
      breakout: { name: '打砖块', color: '#E91E63', desc: '霓虹赛博风，击碎所有砖块！' },
      tetris: { name: '俄罗斯方块', color: '#FF9800', desc: '复古街机风，堆叠消除！' },
      match3: { name: '消消乐', color: '#9C27B0', desc: '糖果缤纷风，三消得分！' },
      g2048: { name: '2048', color: '#00BCD4', desc: '简洁扁平风，合成2048！' },
      shooter: { name: '飞机大战', color: '#FF5722', desc: '卡通可爱风，躲避射击！' },
      memory: { name: '记忆翻牌', color: '#795548', desc: '中国水墨风，翻牌配对！' },
      minesweeper: { name: '扫雷', color: '#607D8B', desc: '极简几何风，找出雷区！' }
    };
    return games[this.gameId] || { name: '未知游戏', color: '#999', desc: '' };
  }
  
  createLevelButtons() {
    const cols = 3;
    const btnSize = 70;
    const gap = 15;
    const startX = (this.width - (cols * btnSize + (cols - 1) * gap)) / 2;
    const startY = 200;
    
    for (let i = 1; i <= 12; i++) {
      const col = (i - 1) % cols;
      const row = Math.floor((i - 1) / cols);
      const x = startX + col * (btnSize + gap);
      const y = startY + row * (btnSize + gap);
      
      const isUnlocked = i <= this.gameData.unlockedLevel;
      const levelConfig = levelSystem.getLevelConfig(i);
      
      this.createLevelButton(x, y, btnSize, i, isUnlocked, levelConfig);
    }
  }
  
  createLevelButton(x, y, size, level, isUnlocked, config) {
    const scene = this;
    const btn = {
      x, y, width: size, height: size, level, isUnlocked, config,
      
      isPointInside(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
      },
      
      onClick: function () {
        if (this.isUnlocked) {
          scene.startGame(this.level);
        }
      },
      
      render(ctx) {
        // 按钮背景
        if (this.isUnlocked) {
          const gradient = ctx.createRadialGradient(
            this.x + this.width/2, this.y + this.height/2, 0,
            this.x + this.width/2, this.y + this.height/2, this.width/2
          );
          gradient.addColorStop(0, this.config.region.color);
          gradient.addColorStop(1, this.darkenColor(this.config.region.color, 20));
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = '#BDC3C7';
        }
        
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // 边框
        ctx.strokeStyle = this.isUnlocked ? '#FFFFFF' : '#95A5A6';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 等级数字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.level, this.x + this.width/2, this.y + this.height/2 - 5);
        
        // 地区图标
        ctx.font = '16px Arial';
        ctx.fillText(this.config.region.icon, this.x + this.width/2, this.y + this.height/2 + 15);
        
        // 锁定图标
        if (!this.isUnlocked) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath();
          ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '20px Arial';
          ctx.fillText('🔒', this.x + this.width/2, this.y + this.height/2);
        }
      },
      
      darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
      }
    };
    
    this.buttons.push(btn);
  }
  
  startGame(level) {
    const config = levelSystem.getLevelConfig(level);
    const gameScenes = {
      snake: './games/SnakeScene',
      breakout: './games/BreakoutScene',
      tetris: './games/TetrisScene',
      match3: './games/Match3Scene',
      g2048: './games/Scene2048',
      shooter: './games/ShooterScene',
      memory: './games/MemoryScene',
      minesweeper: './games/MinesweeperScene'
    };
    
    const SceneClass = require(gameScenes[this.gameId]);
    this.game.switchScene(SceneClass, { 
      gameId: this.gameId, 
      level: level,
      levelConfig: config
    });
  }
  
  render(ctx) {
    // 背景
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, this.gameInfo.color);
    gradient.addColorStop(1, '#2C3E50');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 绘制返回按钮
    this.buttons[0].render(ctx);
    
    // 标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.gameInfo.name, this.width / 2, 80);
    
    // 描述
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '14px Arial';
    ctx.fillText(this.gameInfo.desc, this.width / 2, 105);
    
    // 进度信息
    ctx.fillStyle = '#FFD700';
    ctx.font = '16px Arial';
    ctx.fillText(`⭐ 总星星: ${this.gameData.totalStars}  |  最高分: ${this.gameData.highScore}`, this.width / 2, 135);
    
    // 提示文字
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px Arial';
    ctx.fillText('点击关卡开始游戏', this.width / 2, 170);
    
    // 绘制关卡按钮
    for (let i = 1; i < this.buttons.length; i++) {
      this.buttons[i].render(ctx);
    }
  }
}

module.exports = GameSelectScene;
