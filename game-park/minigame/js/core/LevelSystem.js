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
