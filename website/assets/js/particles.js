/**
 * Quchen Radio 官网 - 粒子背景动画
 * 轻量级 Canvas 粒子系统,营造星河氛围
 */
(function () {
  'use strict';

  const canvas = document.getElementById('bg-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W = 0;
  let H = 0;
  let particles = [];
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let rafId = 0;
  let lastFrame = 0;
  let mouseX = -9999;
  let mouseY = -9999;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CONFIG = {
    count: 60,            // 粒子数量
    maxSize: 1.6,         // 最大半径
    minSize: 0.4,         // 最小半径
    maxSpeed: 0.25,       // 最大速度
    linkDistance: 130,    // 连线最大距离
    linkOpacity: 0.10,    // 连线最大不透明度
    particleColor: '212, 165, 116',  // RGB(与 accent 同色)
    mouseRepel: 80,       // 鼠标排斥距离
  };

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 根据屏幕尺寸调整粒子数
    const area = W * H;
    const base = Math.max(40, Math.min(110, Math.floor(area / 16000)));
    CONFIG.count = base;
    initParticles();
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < CONFIG.count; i++) {
      const size = rand(CONFIG.minSize, CONFIG.maxSize);
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: rand(-CONFIG.maxSpeed, CONFIG.maxSpeed),
        vy: rand(-CONFIG.maxSpeed, CONFIG.maxSpeed),
        r: size,
        baseOpacity: rand(0.25, 0.75),
        opacity: 0,
        twinkle: rand(0, Math.PI * 2),
        twinkleSpeed: rand(0.005, 0.018),
      });
    }
  }

  function update(dt) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      // 边界回弹
      if (p.x < -10) p.x = W + 10;
      else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      else if (p.y > H + 10) p.y = -10;
      // 闪烁
      p.twinkle += p.twinkleSpeed;
      p.opacity = p.baseOpacity * (0.6 + 0.4 * Math.sin(p.twinkle));
      // 鼠标排斥
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const distSq = dx * dx + dy * dy;
      if (distSq < CONFIG.mouseRepel * CONFIG.mouseRepel) {
        const dist = Math.sqrt(distSq) || 1;
        const force = (CONFIG.mouseRepel - dist) / CONFIG.mouseRepel;
        p.x += (dx / dist) * force * 1.2;
        p.y += (dy / dist) * force * 1.2;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 粒子
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${CONFIG.particleColor}, ${p.opacity})`;
      ctx.fill();
      // 光晕
      if (p.r > 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        grad.addColorStop(0, `rgba(${CONFIG.particleColor}, ${p.opacity * 0.3})`);
        grad.addColorStop(1, `rgba(${CONFIG.particleColor}, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
    // 连线
    const linkDistSq = CONFIG.linkDistance * CONFIG.linkDistance;
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < linkDistSq) {
          const dist = Math.sqrt(distSq);
          const opacity = (1 - dist / CONFIG.linkDistance) * CONFIG.linkOpacity;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(${CONFIG.particleColor}, ${opacity})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  function loop(now) {
    if (!lastFrame) lastFrame = now;
    const dt = now - lastFrame;
    lastFrame = now;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (reducedMotion) {
      // 静态背景,只画一帧
      draw();
      return;
    }
    if (!rafId) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  // 鼠标位置跟踪
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    mouseX = -9999;
    mouseY = -9999;
  });

  // 页面可见性
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  // 防抖 resize
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      stop();
      resize();
      start();
    }, 200);
  });

  // 初始化
  resize();
  start();
})();
