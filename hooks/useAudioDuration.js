import { useEffect, useState } from 'react'
import { formatTime, PLACEHOLDER_DURATION } from '../utils/time.js'

// Reads the real duration off the mp3 file itself. Tracks without an
// audio file yet (the 404s) fall back to the placeholder duration.
export function useAudioDuration(src) {
  const [duration, setDuration] = useState(PLACEHOLDER_DURATION)

  useEffect(() => {
    let cancelled = false
    const audio = new Audio(`/api/audio/${src}`)

    const handleLoaded = () => {
      if (!cancelled) setDuration(formatTime(audio.duration))
    }
    const handleError = () => {
      if (!cancelled) setDuration(PLACEHOLDER_DURATION)
    }

    audio.addEventListener('loadedmetadata', handleLoaded)
    audio.addEventListener('error', handleError)

    return () => {
      cancelled = true
      audio.removeEventListener('loadedmetadata', handleLoaded)
      audio.removeEventListener('error', handleError)
    }
  }, [src])

  return duration
}
