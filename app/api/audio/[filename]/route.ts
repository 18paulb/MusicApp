import { NextResponse } from 'next/server'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { tracks } from '../../../../data/tracks.js'

const BUCKET = process.env.S3_BUCKET_NAME
const REGION = process.env.AWS_REGION
// Once the browser follows the redirect, further range requests (buffering,
// seeking) go straight to this resolved S3 URL, not back through this route
// — so if it expires mid-session, playback just stalls/errors with no way
// to recover without a full reload. An hour comfortably covers a long
// listening session while still not leaking a permanent link to the file.
const EXPIRES_IN_SECONDS = 3600

const s3 = new S3Client({ region: REGION })

// Every mp3 the app ever links to is one of these — never sign a URL for a
// filename that isn't, or this route becomes an open proxy for reading
// anything else in the bucket.
const validFilenames = new Set(tracks.map((track) => track.src))

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params

  if (!validFilenames.has(filename)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: filename }),
    { expiresIn: EXPIRES_IN_SECONDS },
  )

  // Let the browser reuse this redirect for a bit (well under the signed
  // URL's own expiry) so repeated range requests during playback/seeking
  // don't all have to round-trip through this function first.
  return NextResponse.redirect(url, {
    status: 302,
    headers: { 'Cache-Control': `private, max-age=${EXPIRES_IN_SECONDS - 60}` },
  })
}
