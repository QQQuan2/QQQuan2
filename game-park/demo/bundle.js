// 本文件由 node tools/build-demo.js 自动生成，请勿手改
// 源码目录：minigame/
const __modules = {};

function __norm(baseDir, p) {
  const stack = baseDir && baseDir !== '.' ? baseDir.split('/') : [];
  for (const seg of p.split('/')) {
    if (seg === '..') stack.pop();
    else if (seg === '.' || seg === '') continue;
    else stack.push(seg);
  }
  return stack.join('/') || '.';
}

function __define(id, dir, factory) {
  __modules[id] = { dir, factory, exports: null, loaded: false };
}

function __get(id) {
  const m = __modules[id];
  if (!m) throw new Error('module not found: ' + id);
  if (!m.loaded) {
    m.loaded = true;
    const module = { exports: {} };
    m.factory(function (p) { return __get(__resolve(p, id)); }, module, module.exports);
    m.exports = module.exports;
  }
  return m.exports;
}

function __resolve(p, fromId) {
  const dir = __modules[fromId].dir;
  let combined = __norm(dir, p);
  if (!__modules[combined]) {
    if (__modules[combined + '.js']) return combined + '.js';
    throw new Error('module not found: ' + p + ' (from ' + fromId + ')');
  }
  return combined;
}
__define("game.js", ".", function (require, module, exports) {
// 游戏乐园 - 主入口
const Game = require('./js/core/Game');
const game = new Game();
game.start();

});
__define("js/core/BaseScene.js", "js/core", function (require, module, exports) {
// 基础场景类
class BaseScene {
  constructor(game, params = {}) {
    this.game = game;
    this.width = game.width;
    this.height = game.height;
    this.ctx = game.ctx;
    this.params = params;
    
    // 场景元素
    this.elements = [];
    this.buttons = [];
    this.animations = [];
    
    // 背景
    this.backgroundColor = '#2C3E50';
    
    this.init();
  }
  
  init() {
    // 子类重写
  }
  
  update(deltaTime, touchEvents) {
    // 处理触摸事件
    this.handleTouchEvents(touchEvents);
    
    // 更新动画
    this.animations = this.animations.filter(anim => {
      anim.update(deltaTime);
      return !anim.isComplete;
    });
    
    // 更新元素
    this.elements.forEach(el => {
      if (el.update) el.update(deltaTime);
    });
  }
  
  render(ctx) {
    // 绘制背景
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 绘制元素
    this.elements.forEach(el => {
      if (el.render) el.render(ctx);
    });
    
    // 绘制按钮
    this.buttons.forEach(btn => btn.render(ctx));
  }
  
  handleTouchEvents(touchEvents) {
    touchEvents.forEach(event => {
      if (event.type === 'end') {
        // 检查按钮点击
        this.buttons.forEach(btn => {
          if (btn.isPointInside(event.x, event.y)) {
            btn.onClick();
          }
        });
      }
    });
  }
  
  // 创建按钮（幂等：render 里重复调用时复用同一按钮，避免每帧堆积）
  createButton(x, y, width, height, text, onClick, options = {}) {
    const existing = this.buttons.find(btn =>
      btn.x === x && btn.y === y && btn.text === text);
    if (existing) {
      existing.onClick = onClick;
      return existing;
    }
    const button = {
      x, y, width, height, text, onClick,
      bgColor: options.bgColor || '#4ECDC4',
      textColor: options.textColor || '#FFFFFF',
      fontSize: options.fontSize || 16,
      borderRadius: options.borderRadius || 8,
      
      isPointInside(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
      },
      
      render(ctx) {
        // 绘制按钮背景
        ctx.fillStyle = this.bgColor;
        this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius);
        ctx.fill();
        
        // 绘制文字
        ctx.fillStyle = this.textColor;
        ctx.font = `bold ${this.fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2);
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
    
    this.buttons.push(button);
    return button;
  }
  
  // 创建返回按钮
  createBackButton(onClick) {
    return this.createButton(20, 20, 80, 40, '← 返回', onClick, {
      bgColor: '#95A5A6',
      fontSize: 14
    });
  }
}

module.exports = BaseScene;

});
__define("js/core/DataManager.js", "js/core", function (require, module, exports) {
// 数据管理器 - 本地存储游戏进度
class DataManager {
  constructor() {
    this.storageKey = 'game_park_data_v1';
    this.data = null;
  }
  
  init() {
    this.data = this.load();
  }
  
  getDefaultData() {
    return {
      totalScore: 0,
      games: {
        snake: { unlockedLevel: 1, highScore: 0, totalStars: 0 },
        breakout: { unlockedLevel: 1, highScore: 0, totalStars: 0 },
        tetris: { unlockedLevel: 1, highScore: 0, totalStars: 0 },
        match3: { unlockedLevel: 1, highScore: 0, totalStars: 0 },
        g2048: { unlockedLevel: 1, highScore: 0, totalStars: 0 },
        shooter: { unlockedLevel: 1, highScore: 0, totalStars: 0 },
        memory: { unlockedLevel: 1, highScore: 0, totalStars: 0 },
        minesweeper: { unlockedLevel: 1, highScore: 0, totalStars: 0 }
      },
      lastPlayTime: Date.now()
    };
  }
  
  load() {
    try {
      const data = wx.getStorageSync(this.storageKey);
      if (data) {
        // 合并默认数据，防止版本更新后缺少字段
        return { ...this.getDefaultData(), ...data };
      }
    } catch (e) {
      console.log('读取存档失败:', e);
    }
    return this.getDefaultData();
  }
  
  save() {
    try {
      wx.setStorageSync(this.storageKey, this.data);
    } catch (e) {
      console.log('保存存档失败:', e);
    }
  }
  
  // 获取游戏数据
  getGameData(gameId) {
    return this.data.games[gameId] || { unlockedLevel: 1, highScore: 0, totalStars: 0 };
  }
  
  // 更新游戏进度
  updateGameProgress(gameId, level, score, stars) {
    const gameData = this.data.games[gameId];
    
    // 解锁下一关
    if (level >= gameData.unlockedLevel) {
      gameData.unlockedLevel = level + 1;
    }
    
    // 更新最高分
    if (score > gameData.highScore) {
      gameData.highScore = score;
    }
    
    // 累计星星
    gameData.totalStars += stars;
    
    // 更新总分数
    this.data.totalScore += score;
    this.data.lastPlayTime = Date.now();
    
    this.save();
  }
  
  // 获取总星星数
  getTotalStars() {
    let total = 0;
    for (const gameId in this.data.games) {
      total += this.data.games[gameId].totalStars;
    }
    return total;
  }
  
  // 获取已解锁游戏数量
  getUnlockedGameCount() {
    let count = 0;
    for (const gameId in this.data.games) {
      if (this.data.games[gameId].unlockedLevel > 1) {
        count++;
      }
    }
    return count;
  }
}

module.exports = new DataManager();

});
__define("js/core/Game.js", "js/core", function (require, module, exports) {
// 游戏乐园 - 核心游戏框架
class Game {
  constructor() {
    // 获取主Canvas
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    
    // 场景管理
    this.currentScene = null;
    this.sceneStack = [];
    
    // 触摸事件
    this.touchEvents = [];
    this.bindEvents();
    
    // 游戏循环
    this.lastTime = 0;
    this.deltaTime = 0;
    this.running = true;
    
    // 全局数据管理器
    this.dataManager = require('./DataManager');
    this.dataManager.init();
    
    // 全局配置
    this.config = {
      colors: {
        primary: '#FF6B6B',
        secondary: '#4ECDC4',
        accent: '#FFE66D',
        dark: '#2C3E50',
        light: '#ECF0F1'
      }
    };
  }
  
  start() {
    // 切换到主页场景
    const HomeScene = require('../scenes/HomeScene');
    this.switchScene(HomeScene);
    this.loop(0);
  }
  
  switchScene(SceneClass, params = {}) {
    this.currentScene = new SceneClass(this, params);
  }
  
  pushScene(SceneClass, params = {}) {
    if (this.currentScene) {
      this.sceneStack.push(this.currentScene);
    }
    this.currentScene = new SceneClass(this, params);
  }
  
  popScene() {
    if (this.sceneStack.length > 0) {
      this.currentScene = this.sceneStack.pop();
    }
  }
  
  bindEvents() {
    wx.onTouchStart((e) => {
      const touch = e.touches[0];
      this.touchEvents.push({ type: 'start', x: touch.clientX, y: touch.clientY });
    });
    wx.onTouchMove((e) => {
      const touch = e.touches[0];
      this.touchEvents.push({ type: 'move', x: touch.clientX, y: touch.clientY });
    });
    wx.onTouchEnd((e) => {
      const touch = e.changedTouches[0];
      this.touchEvents.push({ type: 'end', x: touch.clientX, y: touch.clientY });
    });
  }
  
  loop(timestamp) {
    if (!this.running) return;
    
    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    
    // 限制deltaTime防止大跳跃
    if (this.deltaTime > 100) this.deltaTime = 16;
    
    // 清空画布
    this.ctx.fillStyle = '#2C3E50';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // 更新当前场景
    if (this.currentScene) {
      this.currentScene.update(this.deltaTime, this.touchEvents);
      this.currentScene.render(this.ctx);
    }
    
    // 清空触摸事件
    this.touchEvents = [];
    
    requestAnimationFrame((t) => this.loop(t));
  }
}

module.exports = Game;

});
__define("js/core/LevelSystem.js", "js/core", function (require, module, exports) {
// 关卡系统 - 管理关卡配置、环境效果
class LevelSystem {
  constructor() {
    // 地区配置
    this.regions = [
      { id: 'forest', name: '迷雾森林', color: '#27AE60', icon: '🌲' },
      { id: 'desert', name: '黄金沙漠', color: '#F39C12', icon: '🏜️' },
      { id: 'ocean', name: '深海秘境', color: '#3498DB', icon: '🌊' },
      { id: 'volcano', name: '烈焰火山', color: '#E74C3C', icon: '🌋' },
      { id: 'city', name: '霓虹都市', color: '#9B59B6', icon: '🏙️' },
      { id: 'snow', name: '冰雪王国', color: '#BDC3C7', icon: '❄️' },
      { id: 'garden', name: '梦幻花园', color: '#E91E63', icon: '🌸' },
      { id: 'temple', name: '古刹禅院', color: '#795548', icon: '⛩️' },
      { id: 'sky', name: '云端之上', color: '#00BCD4', icon: '☁️' },
      { id: 'space', name: '星际漫游', color: '#1A237E', icon: '🚀' }
    ];
    
    // 时间配置
    this.times = [
      { id: 'dawn', name: '黎明', bgColor: '#FFECB3', textColor: '#5D4037' },
      { id: 'noon', name: '正午', bgColor: '#E3F2FD', textColor: '#1565C0' },
      { id: 'dusk', name: '黄昏', bgColor: '#FFE0B2', textColor: '#E65100' },
      { id: 'night', name: '深夜', bgColor: '#1A237E', textColor: '#E8EAF6' }
    ];
    
    // 天气配置
    this.weathers = [
      { id: 'sunny', name: '晴朗', effect: 'none', difficultyMod: 1.0 },
      { id: 'rainy', name: '雨天', effect: 'rain', difficultyMod: 1.1 },
      { id: 'snowy', name: '雪天', effect: 'snow', difficultyMod: 1.15 },
      { id: 'foggy', name: '大雾', effect: 'fog', difficultyMod: 1.2 },
      { id: 'stormy', name: '雷暴', effect: 'storm', difficultyMod: 1.25 }
    ];
  }
  
  // 获取关卡配置
  getLevelConfig(level) {
    const regionIndex = (level - 1) % this.regions.length;
    const timeIndex = (level - 1) % this.times.length;
    const weatherIndex = Math.floor((level - 1) / 2) % this.weathers.length;
    
    return {
      level: level,
      region: this.regions[regionIndex],
      time: this.times[timeIndex],
      weather: this.weathers[weatherIndex],
      targetScore: level * 1000,
      timeLimit: Math.max(30, 120 - level * 5), // 随关卡增加时间减少
      difficulty: 1 + (level - 1) * 0.1
    };
  }
  
  // 绘制天气效果
  drawWeatherEffect(ctx, width, height, weather, time) {
    switch (weather.id) {
      case 'rainy':
        this.drawRain(ctx, width, height);
        break;
      case 'snowy':
        this.drawSnow(ctx, width, height);
        break;
      case 'foggy':
        this.drawFog(ctx, width, height);
        break;
      case 'stormy':
        this.drawStorm(ctx, width, height);
        break;
    }
  }
  
  drawRain(ctx, width, height) {
    ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 15);
      ctx.stroke();
    }
  }
  
  drawSnow(ctx, width, height) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  drawFog(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(200, 200, 200, 0.1)');
    gradient.addColorStop(0.5, 'rgba(200, 200, 200, 0.3)');
    gradient.addColorStop(1, 'rgba(200, 200, 200, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  drawStorm(ctx, width, height) {
    // 随机闪电
    if (Math.random() < 0.05) {
      ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
      ctx.fillRect(0, 0, width, height);
    }
    this.drawRain(ctx, width, height);
  }
  
  // 获取天气对游戏的影响
  getWeatherEffect(weatherId) {
    const weather = this.weathers.find(w => w.id === weatherId);
    return weather ? {
      speedMod: weather.id === 'rainy' ? 0.9 : weather.id === 'snowy' ? 0.8 : 1,
      visibilityMod: weather.id === 'foggy' ? 0.7 : 1,
      scoreMod: weather.difficultyMod
    } : { speedMod: 1, visibilityMod: 1, scoreMod: 1 };
  }
}

module.exports = new LevelSystem();

});
__define("js/scenes/GameSelectScene.js", "js/scenes", function (require, module, exports) {
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

});
__define("js/scenes/HomeScene.js", "js/scenes", function (require, module, exports) {
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

});
__define("js/scenes/games/BreakoutScene.js", "js/scenes/games", function (require, module, exports) {
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

});
__define("js/scenes/games/Match3Scene.js", "js/scenes/games", function (require, module, exports) {
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

});
__define("js/scenes/games/MemoryScene.js", "js/scenes/games", function (require, module, exports) {
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

});
__define("js/scenes/games/MinesweeperScene.js", "js/scenes/games", function (require, module, exports) {
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

});
__define("js/scenes/games/Scene2048.js", "js/scenes/games", function (require, module, exports) {
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

});
__define("js/scenes/games/ShooterScene.js", "js/scenes/games", function (require, module, exports) {
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

});
__define("js/scenes/games/SnakeScene.js", "js/scenes/games", function (require, module, exports) {
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

});
__define("js/scenes/games/TetrisScene.js", "js/scenes/games", function (require, module, exports) {
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

});

__get("game.js");
