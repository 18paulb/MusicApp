import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTrack, tracks } from '../../../data/tracks.js'
import TrackPlayer from './TrackPlayer.jsx'

export function generateStaticParams() {
  return tracks.map((track) => ({ trackId: String(track.id) }))
}

type Params = { params: Promise<{ trackId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { trackId } = await params
  const track = getTrack(trackId)
  if (!track) return {}

  const title = `${track.title} — that's life`
  const description = `Brandon Paul — ${track.title}`
  const image = track.images?.[0] ?? '/images/albumcover.JPG'

  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default function Page({ params }: Params) {
  // trackId is always known statically (generateStaticParams covers every
  // track), but Cache Components still wants URL-data access wrapped in
  // Suspense to validate the navigation as instant — push the `await`
  // into a child so this component itself never blocks on it.
  return (
    <Suspense fallback={null}>
      <TrackPlayerForParams params={params} />
    </Suspense>
  )
}

async function TrackPlayerForParams({ params }: Params) {
  const { trackId } = await params
  return <TrackPlayer key={trackId} trackId={trackId} />
}
