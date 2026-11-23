'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AlbumArt from '../../../components/AlbumArt.jsx'
import { album, getAdjacentTrack, getTrack, tracks } from '../../../data/tracks.js'
import { formatTime, parseTimeToSeconds, PLACEHOLDER_DURATION } from '../../../utils/time.js'
import './TrackPage.css'

const TIMESTAMP_TAG = /<timestamp>(\d{1,2}:\d{2})<\/timestamp>/g

// Splits "about" text on <timestamp>m:ss</timestamp> tags into plain-text
// and timestamp segments. Pure parsing — no refs or side effects — so it's
// safe to call during render; the timestamp segments are turned into
// clickable seek buttons where this is rendered.
function splitAboutText(text) {
  const segments = []
  let lastIndex = 0
  let match

  TIMESTAMP_TAG.lastIndex = 0
  while ((match = TIMESTAMP_TAG.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'timestamp', value: match[1] })
    lastIndex = TIMESTAMP_TAG.lastIndex
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

function TrackPlayer({ trackId }) {
  const router = useRouter()
  const track = getTrack(trackId)
  const index = tracks.findIndex((t) => String(t.id) === String(trackId))

  const audioRef = useRef(null)
  const scrubbingRef = useRef(false)
  const scrubEndTimeoutRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [unavailable, setUnavailable] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)

  // The component is *meant* to remount fresh per track (it's keyed by
  // trackId one level up), but Next's client-navigation model doesn't
  // always tear the instance down — sometimes new props just flow into the
  // same instance. Reset playback state during render (React's documented
  // pattern for "adjust state when a prop changes") whenever trackId
  // doesn't match what we last rendered for, so the UI can never show a
  // stale position/duration from the previous song either way.
  const [renderedTrackId, setRenderedTrackId] = useState(trackId)
  if (trackId !== renderedTrackId) {
    setRenderedTrackId(trackId)
    setIsPlaying(false)
    setIsLoading(false)
    setProgress(0)
    setDuration(0)
    setUnavailable(false)
  }

  useEffect(() => {
    const audio = audioRef.current

    // If the browser already has this file cached (e.g. revisiting a track),
    // 'loadedmetadata' can fire before this effect/the onLoadedMetadata prop
    // even attaches, so the event is missed and duration gets stuck at 0
    // (scrubber stuck disabled). Catch up here in case metadata is already in.
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration)
    }

    // react-router's navigate(..., { state }) has no Next.js equivalent, so
    // the "should autoplay" flag travels as a ?autoplay=1 query param instead
    // — read directly from the URL here (client-only, never during render)
    // rather than via useSearchParams, to avoid any SSR/hydration mismatch.
    const autoplay = new URLSearchParams(window.location.search).get('autoplay') === '1'
    if (autoplay) {
      // A rejected autoplay here just means the browser blocked it pending
      // a direct user gesture — not that the track is actually broken, so
      // stay quiet and let the user press play themselves. The scrubber's
      // loading pulse is handled reactively by onWaiting/onPlaying below.
      audio?.play().catch(() => {})
    }

    return () => {
      // Whether this is a real unmount (track change remounted the
      // component) or just a prop update ahead of the next track's effect
      // run, the previous track's audio should never keep playing — on
      // mobile Safari in particular, removing the element alone doesn't
      // reliably stop playback or hand off the lock-screen "Now Playing"
      // session, so pause it explicitly.
      audio?.pause()
    }
  }, [trackId])

  useEffect(() => {
    if (!lyricsOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setLyricsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [lyricsOpen])

  if (!track) {
    return (
      <main className="track-page">
        <p className="track-page__missing">That song doesn&apos;t exist.</p>
        <Link href="/" className="track-page__back-link">
          Back to the album
        </Link>
      </main>
    )
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      setIsLoading(true)
      audio.play().catch(() => {
        setUnavailable(true)
        setIsLoading(false)
      })
    }
  }

  const startScrub = (event) => {
    scrubbingRef.current = true
    if (scrubEndTimeoutRef.current) {
      clearTimeout(scrubEndTimeoutRef.current)
      scrubEndTimeoutRef.current = null
    }
    const audio = audioRef.current
    if (audio) audio.muted = true

    // iOS Safari only lets you drag the thumb itself, not tap anywhere on the
    // track — on a thin mobile scrubber that's hard to hit. Jump straight to
    // wherever the touch landed so a tap anywhere on the bar seeks there.
    if (audio && duration && event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const value = ratio * duration
      setProgress(value)
      audio.currentTime = value
    }
  }

  const endScrub = () => {
    scrubbingRef.current = false
    if (scrubEndTimeoutRef.current) {
      clearTimeout(scrubEndTimeoutRef.current)
      scrubEndTimeoutRef.current = null
    }
    if (audioRef.current) audioRef.current.muted = false
  }

  const handleScrub = (event) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    // Pointer/touch events don't fire reliably on every mobile browser, so
    // dragging can start (or keep going) without a matching pointerdown —
    // treat any input event as proof scrubbing is happening, and fall back
    // to a short timeout to end it if no pointerup/blur ever arrives.
    startScrub()
    const value = Number(event.target.value)
    setProgress(value)
    audio.currentTime = value
    scrubEndTimeoutRef.current = setTimeout(endScrub, 250)
  }

  const seekToTimestamp = (label) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = parseTimeToSeconds(label)
    setIsLoading(true)
    audio.play().catch(() => {
      setUnavailable(true)
      setIsLoading(false)
    })
  }

  const goTo = (direction) => {
    const next = getAdjacentTrack(trackId, direction)
    if (next) router.push(`/track/${next.id}?autoplay=1`)
  }

  const goToPrevious = () => {
    const audio = audioRef.current
    // Matches the familiar player convention: early in a song, "previous"
    // means the previous track; past a few seconds in, it just restarts
    // the current one (and restart is also the fallback with no previous).
    if (audio && audio.currentTime < 3) {
      const previous = getAdjacentTrack(trackId, -1)
      if (previous) {
        router.push(`/track/${previous.id}?autoplay=1`)
        return
      }
    }
    if (audio) {
      audio.currentTime = 0
      setProgress(0)
    }
  }

  const percent = duration ? (progress / duration) * 100 : 0
  const coverImage = track.images?.[0]

  return (
    <main className="track-page">
      <div className="track-page__topbar">
        <Link href="/" className="track-page__back" aria-label="Back to album">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M15 6l-6 6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{album.title}</span>
        </Link>

        <a
          href={`/api/audio/${track.src}`}
          download={`${track.title}.mp3`}
          className="track-page__download"
          aria-label="Download song"
          aria-disabled={unavailable}
          onClick={(e) => {
            if (unavailable) e.preventDefault()
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M12 3v11m0 0l-4-4m4 4l4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 19h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </a>
      </div>

      <div className="track-page__layout">
        <div className="track-page__player">
          <div className="track-page__art">
            <AlbumArt
              size="lg"
              video={track.video}
              images={track.images}
              imageInterval={track.imageInterval}
            />
          </div>

          <h1 className="track-page__title">{track.title}</h1>
          <p className="track-page__meta">
            {album.artist} &middot; {album.title}
          </p>

          <audio
            // Keyed by the track's own audio source: if Next ever updates
            // this component in place instead of remounting it on
            // navigation (see the renderedTrackId check above), this still
            // guarantees a genuinely fresh <audio> element — and therefore
            // currentTime back at 0 — whenever the track actually changes.
            key={track.src}
            ref={audioRef}
            src={`/api/audio/${track.src}`}
            preload="metadata"
            onPlay={() => {
              setIsPlaying(true)
              setUnavailable(false)
            }}
            onPlaying={() => setIsLoading(false)}
            onWaiting={() => setIsLoading(true)}
            onPause={() => {
              setIsPlaying(false)
              setIsLoading(false)
            }}
            onEnded={() => {
              setIsPlaying(false)
              goTo(1)
            }}
            onTimeUpdate={(e) => {
              if (!scrubbingRef.current) setProgress(e.currentTarget.currentTime)
            }}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onError={() => {
              setUnavailable(true)
              setIsLoading(false)
            }}
          />

          <div className="track-page__scrubber">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={progress}
              onChange={handleScrub}
              onPointerDown={startScrub}
              onPointerUp={endScrub}
              onPointerCancel={endScrub}
              onBlur={endScrub}
              disabled={!duration}
              style={{ '--percent': `${percent}%` }}
              aria-label="Seek"
              className={isLoading ? 'is-loading' : undefined}
            />
            <div className="track-page__times">
              <span>{formatTime(progress)}</span>
              <span>{duration ? formatTime(duration) : PLACEHOLDER_DURATION}</span>
            </div>
          </div>

          <div className="track-page__controls-bar">
            <div className="track-page__controls">
              <button
                type="button"
                className="track-page__skip"
                onClick={goToPrevious}
                aria-label="Previous song"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M18 6v12M6 12l10-7v14z" fill="currentColor" />
                </svg>
              </button>

              <button
                type="button"
                className="track-page__play"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
                    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M7 4l14 8-14 8z" fill="currentColor" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="track-page__skip"
                onClick={() => goTo(1)}
                disabled={index >= tracks.length - 1}
                aria-label="Next song"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6 6v12M18 12L8 5v14z" fill="currentColor" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              className="track-page__lyrics-trigger"
              onClick={() => setLyricsOpen(true)}
              aria-label="Lyrics"
            >
              <img src="/images/lyrics.png" alt="" aria-hidden="true" />
            </button>
          </div>

          {unavailable && (
            <p className="track-page__notice">Preview not available yet.</p>
          )}
        </div>

        <div className="track-page__info">
          <p className="track-page__static-heading">About this song</p>
          <p className="track-page__about">
            {splitAboutText(track.about).map((segment, i) =>
              segment.type === 'timestamp' ? (
                <button
                  key={`timestamp-${i}`}
                  type="button"
                  className="track-page__timestamp"
                  onClick={() => seekToTimestamp(segment.value)}
                >
                  {segment.value}
                </button>
              ) : (
                <span key={`text-${i}`}>{segment.value}</span>
              ),
            )}
          </p>
        </div>
      </div>

      {lyricsOpen && (
        <div
          className="lyrics-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${track.title} lyrics`}
        >
          {coverImage && (
            <img className="lyrics-overlay__backdrop" src={coverImage} alt="" aria-hidden="true" />
          )}
          <div className="lyrics-overlay__scrim" />

          <div className="lyrics-overlay__topbar">
            <button
              type="button"
              className="lyrics-overlay__close"
              onClick={() => setLyricsOpen(false)}
              aria-label="Close lyrics"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M15 6l-6 6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="lyrics-overlay__now-playing">
              <AlbumArt
                size="sm"
                video={track.video}
                images={track.images}
                imageInterval={track.imageInterval}
              />
              <div className="lyrics-overlay__now-playing-text">
                <p className="lyrics-overlay__now-playing-title">{track.title}</p>
                <p className="lyrics-overlay__now-playing-artist">{album.artist}</p>
              </div>
            </div>
          </div>

          <div className="lyrics-overlay__scroll">
            <p className="lyrics-overlay__lyrics">{track.lyrics}</p>
          </div>

          <div className="lyrics-overlay__player">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={progress}
              onChange={handleScrub}
              onPointerDown={startScrub}
              onPointerUp={endScrub}
              onPointerCancel={endScrub}
              onBlur={endScrub}
              disabled={!duration}
              style={{ '--percent': `${percent}%` }}
              aria-label="Seek"
              className={`lyrics-overlay__scrubber${isLoading ? ' is-loading' : ''}`}
            />
            <div className="lyrics-overlay__times">
              <span>{formatTime(progress)}</span>
              <span>{duration ? formatTime(duration) : PLACEHOLDER_DURATION}</span>
            </div>

            <div className="lyrics-overlay__controls">
              <button
                type="button"
                className="track-page__skip"
                onClick={goToPrevious}
                aria-label="Previous song"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M18 6v12M6 12l10-7v14z" fill="currentColor" />
                </svg>
              </button>

              <button
                type="button"
                className="lyrics-overlay__play"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
                    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M7 4l14 8-14 8z" fill="currentColor" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="track-page__skip"
                onClick={() => goTo(1)}
                disabled={index >= tracks.length - 1}
                aria-label="Next song"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6 6v12M18 12L8 5v14z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default TrackPlayer
