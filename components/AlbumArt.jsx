'use client'

import { useEffect, useState } from 'react'
import './AlbumArt.css'

function AlbumArt({
  size = 'md',
  src = '/images/albumcover.JPG',
  video,
  images,
  imageInterval = 0,
  children,
}) {
  const [slideIndex, setSlideIndex] = useState(0)

  useEffect(() => {
    if (!images || images.length < 2) return
    // Warm the browser's cache for every slide up front — without this, each
    // swap has to fetch/decode that image first, so a slow one visibly lingers
    // on screen and eats into the next slide's share of the interval.
    images.forEach((imageSrc) => {
      const preload = new Image()
      preload.src = imageSrc
    })
  }, [images])

  useEffect(() => {
    if (!images || images.length < 2 || !imageInterval) return

    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % images.length)
    }, imageInterval)

    return () => clearInterval(interval)
  }, [images, imageInterval])

  return (
    <div className={`album-art album-art--${size}`}>
      {video ? (
        <video
          className="album-art__image"
          src={video}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : images ? (
        <img src={images[slideIndex]} alt="" className="album-art__image" />
      ) : (
        <img src={src} alt="" className="album-art__image" />
      )}
      {children}
    </div>
  )
}

export default AlbumArt
