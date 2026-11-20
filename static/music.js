/**
 * GYRO MAZE 300 - Dynamic Layered Cyberpunk Soundtrack Generator
 * 100% procedural Web Audio API synthesis. Zero external audio assets, zero buffering.
 */

class DynamicSoundtrack {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('music_enabled') !== 'false';
    this.isPlaying = false;
    this.bpm = 120;
    this.step = 0;
    this.timerId = null;
    this.masterGain = null;
    this.phase = 1; // 1: Tension, 2: Groove, 3: Overdrive
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.ctx && !this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.35 : 0.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('music_enabled', this.enabled);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(this.enabled ? 0.35 : 0.0, this.ctx.currentTime + 0.2);
    }
    return this.enabled;
  }

  start() {
    this.init();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.step = 0;
    this.phase = 1;
    this.bpm = 120;

    const scheduleNext = () => {
      if (!this.isPlaying) return;
      this.playStep(this.step);
      this.step = (this.step + 1) % 16;

      const secondsPerBeat = 60.0 / this.bpm;
      const stepDuration = (secondsPerBeat / 4) * 1000; // 16th note
      this.timerId = setTimeout(scheduleNext, stepDuration);
    };

    scheduleNext();
  }

  updatePhase(remainingSeconds) {
    if (remainingSeconds > 75.0) {
      // Phase 1: 0:00 - 0:45 (Tension)
      this.phase = 1;
      this.bpm = 120;
    } else if (remainingSeconds > 30.0) {
      // Phase 2: 0:45 - 1:30 (Groove)
      this.phase = 2;
      this.bpm = 126;
    } else {
      // Phase 3: 1:30 - 2:00 (Overdrive)
      this.phase = 3;
      this.bpm = 138;
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  playStep(s) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Kick Drum (Plays on beats 0, 4, 8, 12 in Phase 2 & 3)
    if (this.phase >= 2 && s % 4 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';

      // Pitch drop 150Hz -> 35Hz
      kickOsc.frequency.setValueAtTime(150, now);
      kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

      kickGain.gain.setValueAtTime(0.7, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      kickOsc.connect(kickGain);
      kickGain.connect(this.masterGain);
      kickOsc.start(now);
      kickOsc.stop(now + 0.14);
    }

    // 2. Hi-Hat (Plays on off-beats in Phase 2, every 16th in Phase 3)
    if ((this.phase === 2 && s % 2 === 1) || (this.phase === 3)) {
      const bufferSize = this.ctx.sampleRate * 0.04;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, now);

      const hatGain = this.ctx.createGain();
      hatGain.gain.setValueAtTime(s % 4 === 2 ? 0.35 : 0.18, now);
      hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noise.connect(filter);
      filter.connect(hatGain);
      hatGain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 0.04);
    }

    // 3. Cyberpunk Rolling Bassline (Plays 16th notes throughout D minor: D1, D1, F1, G1...)
    const bassNotes = [36.71, 36.71, 43.65, 36.71, 48.99, 36.71, 43.65, 55.00]; // D1, F1, G1, A1
    const bassFreq = bassNotes[s % bassNotes.length];

    const bassOsc = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    const bassGain = this.ctx.createGain();

    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, now);

    // Filter envelope
    bassFilter.type = 'lowpass';
    const cutoff = this.phase === 3 ? 1400 : (this.phase === 2 ? 800 : 500);
    bassFilter.frequency.setValueAtTime(cutoff, now);
    bassFilter.frequency.exponentialRampToValueAtTime(160, now + 0.12);
    bassFilter.Q.setValueAtTime(5, now);

    bassGain.gain.setValueAtTime(0.4, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.masterGain);

    bassOsc.start(now);
    bassOsc.stop(now + 0.12);

    // 4. Arpeggiated Lead Melody (Plays in Phase 2 & 3 on steps 0, 3, 6, 9, 12, 14)
    if (this.phase >= 2 && [0, 3, 6, 9, 12, 14].includes(s)) {
      const melodyFreqs = [293.66, 349.23, 440.00, 523.25, 587.33]; // D4, F4, A4, C5, D5
      const mFreq = melodyFreqs[(s + (this.phase === 3 ? 2 : 0)) % melodyFreqs.length];

      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(mFreq, now);

      leadGain.gain.setValueAtTime(0, now);
      leadGain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      leadOsc.connect(leadGain);
      leadGain.connect(this.masterGain);

      leadOsc.start(now);
      leadOsc.stop(now + 0.22);
    }
  }
}

window.music = new DynamicSoundtrack();
