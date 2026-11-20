/**
 * GYRO MAZE 300 - Host Display Controller & 60 FPS Canvas Renderer
 */

const BALL_COLORS = [
  "#00e5ff", "#ff2a5f", "#00ff88", "#ffbe0b",
  "#b026ff", "#ff6600", "#ffffff", "#ff0077"
];

class HostController {
  constructor() {
    this.ws = null;
    this.phase = 'LOBBY';
    this.timer = 120.0;
    this.lastSecond = 120;
    this.lanIp = '127.0.0.1';
    this.port = 8000;

    // Maze Data
    this.maze = null;
    this.gridW = 27;
    this.gridH = 27;
    this.redHoles = [];
    this.startPos = [2.5, 2.5];
    this.goalPos = [24.5, 24.5];

    // Balls & FX
    this.balls = []; // [id, x, y, color_idx, finished, warps, name]
    this.particles = [];
    this.confetti = [];
    this.screenShake = 0;
    this.processedEvents = new Set();

    // DOM Elements
    this.mazeCanvas = document.getElementById('maze-canvas');
    this.mazeCtx = this.mazeCanvas.getContext('2d');
    this.fxCanvas = document.getElementById('fx-canvas');
    this.fxCtx = this.fxCanvas.getContext('2d');
    this.confettiCanvas = document.getElementById('confetti-canvas');
    this.confettiCtx = this.confettiCanvas.getContext('2d');

    this.timerDisplay = document.getElementById('timer-display');
    this.phaseBadge = document.getElementById('phase-badge');
    this.playerCountEl = document.getElementById('player-count');
    this.counterSub = document.getElementById('counter-sub');
    this.tickerFeed = document.getElementById('ticker-feed');
    this.leaderboardList = document.getElementById('leaderboard-list');
    this.finishedTag = document.getElementById('finished-count-tag');
    this.botCountTag = document.getElementById('bot-count-tag');

    this.lobbyModal = document.getElementById('lobby-modal');
    this.victoryModal = document.getElementById('victory-modal');
    this.lobbyCountNum = document.getElementById('lobby-count-num');

    this.initCanvases();
    this.initEventListeners();
    this.connectWS();

    requestAnimationFrame(this.renderLoop.bind(this));
  }

