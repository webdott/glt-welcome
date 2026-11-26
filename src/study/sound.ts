// The end-of-session chime: a short bell phrase synthesised locally, plus vibration where supported.
// Ported from Focus Garden's session-sound.
export const RING_SECONDS = 5
const VIBRATION_PATTERN = [600, 200, 600, 200, 600, 200, 600, 200, 600, 200, 1000]

function createRingSamples(sampleRate: number) {
  const samples = new Float32Array(Math.round(sampleRate * RING_SECONDS))
  const phrase = [523.25, 659.25, 783.99, 1046.5]
  const notes = [0, 0.3, 0.6, 0.9, 1.5, 1.8, 2.1, 2.4, 3, 3.3, 3.6, 3.9, 4.35]
  notes.forEach((start, index) => {
    const frequency = phrase[index % phrase.length]
    const first = Math.round(start * sampleRate)
    const last = Math.min(samples.length, first + Math.round(0.9 * sampleRate))
    for (let frame = first; frame < last; frame++) {
      const t = (frame - first) / sampleRate
      const attack = Math.min(1, t / 0.008)
      const release = Math.min(1, (last - frame - 1) / (sampleRate * 0.045))
      const tone =
        Math.sin(2 * Math.PI * frequency * t) * Math.exp(-3.4 * t) +
        0.22 * Math.sin(2 * Math.PI * frequency * 2.01 * t) * Math.exp(-6 * t) +
        0.07 * Math.sin(2 * Math.PI * frequency * 3 * t) * Math.exp(-9 * t)
      samples[frame] += tone * attack * release
    }
  })
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  // Normalise with a little headroom so it never clips.
  if (peak) for (let i = 0; i < samples.length; i++) samples[i] *= 0.98 / peak
  return samples
}

export function createSessionSound() {
  const AudioContextClass: typeof AudioContext | undefined =
    typeof window === 'undefined' ? undefined : window.AudioContext || (window as any).webkitAudioContext
  let context: AudioContext | undefined
  let buffer: AudioBuffer | undefined
  let source: AudioBufferSourceNode | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let onEnd: (() => void) | undefined
  let playing = false

  const vibrate = (pattern: number | number[]) => {
    try {
      return Boolean(navigator.vibrate?.(pattern))
    } catch {
      return false
    }
  }

  function stop() {
    clearTimeout(timeout)
    timeout = undefined
    if (source) {
      source.onended = null
      try {
        source.stop()
      } catch {
        /* already finished */
      }
      source.disconnect()
      source = undefined
    }
    if (playing) vibrate(0)
    playing = false
    const finished = onEnd
    onEnd = undefined
    finished?.()
  }

  /** Browsers only allow audio after a user gesture, so call this from a click. */
  async function unlock() {
    try {
      if (!AudioContextClass) return false
      if (!context || context.state === 'closed') {
        context = new AudioContextClass()
        buffer = undefined
      }
      if (context.state !== 'running') await context.resume()
      return context.state === 'running'
    } catch {
      return false
    }
  }

  function play({ onEnded }: { onEnded?: () => void } = {}) {
    stop()
    let sound = false
    if (context?.state === 'running') {
      try {
        if (!buffer) {
          const samples = createRingSamples(context.sampleRate)
          buffer = context.createBuffer(1, samples.length, context.sampleRate)
          buffer.getChannelData(0).set(samples)
        }
        source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        source.onended = stop
        source.start()
        sound = true
      } catch {
        if (source) {
          source.onended = null
          source.disconnect()
          source = undefined
        }
      }
    }
    const vibration = vibrate([...VIBRATION_PATTERN])
    playing = sound || vibration
    if (playing) {
      onEnd = onEnded
      // Also clean up if the browser suspends audio before the ended event fires.
      timeout = setTimeout(stop, sound ? RING_SECONDS * 1000 + 100 : RING_SECONDS * 1000)
    }
    return { sound, vibration }
  }

  return {
    unlock,
    play,
    stop,
    get playing() {
      return playing
    },
  }
}
