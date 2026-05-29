const SOUND_MAP = {
  launch: [520, 0.06],
  wall: [340, 0.035],
  paddle: [460, 0.04],
  block: [620, 0.045],
  switch: [760, 0.09],
  warp: [260, 0.12],
  clear: [880, 0.16],
  fail: [160, 0.22],
  click: [420, 0.035]
};

export class SoundSystem {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.context = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  play(type) {
    if (!this.enabled) return;
    const [frequency, duration] = SOUND_MAP[type] ?? SOUND_MAP.click;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!this.context) {
      this.context = new AudioContextClass();
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.7), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
