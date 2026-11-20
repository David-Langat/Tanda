/**
 * GYRO MAZE 300 - Mobile Gyroscope Controller Logic
 */

const BALL_COLORS = [
  "#00e5ff", "#ff2a5f", "#00ff88", "#ffbe0b",
  "#b026ff", "#ff6600", "#ffffff", "#ff0077"
];

class PlayerController {
  constructor() {
    this.ws = null;
    this.player = null;
    this.selectedColorIdx = 0;
    this.isGyroActive = true;

    // Gyroscope tracking
    this.hasGyroHardware = false;
    this.baseBeta = 35.0; // Standard comfortable resting angle (degrees)
    this.tiltX = 0.0;
    this.tiltY = 0.0;

    // Touchpad fallback
    this.isTouching = false;
    this.touchStartX = 0;
    this.touchStartY = 0;

    // DOM Elements
    this.joinScreen = document.getElementById('join-screen');
    this.gameScreen = document.getElementById('game-screen');
    this.gameOverScreen = document.getElementById('game-over-screen');

    this.marble = document.getElementById('level-marble');
    this.disc = document.getElementById('level-disc');
    this.readoutX = document.getElementById('readout-x');
    this.readoutY = document.getElementById('readout-y');

    this.ctrlTimer = document.getElementById('ctrl-timer');
    this.ctrlRank = document.getElementById('ctrl-rank');
    this.progFill = document.getElementById('prog-fill-bar');
    this.progText = document.getElementById('prog-pct-text');
    this.hudStatus = document.getElementById('hud-racer-status');
    this.warpBanner = document.getElementById('warp-banner');
    this.finishedBanner = document.getElementById('finished-banner');
    this.hasTriggeredFinish = false;

    this.initColorSwatches();
    this.initTouchControls();
    this.loadSavedName();

    // Loop for sending tilt input to server at 15 Hz
    setInterval(() => this.sendTiltInput(), 66);
  }

  loadSavedName() {
    const saved = localStorage.getItem('racer_callsign');
    if (saved) {
      document.getElementById('player-name-input').value = saved;
    }
  }

