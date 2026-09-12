import { NextRequest, NextResponse } from 'next/server'
import { getRainViewerMetadata } from '@/lib/rainviewer'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tzParam = searchParams.get('timezone')
  const timezone = tzParam ? tzParam.slice(0, 50) : undefined

  try {
    const metadata = await getRainViewerMetadata(timezone)
    return NextResponse.json(metadata, {
      status: 200,
      headers: {
        // Cache metadata for 3 minutes (180s), allow stale while revalidating for 600s
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600',
      },
    })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve radar metadata'
    return NextResponse.json(
      { error: message },
      { status: 502 }
    )
  }
}