  initCanvases() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.mazeCanvas.parentElement.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width, rect.height) || 760);

    [this.mazeCanvas, this.fxCanvas].forEach(c => {
      c.width = size * dpr;
      c.height = size * dpr;
      c.style.width = `${size}px`;
      c.style.height = `${size}px`;
    });

    this.mazeCtx.scale(dpr, dpr);
    this.fxCtx.scale(dpr, dpr);
    this.canvasSize = size;

    this.confettiCanvas.width = window.innerWidth * dpr;
    this.confettiCanvas.height = window.innerHeight * dpr;
    this.confettiCtx.scale(dpr, dpr);
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.initCanvases());

    document.getElementById('btn-start-match').addEventListener('click', () => this.startRace());
    document.getElementById('btn-lobby-start').addEventListener('click', () => this.startRace());
    document.getElementById('btn-reset-match').addEventListener('click', () => this.resetRace());
    document.getElementById('btn-play-again').addEventListener('click', () => this.resetRace());

    document.getElementById('btn-toggle-sound').addEventListener('click', (e) => {
      const isMuted = window.sfx.toggleMute();
      e.target.textContent = isMuted ? '🔇' : '🔊';
      e.target.classList.toggle('btn-muted', isMuted);
    });

    const btnMusic = document.getElementById('btn-toggle-music');
    if (window.music && !window.music.enabled) {
      btnMusic.textContent = '🔇';
      btnMusic.classList.add('btn-muted');
    }
    btnMusic.addEventListener('click', (e) => {
      if (!window.music) return;
      const enabled = window.music.toggle();
      e.target.textContent = enabled ? '🎵' : '🔇';
      e.target.classList.toggle('btn-muted', !enabled);
    });

    const btnAnnouncer = document.getElementById('btn-toggle-announcer');
    if (window.announcer && !window.announcer.enabled) {
      btnAnnouncer.textContent = '🤐';
      btnAnnouncer.classList.add('btn-muted');
    }
    btnAnnouncer.addEventListener('click', (e) => {
      if (!window.announcer) return;
      const enabled = window.announcer.toggle();
      e.target.textContent = enabled ? '🎙️' : '🤐';
      e.target.classList.toggle('btn-muted', !enabled);
    });

    document.getElementById('btn-bot-menu').addEventListener('click', () => window.toggleBotDialog());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.phase === 'LOBBY' || this.phase === 'OVER') this.startRace();
      } else if (e.key === 's' || e.key === 'S') {
        const isMuted = window.sfx.toggleMute();
        const btn = document.getElementById('btn-toggle-sound');
        btn.textContent = isMuted ? '🔇' : '🔊';
        btn.classList.toggle('btn-muted', isMuted);
      } else if (e.key === 'm' || e.key === 'M') {
        if (!window.music) return;
        const enabled = window.music.toggle();
        const btn = document.getElementById('btn-toggle-music');
        btn.textContent = enabled ? '🎵' : '🔇';
        btn.classList.toggle('btn-muted', !enabled);
      } else if (e.key === 'a' || e.key === 'A') {
        if (!window.announcer) return;
        const enabled = window.announcer.toggle();
        const btn = document.getElementById('btn-toggle-announcer');
        btn.textContent = enabled ? '🎙️' : '🤐';
        btn.classList.toggle('btn-muted', !enabled);
      } else if (e.key === 'b' || e.key === 'B') {
        window.toggleBotDialog();
      }
    });
  }

  connectWS() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'host_init' }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('WS Error:', err);
      }
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connectWS(), 1500);
    };
  }

  handleMessage(msg) {
    if (msg.type === 'host_full_init') {
      this.phase = msg.phase;
      this.timer = msg.timer;
      this.lanIp = msg.lan_ip || window.location.hostname;
      this.tunnelUrl = msg.tunnel_url || null;
      this.port = msg.port || 8000;
      this.maze = msg.maze;
      this.gridH = this.maze.length;
      this.gridW = this.maze[0].length;
      this.redHoles = msg.red_holes || [];
      this.startPos = msg.start_pos || [2.5, 2.5];
      this.goalPos = msg.goal_pos || [24.5, 24.5];

      this.updateJoinURLs();
      this.syncModals();
    } else if (msg.type === 'host_tick') {
      const prevPhase = this.phase;
      this.phase = msg.phase;
      this.timer = msg.timer;
      this.balls = msg.balls || [];

      // Match Start Cue
      if (prevPhase === 'LOBBY' && this.phase === 'PLAYING') {
        if (window.music) window.music.start();
        if (window.announcer) window.announcer.onRaceStart();
      } else if (prevPhase !== 'LOBBY' && this.phase === 'LOBBY') {
        if (window.music) window.music.stop();
        if (window.announcer && window.announcer.synth) window.announcer.synth.cancel();
      }

      // Sound and timer cues during race
      const sec = Math.floor(this.timer);
      if (this.phase === 'PLAYING') {
        if (window.music) window.music.updatePhase(this.timer);

        if (sec !== this.lastSecond) {
          this.lastSecond = sec;
          if (sec <= 10 && sec > 0) window.sfx.playTick(true);
          if (sec === 30 || sec === 10) {
            if (window.announcer) window.announcer.onFinalCountdown(sec);
          }
        }

        // Track live leader change
        if (msg.leaderboard && msg.leaderboard.length > 0 && window.announcer) {
          const leader = msg.leaderboard[0];
          window.announcer.onLeaderChange(leader.name, leader.id);
        }
      }

      // Check events for sounds and FX (processed exactly once in the moment)
      if (msg.events && msg.events.length > 0) {
        msg.events.forEach(evt => {
          if (evt.id && this.processedEvents.has(evt.id)) return;
          if (evt.id) this.processedEvents.add(evt.id);

          if (evt.type === 'warp' && evt.coords) {
            window.sfx.playWarp();
            this.spawnWarpSparks(evt.coords[0], evt.coords[1]);
            if (window.announcer) {
              const isTop = msg.leaderboard && msg.leaderboard[0] && 
                            (msg.leaderboard[0].name === evt.player_name || msg.leaderboard[0].id === evt.player_id);
              window.announcer.onWarp(evt.player_name || 'A racer', evt.hole_name || 'a Red Hole', isTop);
            }
          } else if (evt.type === 'goal' && evt.coords) {
            window.sfx.playGoalFanfare();
            this.spawnGoalFireworks(evt.coords[0], evt.coords[1]);
            if (window.announcer) {
              const rank = evt.rank || (msg.podium ? msg.podium.length : 1);
              if (rank === 1) {
                window.announcer.onFirstPlaceFinish(evt.player_name || 'A racer', evt.finish_time || '45');
              } else if (rank === 2) {
                window.announcer.onSecondPlaceFinish(evt.player_name || 'A racer');
              } else if (rank === 3) {
                window.announcer.onThirdPlaceFinish(evt.player_name || 'A racer');
              }
            }
          }
        });

        if (this.processedEvents.size > 200) {
          this.processedEvents.clear();
        }
      }

      // Match Completion
      if (prevPhase === 'PLAYING' && this.phase === 'OVER') {
        if (window.music) window.music.stop();
        if (window.announcer) window.announcer.onRaceOver(msg.podium);
        window.sfx.playBuzzer();
        setTimeout(() => {
          window.sfx.playGoalFanfare();
          this.triggerConfetti();
        }, 500);
      }

      this.updateHUD(msg);
      this.syncModals();
    }
  }

  updateJoinURLs() {
    let playUrl;
    if (this.tunnelUrl) {
      playUrl = `${this.tunnelUrl}/play`;
    } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      playUrl = `${window.location.protocol}//${window.location.host}/play`;
    } else {
      playUrl = `${window.location.protocol}//${this.lanIp}:${this.port}/play`;
    }

    document.getElementById('lobby-url-display').textContent = playUrl;
    document.getElementById('sidebar-url-text').textContent = playUrl;

    if (window.QRCode) {
      document.getElementById('lobby-qr-svg').innerHTML = QRCode.generateSVG(playUrl, 200);
      document.getElementById('qr-mini').innerHTML = QRCode.generateSVG(playUrl, 44);
    }
  }

  updateHUD(msg) {
    const totalSec = Math.max(0, Math.floor(this.timer));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    this.timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (totalSec <= 15 && this.phase === 'PLAYING') {
      this.timerDisplay.classList.add('timer-urgent');
    } else {
      this.timerDisplay.classList.remove('timer-urgent');
    }

    // Phase Badge
    this.phaseBadge.className = 'phase-badge';
    if (this.phase === 'LOBBY') {
      this.phaseBadge.textContent = 'LOBBY STAGING';
      this.phaseBadge.classList.add('phase-lobby');
    } else if (this.phase === 'PLAYING') {
      this.phaseBadge.textContent = 'RACE IN PROGRESS';
      this.phaseBadge.classList.add('phase-racing');
    } else if (this.phase === 'OVER') {
      this.phaseBadge.textContent = 'RACE FINISHED';
      this.phaseBadge.classList.add('phase-over');
    }

    // Players count
    this.playerCountEl.textContent = msg.total_players || 0;
    this.lobbyCountNum.textContent = msg.total_players || 0;
    this.finishedTag.textContent = `${msg.finished_count || 0} Finished`;

    // Leaderboard
    if (msg.leaderboard && msg.leaderboard.length > 0) {
      this.leaderboardList.innerHTML = msg.leaderboard.map((p, idx) => `
        <div class="lb-row" style="border-left-color: ${p.color};">
          <span class="lb-rank">#${idx + 1}</span>
          <span class="lb-name" style="color: ${p.color};">${p.name}</span>
          ${p.finished 
            ? `<span class="lb-progress lb-finished">FINISHED 🏁</span>` 
            : `<span class="lb-progress">${p.progress}%</span>`}
          <span class="lb-warps" title="Red Hole Teleports">🌀${p.warps}</span>
        </div>
      `).join('');
    }

    // Ticker
    if (msg.ticker) {
      this.tickerFeed.textContent = msg.ticker;
    } else if (msg.events && msg.events.length > 0) {
      this.tickerFeed.textContent = msg.events[msg.events.length - 1].text;
    }

    // Victory Podium populate
    if (this.phase === 'OVER' && msg.podium) {
      if (msg.podium.length > 0) {
        const champ = msg.podium[0];
        document.getElementById('champ-banner').textContent = `${champ.name.toUpperCase()} WINS 1ST PLACE!`;
        document.getElementById('champ-sub').textContent = `Conquered the maze and escaped the Red Holes in ${champ.time}s!`;

        const podiumHtml = msg.podium.slice(0, 3).map((p, idx) => `
          <div class="podium-box">
            <div class="podium-rank rank-${idx + 1}">#${idx + 1}</div>
            <div class="podium-name" style="color: ${p.color};">${p.name}</div>
            <div class="podium-time">${p.time}s</div>
            <div style="font-size: 0.75rem; color: #888;">Warps: ${p.warps}</div>
          </div>
        `).join('');
        document.getElementById('podium-cards').innerHTML = podiumHtml;
      }

      // Void Traveler Award (most warps)
      if (this.balls && this.balls.length > 0) {
        const sortedByWarps = [...this.balls].sort((a, b) => b[5] - a[5]);
        const mostWarped = sortedByWarps[0];
        if (mostWarped && mostWarped[5] > 0) {
          document.getElementById('award-text').textContent = `${mostWarped[6]} was sucked into ${mostWarped[5]} Red Holes!`;
        }
      }
    }
  }

  syncModals() {
    if (this.phase === 'LOBBY') {
      this.lobbyModal.style.display = 'flex';
      this.victoryModal.style.display = 'none';
      document.getElementById('btn-start-match').style.display = 'block';
      document.getElementById('btn-reset-match').style.display = 'none';
    } else if (this.phase === 'PLAYING') {
      this.lobbyModal.style.display = 'none';
      this.victoryModal.style.display = 'none';
      document.getElementById('btn-start-match').style.display = 'none';
      document.getElementById('btn-reset-match').style.display = 'block';
    } else if (this.phase === 'OVER') {
      this.lobbyModal.style.display = 'none';
      this.victoryModal.style.display = 'flex';
      document.getElementById('btn-start-match').style.display = 'none';
      document.getElementById('btn-reset-match').style.display = 'block';
    }
  }

  startRace() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      window.sfx.init();
      if (window.music) window.music.init();
      if (window.announcer) window.announcer.initVoice();
      this.ws.send(JSON.stringify({ type: 'host_start' }));
    }
  }

  resetRace() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (window.music) window.music.stop();
      if (window.announcer && window.announcer.synth) window.announcer.synth.cancel();
      this.ws.send(JSON.stringify({ type: 'host_reset' }));
    }
  }

  // --------------------------------------------------------------------------
  // Particle & FX Generation
  // --------------------------------------------------------------------------
  spawnWarpSparks(x, y) {
    const scale = this.canvasSize / this.gridW;
    const px = x * scale;
    const py = y * scale;

    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 4 + 1.5;
      this.particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: Math.random() * 3 + 1.5,
        color: '#ff0044',
        alpha: 1.0,
        decay: 0.06, // Quick snappy fade
      });
    }
  }

  spawnGoalFireworks(x, y) {
    const scale = this.canvasSize / this.gridW;
    const px = x * scale;
    const py = y * scale;

    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5 + 2;
      this.particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: Math.random() * 3.5 + 2,
        color: '#ffd700',
        alpha: 1.0,
        decay: 0.05,
      });
    }
  }

  triggerConfetti() {
    this.confetti = [];
    const colors = ['#00e5ff', '#ff2a5f', '#00ff88', '#ffbe0b', '#b026ff', '#ffd700', '#ffffff'];
    const w = window.innerWidth;
    for (let i = 0; i < 150; i++) {
      this.confetti.push({
        x: Math.random() * w,
        y: -Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 3,
        size: Math.random() * 10 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 60 FPS Render Loop
  // --------------------------------------------------------------------------
  renderLoop(time) {
    this.renderMaze(time);
    this.renderParticles();
    this.renderConfetti();

    requestAnimationFrame(this.renderLoop.bind(this));
  }

  renderMaze(time) {
    if (!this.maze) return;
    const ctx = this.mazeCtx;
    const size = this.canvasSize;
    const scale = size / this.gridW;
    const nowSec = time * 0.001;

    ctx.clearRect(0, 0, size, size);

    // 1. Draw Maze Floor & Walls
    for (let r = 0; r < this.gridH; r++) {
      for (let c = 0; c < this.gridW; c++) {
        const isWall = this.maze[r][c] === 1;
        const x = c * scale;
        const y = r * scale;

        if (isWall) {
          ctx.fillStyle = '#101628';
          ctx.fillRect(x, y, scale, scale);
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, scale, scale);
        } else {
          ctx.fillStyle = '#0a0d1a';
          ctx.fillRect(x, y, scale, scale);
        }
      }
    }

    // 2. Draw Start Zone (Launchpad)
    const sx = (this.startPos[0] - 1.5) * scale;
    const sy = (this.startPos[1] - 1.5) * scale;
    ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
    ctx.fillRect(sx, sy, scale * 3, scale * 3);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, scale * 3, scale * 3);

    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('LAUNCH', sx + 10, sy + 18);

    // 3. Draw Finish Zone (Golden Portal)
    const gx = this.goalPos[0] * scale;
    const gy = this.goalPos[1] * scale;
    const pulse = 0.5 + 0.5 * Math.sin(nowSec * 5);

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(nowSec * 1.5);

    // Outer golden ring
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 1.2 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating star spokes
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-1.2 * scale, 0);
      ctx.lineTo(1.2 * scale, 0);
      ctx.stroke();
      ctx.rotate(Math.PI / 4);
    }
    ctx.restore();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('FINISH', gx - 20, gy - 1.4 * scale);

    // 4. Draw 8 Red Holes (Swirling Vortex Wormholes)
    this.redHoles.forEach((hole, idx) => {
      const hx = hole.x * scale;
      const hy = hole.y * scale;
      const hRad = 0.65 * scale;

      ctx.save();
      ctx.translate(hx, hy);

      // Deep void core
      const radGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, hRad);
      radGrad.addColorStop(0, '#000000');
      radGrad.addColorStop(0.6, '#3a0010');
      radGrad.addColorStop(1, '#ff0044');

      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(0, 0, hRad, 0, Math.PI * 2);
      ctx.fill();

      // Swirling vortex spiral arms
      ctx.rotate(-nowSec * 3 + idx);
      ctx.strokeStyle = 'rgba(255, 0, 68, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.2) {
        const r = (a / (Math.PI * 2)) * hRad;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.restore();
    });

    // 5. Draw All 300 Balls
    // [id, x, y, color_idx, finished, warps, name]
    const ballScreenRad = 0.32 * scale;

    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i];
      const bx = b[1] * scale;
      const by = b[2] * scale;
      const color = BALL_COLORS[b[3]] || '#00e5ff';
      const isFinished = b[4] === 1;

      ctx.save();

      if (isFinished) {
        // Golden celebration halo
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, ballScreenRad * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ball body
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bx, by, ballScreenRad, 0, Math.PI * 2);
      ctx.fill();

      // Ball highlight
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(bx - ballScreenRad * 0.3, by - ballScreenRad * 0.3, ballScreenRad * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Callsign above ball (shown for top runners or if few balls)
      if (this.balls.length <= 40 || i < 8) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b[6] || '', bx, by - ballScreenRad - 3);
      }

      ctx.restore();
    }
  }

  renderParticles() {
    const ctx = this.fxCtx;
    ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= (p.decay || 0.05);

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;
  }

  renderConfetti() {
    if (this.confetti.length === 0) return;
    const ctx = this.confettiCtx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < this.confetti.length; i++) {
      const c = this.confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      c.rotation += c.rSpeed;

      if (c.y > h) {
        c.y = -20;
        c.x = Math.random() * w;
      }

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate((c.rotation * Math.PI) / 180);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
      ctx.restore();
    }
  }
}

// Global Bot Helper Functions for Dialog
window.setBotCount = function(count) {
  if (window.hostCtrl && window.hostCtrl.ws) {
    window.hostCtrl.ws.send(JSON.stringify({ type: 'host_set_bots', count: count }));
    document.getElementById('bot-count-tag').textContent = `(${count})`;
  }
};

window.clearBots = function() {
  if (window.hostCtrl && window.hostCtrl.ws) {
    window.hostCtrl.ws.send(JSON.stringify({ type: 'host_clear_bots' }));
    document.getElementById('bot-count-tag').textContent = `(0)`;
  }
};

window.toggleBotDialog = function() {
  const dlg = document.getElementById('bot-dialog');
  dlg.style.display = (dlg.style.display === 'none' || dlg.style.display === '') ? 'block' : 'none';
};

window.addEventListener('DOMContentLoaded', () => {
  window.hostCtrl = new HostController();
});