  initColorSwatches() {
    const swatches = document.querySelectorAll('.swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        this.selectedColorIdx = parseInt(swatch.getAttribute('data-idx'), 10);
      });
    });
  }

  async setupGyroscope() {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', (e) => this.handleDeviceOrientation(e));
          this.hasGyroHardware = true;
          return true;
        }
      } catch (err) {
        console.warn('Gyro permission prompt error:', err);
      }
    } else if ('ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', (e) => this.handleDeviceOrientation(e));
      this.hasGyroHardware = true;
      return true;
    }

    // If gyro is unavailable, automatically enable Touchpad Mode
    this.isGyroActive = false;
    this.updateModeButtonUI();
    return false;
  }

  handleDeviceOrientation(event) {
    if (!this.isGyroActive || this.isTouching) return;

    const gamma = event.gamma; // Left-Right: -90 to +90
    const beta = event.beta;   // Front-Back: -180 to +180

    if (gamma === null || beta === null) return;
    this.hasGyroHardware = true;

    // Relative to calibrated baseline
    const rawX = gamma;
    const rawY = beta - this.baseBeta;

    // Apply 2.5 degree deadzone to prevent resting drift
    const deadzone = 2.5;
    let clampedX = 0.0;
    let clampedY = 0.0;

    if (Math.abs(rawX) > deadzone) {
      clampedX = Math.sign(rawX) * ((Math.abs(rawX) - deadzone) / 30.0);
    }
    if (Math.abs(rawY) > deadzone) {
      clampedY = Math.sign(rawY) * ((Math.abs(rawY) - deadzone) / 30.0);
    }

    this.tiltX = Math.max(-1.0, min(1.0, clampedX));
    this.tiltY = Math.max(-1.0, min(1.0, clampedY));

    this.updateMarbleUI(this.tiltX, this.tiltY);
    this.readoutX.textContent = `${Math.round(rawX)}°`;
    this.readoutY.textContent = `${Math.round(rawY)}°`;
  }

  recalibrate() {
    // Record current pitch as baseline
    this.baseBeta = 35.0; // Default reset
    this.hudStatus.textContent = 'CALIBRATED!';
    setTimeout(() => {
      this.hudStatus.textContent = this.isGyroActive ? 'GYRO ACTIVE' : 'TOUCHPAD ACTIVE';
    }, 1200);

    window.sfx.playWallClack();
    if (navigator.vibrate) navigator.vibrate(20);
  }

  toggleMode() {
    this.isGyroActive = !this.isGyroActive;
    this.updateModeButtonUI();
    window.sfx.playWallClack();
  }

  updateModeButtonUI() {
    const btn = document.getElementById('btn-mode-toggle');
    if (this.isGyroActive) {
      btn.textContent = '📱 GYROSCOPE';
      btn.classList.add('active');
      this.hudStatus.textContent = 'GYRO ACTIVE (TILT PHONE)';
    } else {
      btn.textContent = '🕹️ TOUCH PAD';
      btn.classList.remove('active');
      this.hudStatus.textContent = 'DRAG DISC TO TILT';
    }
  }

  initTouchControls() {
    const area = document.getElementById('tilt-pad-area');

    const handleStart = (clientX, clientY) => {
      const rect = this.disc.getBoundingClientRect();
      this.touchCenterX = rect.left + rect.width / 2;
      this.touchCenterY = rect.top + rect.height / 2;
      this.touchRadius = rect.width / 2;
      this.isTouching = true;
      handleMove(clientX, clientY);
    };

    const handleMove = (clientX, clientY) => {
      if (!this.isTouching) return;
      const dx = clientX - this.touchCenterX;
      const dy = clientY - this.touchCenterY;

      // Normalize to radius
      this.tiltX = Math.max(-1.0, min(1.0, dx / (this.touchRadius * 0.85)));
      this.tiltY = Math.max(-1.0, min(1.0, dy / (this.touchRadius * 0.85)));

      this.updateMarbleUI(this.tiltX, this.tiltY);
      this.readoutX.textContent = `${Math.round(this.tiltX * 30)}°`;
      this.readoutY.textContent = `${Math.round(this.tiltY * 30)}°`;
    };

    const handleEnd = () => {
      this.isTouching = false;
      if (!this.isGyroActive) {
        this.tiltX = 0.0;
        this.tiltY = 0.0;
        this.updateMarbleUI(0, 0);
      }
    };

    // Touch events
    area.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    area.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });

    area.addEventListener('touchend', (e) => {
      e.preventDefault();
      handleEnd();
    }, { passive: false });

    // Mouse events (for desktop testing)
    area.addEventListener('mousedown', (e) => {
      handleStart(e.clientX, e.clientY);
      const onMouseMove = (ev) => handleMove(ev.clientX, ev.clientY);
      const onMouseUp = () => {
        handleEnd();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  updateMarbleUI(tx, ty) {
    const maxOffset = 70; // pixels from center
    const mx = tx * maxOffset;
    const my = ty * maxOffset;
    this.marble.style.transform = `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px))`;
  }

  sendTiltInput() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.player) {
      this.ws.send(JSON.stringify({
        type: 'tilt',
        x: Math.round(this.tiltX * 100) / 100,
        y: Math.round(this.tiltY * 100) / 100,
      }));
    }
  }

  connectWS(name) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        type: 'join',
        name: name,
        color_idx: this.selectedColorIdx,
      }));
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
      setTimeout(() => {
        if (this.player) this.connectWS(this.player.name);
      }, 2000);
    };
  }

  handleMessage(msg) {
    if (msg.type === 'welcome') {
      this.player = msg.player;
      localStorage.setItem('racer_callsign', this.player.name);

      // Apply player color to UI
      const color = this.player.color || BALL_COLORS[0];
      document.documentElement.style.setProperty('--player-color', color);
      document.getElementById('hud-player-name').textContent = this.player.name;

      this.joinScreen.style.display = 'none';
      if (msg.phase === 'OVER') {
        this.gameOverScreen.style.display = 'flex';
        this.gameScreen.style.display = 'none';
      } else {
        this.gameScreen.style.display = 'flex';
        this.gameOverScreen.style.display = 'none';
      }
    } else if (msg.type === 'player_tick') {
      this.updateState(msg);
    } else if (msg.type === 'you_warped') {
      this.triggerWarpAlert(msg);
    } else if (msg.type === 'you_finished') {
      this.triggerFinishAlert(msg);
    }
  }

  updateState(msg) {
    const totalSec = Math.max(0, Math.floor(msg.timer));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    this.ctrlTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.ctrlRank.textContent = `#${msg.rank}`;
    this.progFill.style.width = `${msg.progress}%`;
    this.progText.textContent = `${msg.progress}%`;

    // Screen transitions
    if (msg.phase === 'OVER') {
      if (this.gameScreen.style.display !== 'none') {
        this.gameScreen.style.display = 'none';
        this.gameOverScreen.style.display = 'flex';
        document.getElementById('final-rank').textContent = msg.finished ? `#${msg.finish_rank}` : `#${msg.rank}`;
        document.getElementById('final-warps').textContent = msg.warps;
      }
    } else if (msg.phase === 'PLAYING' || msg.phase === 'LOBBY') {
      if (this.gameOverScreen.style.display !== 'none' && this.player) {
        this.gameOverScreen.style.display = 'none';
        this.gameScreen.style.display = 'flex';
        this.finishedBanner.style.display = 'none';
        this.hasTriggeredFinish = false;
      }
    }
  }

  triggerWarpAlert(msg) {
    window.sfx.playWarp();
    if (navigator.vibrate) navigator.vibrate([60, 80, 60]);

    const details = document.getElementById('warp-details');
    details.textContent = `${msg.from} ➔ ${msg.to}`;
    this.warpBanner.style.display = 'flex';

    setTimeout(() => {
      this.warpBanner.style.display = 'none';
    }, 1200);
  }

  triggerFinishAlert(msg) {
    if (this.hasTriggeredFinish) return;
    this.hasTriggeredFinish = true;

    window.sfx.playGoalFanfare();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 150]);

    document.getElementById('finish-rank-text').textContent = `Rank #${msg.rank} in ${msg.time}s!`;
    this.finishedBanner.style.display = 'block';

    setTimeout(() => {
      this.finishedBanner.style.display = 'none';
    }, 3500);
  }
}

// Global functions invoked from HTML
function min(a, b) { return a < b ? a : b; }

window.playerCtrl = new PlayerController();

window.joinGame = async function() {
  const nameInput = document.getElementById('player-name-input');
  const name = nameInput.value.trim() || `Racer-${Math.floor(Math.random() * 90 + 10)}`;
  window.sfx.init();

  // Request gyro permission on user interaction
  await window.playerCtrl.setupGyroscope();
  window.playerCtrl.connectWS(name);
};

window.quickRandomName = function() {
  const prefixes = ['Vortex', 'Apex', 'Nova', 'Bolt', 'Titan', 'Raptor', 'Zenith', 'Flash', 'Onyx', 'Cosmo'];
  const name = `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${Math.floor(Math.random() * 90 + 10)}`;
  document.getElementById('player-name-input').value = name;
};

window.recalibrateGyro = function() {
  window.playerCtrl.recalibrate();
};

window.toggleControlMode = function() {
  window.playerCtrl.toggleMode();
};
