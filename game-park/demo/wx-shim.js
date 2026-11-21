// 浏览器版 wx 小游戏适配层：只实现本项目用到的 6 个 wx API
// createCanvas / onTouchStart / onTouchMove / onTouchEnd / getStorageSync / setStorageSync
(function () {
  var W = 390, H = 844;
  var canvas = document.getElementById('game');
  canvas.width = W;
  canvas.height = H;

  var handlers = { start: [], move: [], end: [] };

  function toLocal(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = W / rect.width, sy = H / rect.height;
    var pts = (e.changedTouches && e.changedTouches.length ? Array.prototype.slice.call(e.changedTouches)
      : [{ clientX: e.clientX, clientY: e.clientY }]).map(function (t) {
        return {
          clientX: (t.clientX - rect.left) * sx,
          clientY: (t.clientY - rect.top) * sy
        };
      });
    return pts;
  }

  function bind(name, evName) {
    canvas.addEventListener(evName, function (e) {
      e.preventDefault();
      var pts = toLocal(e);
      handlers[name].forEach(function (fn) {
        fn({ touches: pts, changedTouches: pts });
      });
    }, { passive: false });
  }
  bind('start', 'pointerdown');
  bind('move', 'pointermove');
  bind('end', 'pointerup');

  window.wx = {
    createCanvas: function () { return canvas; },
    onTouchStart: function (fn) { handlers.start.push(fn); },
    onTouchMove: function (fn) { handlers.move.push(fn); },
    onTouchEnd: function (fn) { handlers.end.push(fn); },
    getStorageSync: function (k) {
      try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
    },
    setStorageSync: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };
  window.__gameCanvas = canvas; // 测试钩子：E2E 通过像素采样断言场景切换
})();
