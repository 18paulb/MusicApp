'use client'

import Link from 'next/link'
import AlbumArt from './AlbumArt.jsx'
import { useAudioDuration } from '../hooks/useAudioDuration.js'
import './TrackRow.css'

function TrackRow({ track, index }) {
  const duration = useAudioDuration(track.src)

  return (
    <Link href={`/track/${track.id}?autoplay=1`} className="track-row">
      <span className="track-row__index">{index + 1}</span>
      <AlbumArt
        video={track.video}
        images={track.images}
        imageInterval={track.imageInterval}
        size="sm"
      />
      <span className="track-row__title">{track.title}</span>
      <span className="track-row__duration">{duration}</span>
      <svg
        className="track-row__chevron"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M9 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  )
}

export default TrackRow
