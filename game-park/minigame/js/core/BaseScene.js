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
