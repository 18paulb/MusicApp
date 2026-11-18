export const PLACEHOLDER_DURATION = '2:30'

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function parseTimeToSeconds(label) {
  const [m, s] = label.split(':').map(Number)
  return m * 60 + s
}
