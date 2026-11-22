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
      lastPlayTime: Date.now(),
      guideSeen: false
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
