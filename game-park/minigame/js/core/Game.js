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
