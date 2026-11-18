'use client'

import { useEffect, useState } from 'react'
import AlbumArt from '../components/AlbumArt.jsx'
import TrackRow from '../components/TrackRow.jsx'
import { album, tracks } from '../data/tracks.js'
import './AlbumPage.css'

function AlbumPage() {
  const [totalMinutes, setTotalMinutes] = useState(null)

  useEffect(() => {
    let cancelled = false

    Promise.all(
      tracks.map(
        (track) =>
          new Promise((resolve) => {
            const audio = new Audio()
            audio.preload = 'metadata'
            audio.addEventListener('loadedmetadata', () => resolve(audio.duration), {
              once: true,
            })
            audio.addEventListener('error', () => resolve(0), { once: true })
            audio.src = `/api/audio/${track.src}`
          }),
      ),
    ).then((durations) => {
      if (cancelled) return
      const totalSeconds = durations.reduce((sum, d) => sum + (Number.isFinite(d) ? d : 0), 0)
      setTotalMinutes(Math.ceil(totalSeconds / 60))
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="album-page">
      <header className="album-page__header">
        <AlbumArt size="lg" seed={0} />
        <h1 className="album-page__title">{album.title}</h1>
        <p className="album-page__meta">
          {album.artist} &middot; {album.year}
        </p>
      </header>

      <p className="album-page__about">{album.about}</p>

      <section className="album-page__list" aria-label="Tracklist">
        {tracks.map((track, index) => (
          <TrackRow key={track.id} track={track} index={index} />
        ))}
      </section>

      <footer className="album-page__footer">
        <p>
          {tracks.length} songs
          {totalMinutes != null && ` · ${totalMinutes} min`}
        </p>
      </footer>
    </main>
  )
}

export default AlbumPage
