/**
 * Programmatic synthesizer for a premium double-chime notification sound.
 * Uses Web Audio API. Requires zero media assets.
 */
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();

    // Premium Chime: Note 1 (Soft high chime)
    const playNote = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle'; // Gives a soft bell-like quality
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth decay envelope
      gainNode.gain.setValueAtTime(0.12, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Trigger double-chime with high-end luxury chord (e.g. C#6 -> E6 or E5 -> G#5)
    const now = ctx.currentTime;
    playNote(659.25, now, 0.4); // E5
    playNote(830.61, now + 0.08, 0.6); // G#5
  } catch (err) {
    console.warn('AudioContext playback blocked or failed:', err);
  }
}
