import { NextRequest, NextResponse } from 'next/server'
import { searchLocations } from '@/lib/geocoding'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || typeof q !== 'string') {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    )
  }

  const query = q.trim()

  if (query.length < 2) {
    return NextResponse.json(
      { error: 'Search query must be at least 2 characters long' },
      { status: 400 }
    )
  }

  if (query.length > 100) {
    return NextResponse.json(
      { error: 'Search query is too long (maximum 100 characters)' },
      { status: 400 }
    )
  }

  try {
    const results = await searchLocations(query, 8)
    return NextResponse.json(
      { results },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Geocoding service unavailable'
    return NextResponse.json(
      { error: message, results: [] },
      { status: 502 }
    )
  }
}
