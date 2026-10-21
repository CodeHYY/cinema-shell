/* 下载线路竞速：对 GitHub / Pages 镜像 / jsDelivr 三条直链发 HEAD，取最快可达者；全部失败则展开手动线路。零依赖、零服务器。 */
(function () {
  'use strict';
  var TIMEOUT = 6000, UNVERIFIED_PENALTY = 300; // 无法读取状态码（跨域不透明）的线路加 300ms 劣势，让可验证 200 的线路优先

  function probe(src) {
    return new Promise(function (resolve, reject) {
      var t0 = performance.now(), ac = ('AbortController' in window) ? new AbortController() : null;
      var timer = setTimeout(function () { if (ac) ac.abort(); reject(new Error('timeout')); }, TIMEOUT);
      var opt = function (mode) { return { method: 'HEAD', cache: 'no-store', mode: mode, signal: ac ? ac.signal : undefined }; };
      fetch(src.url, opt('cors')).then(function (r) {
        clearTimeout(timer);
        if (r.ok) resolve({ src: src, ms: Math.round(performance.now() - t0), verified: true });
        else reject(new Error('http ' + r.status));
      }).catch(function () {
        // CORS 读不到状态时（如 github.com 的 302），退化成 no-cors 只验证“网络可达”
        fetch(src.url, opt('no-cors')).then(function () {
          clearTimeout(timer);
          var ms = Math.round(performance.now() - t0);
          setTimeout(function () { resolve({ src: src, ms: ms, verified: false }); }, UNVERIFIED_PENALTY);
        }).catch(function (e) { clearTimeout(timer); reject(e); });
      });
    });
  }

  function raceAny(list) { // Promise.any 的手写版（兼容旧 WebView）
    return new Promise(function (resolve, reject) {
      var left = list.length, errs = [];
      if (!left) return reject(new Error('empty'));
      list.forEach(function (p, i) {
        p.then(resolve, function (e) { errs[i] = e; if (--left === 0) reject(errs); });
      });
    });
  }

  function init(box) {
    var urls = JSON.parse(box.getAttribute('data-urls'));
    var names = JSON.parse(box.getAttribute('data-names'));
    var srcs = urls.map(function (u, i) { return { url: u, name: names[i] }; });
    var btn = box.querySelector('[data-role=primary]'), stat = box.querySelector('.dlstat'), det = box.querySelector('details.alt');
    var label0 = btn.textContent, best = null, failed = false, running = null;

    function race() {
      if (running) return running;
      stat.className = 'dlstat'; stat.textContent = '正在测速三条下载线路…';
      running = raceAny(srcs.map(probe)).then(function (r) {
        best = r; stat.className = 'dlstat ok';
        stat.textContent = '已选线路：' + r.src.name + ' · ' + r.ms + ' ms' + (r.verified ? ' · 文件可访问' : ' · 线路可连通');
        btn.href = r.src.url; return r;
      }, function () {
        failed = true; stat.className = 'dlstat bad';
        stat.textContent = '自动测速没有成功（网络拦截，或安装包尚未发布）。请在下方手动选择线路。';
        if (det) det.open = true; return null;
      });
      return running;
    }

    btn.addEventListener('click', function (e) {
      if (best) return; // href 已指向最快线路，正常下载
      if (failed) { e.preventDefault(); if (det) { det.open = true; det.scrollIntoView({ block: 'center' }); } return; }
      e.preventDefault();
      btn.textContent = '测速中…';
      race().then(function (r) {
        btn.textContent = label0;
        if (r) location.assign(r.src.url); else if (det) { det.open = true; det.scrollIntoView({ block: 'center' }); }
      });
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); race(); } }, { rootMargin: '200px' });
      io.observe(box);
    } else { race(); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-dl]'), init);
  });
})();
