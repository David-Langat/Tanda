/**
 * GYRO MAZE 300 - Autonomous AI Esports Live Announcer
 * Procedural commentary powered by SpeechSynthesis API with zero assets.
 */

class EsportsAnnouncer {
  constructor() {
    this.enabled = localStorage.getItem('announcer_enabled') !== 'false';
    this.synth = window.speechSynthesis || null;
    this.voice = null;
    this.lastSpokenTime = 0;
    this.lastLeaderId = null;
    this.minInterval = 4.5; // Minimum seconds between commentary lines to prevent overlapping
    this.queue = [];
    this.isSpeaking = false;

    this.initVoice();
  }

  initVoice() {
    if (!this.synth) return;
    const setVoice = () => {
      const voices = this.synth.getVoices();
      // Prefer energetic English voices
      const preferred = ['Daniel', 'Samantha', 'Google US English', 'Alex', 'Karen', 'Moira'];
      for (const p of preferred) {
        const found = voices.find(v => v.name.includes(p) && v.lang.startsWith('en'));
        if (found) {
          this.voice = found;
          break;
        }
      }
      if (!this.voice) {
        this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      }
    };

    setVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = setVoice;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('announcer_enabled', this.enabled);
    if (!this.enabled && this.synth) {
      this.synth.cancel();
      this.queue = [];
      this.isSpeaking = false;
    }
    return this.enabled;
  }

  speak(text, priority = false) {
    if (!this.enabled || !this.synth) return;

    const now = Date.now() * 0.001;
    if (this.synth.speaking && now - this.lastSpokenTime > 8) {
      this.synth.cancel();
      this.isSpeaking = false;
    }

    if (!priority && (now - this.lastSpokenTime < this.minInterval || this.isSpeaking)) {
      return;
    }

    if (priority) {
      this.synth.cancel();
      this.queue = [];
      this.isSpeaking = false;
    }

    const utter = new SpeechSynthesisUtterance(text);
    if (this.voice) utter.voice = this.voice;
    utter.rate = 1.15; // Energetic esports pace
    utter.pitch = 1.05;
    utter.volume = 0.9;
    this.currentUtterance = utter;

    utter.onstart = () => {
      this.isSpeaking = true;
      this.lastSpokenTime = Date.now() * 0.001;
    };
    utter.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
    };
    utter.onerror = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
    };

    try {
      this.synth.speak(utter);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Dynamic Game Event Callouts
  // --------------------------------------------------------------------------
  onRaceStart() {
    const lines = [
      "Racers on the grid... Three, two, one... GO GO GO!",
      "Green lights are on! The maze race is officially underway!",
      "And they're off! Three hundred marbles flood into the maze!"
    ];
    this.speak(lines[Math.floor(Math.random() * lines.length)], true);
  }

  onLeaderChange(leaderName, leaderId) {
    if (leaderId === this.lastLeaderId) return;
    this.lastLeaderId = leaderId;

    const lines = [
      `${leaderName} takes the lead!`,
      `New race leader! ${leaderName} is surging ahead!`,
      `${leaderName} pulls out in front!`
    ];
    this.speak(lines[Math.floor(Math.random() * lines.length)]);
  }

  onWarp(racerName, holeName, isTopRacer = false) {
    if (isTopRacer) {
      const topLines = [
        `Huge upset! Race leader ${racerName} just fell into a Red Hole!`,
        `Disaster for the frontrunner! ${racerName} was swallowed by ${holeName}!`
      ];
      this.speak(topLines[Math.floor(Math.random() * topLines.length)], true);
      return;
    }

    const lines = [
      `Down the vortex! ${racerName} got sucked into ${holeName}!`,
      `Red Hole strike! ${racerName} warped across the map!`,
      `${racerName} took a trip through ${holeName}!`
    ];
    this.speak(lines[Math.floor(Math.random() * lines.length)]);
  }

  onCloseToGoal(racerName) {
    const lines = [
      `${racerName} is within striking distance of the finish portal!`,
      `${racerName} can see the checkered flag! Just a few corridors left!`
    ];
    this.speak(lines[Math.floor(Math.random() * lines.length)]);
  }

  onFirstPlaceFinish(racerName, timeStr) {
    const lines = [
      `WE HAVE A WINNER! ${racerName} takes First Place in ${timeStr} seconds!`,
      `Checkered flag! ${racerName} conquers the maze for the championship win!`
    ];
    this.speak(lines[Math.floor(Math.random() * lines.length)], true);
  }

  onSecondPlaceFinish(racerName) {
    this.speak(`Second place locked in by ${racerName}!`);
  }

  onThirdPlaceFinish(racerName) {
    this.speak(`Third place claimed by ${racerName}! The podium is set!`);
  }

  onFinalCountdown(seconds) {
    if (seconds === 30) {
      this.speak("Thirty seconds remaining on the clock! Final scramble for the podium!", true);
    } else if (seconds === 10) {
      this.speak("Ten seconds left! Push for the line!", true);
    }
  }

  onRaceOver(podium) {
    if (podium && podium.length > 0) {
      const champ = podium[0].name;
      this.speak(`Time is up! Race concluded! Congratulations to our champion, ${champ}!`, true);
    } else {
      this.speak("Time is up! The checkered flag has dropped!", true);
    }
  }
}

window.announcer = new EsportsAnnouncer();
