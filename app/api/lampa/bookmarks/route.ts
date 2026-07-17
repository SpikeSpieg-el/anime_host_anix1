import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

async function authenticateDevice(request: Request, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  if (!supabaseAdmin) return null

  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const tokenHash = hashToken(token)

  const { data, error } = await supabaseAdmin
    .from('lampa_device_tokens')
    .select('user_id, is_active')
    .eq('token_hash', tokenHash)
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  await supabaseAdmin
    .from('lampa_device_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)

  return data.user_id
}

// GET: Return user's bookmarks to Lampa plugin
export async function GET(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500, headers: corsHeaders() }
      )
    }

    const userId = await authenticateDevice(request, supabaseAdmin)
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - invalid device token' },
        { status: 401, headers: corsHeaders() }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .select('anime_id, anime_data, is_completed, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Lampa bookmarks GET error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch bookmarks' },
        { status: 500, headers: corsHeaders() }
      )
    }

    return NextResponse.json({
      success: true,
      bookmarks: data || [],
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Lampa bookmarks GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    )
  }
}

// POST: Save a bookmark from Lampa plugin
export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500, headers: corsHeaders() }
      )
    }

    const userId = await authenticateDevice(request, supabaseAdmin)
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - invalid device token' },
        { status: 401, headers: corsHeaders() }
      )
    }

    const body = await request.json()
    const { anime_id, title, poster, shikimori_id, episode, episodes_total } = body

    if (!anime_id && !shikimori_id) {
      return NextResponse.json(
        { success: false, message: 'anime_id or shikimori_id is required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const finalAnimeId = String(anime_id || shikimori_id)

    const animeData = {
      id: finalAnimeId,
      title: title || 'Unknown Anime',
      poster: poster || '',
      episode: episode || null,
      episodesTotal: episodes_total || null,
    }

    const { error } = await supabaseAdmin
      .from('bookmarks')
      .upsert({
        user_id: userId,
        anime_id: finalAnimeId,
        anime_data: animeData,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id, anime_id',
        ignoreDuplicates: true,
      })

    if (error) {
      console.error('Lampa bookmark POST error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to save bookmark' },
        { status: 500, headers: corsHeaders() }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark saved',
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Lampa bookmark POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    )
  }
}

// DELETE: Remove a bookmark from Lampa plugin
export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500, headers: corsHeaders() }
      )
    }

    const userId = await authenticateDevice(request, supabaseAdmin)
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - invalid device token' },
        { status: 401, headers: corsHeaders() }
      )
    }

    const { searchParams } = new URL(request.url)
    const animeId = searchParams.get('anime_id')

    if (!animeId) {
      return NextResponse.json(
        { success: false, message: 'anime_id is required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const { error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .match({ user_id: userId, anime_id: String(animeId) })

    if (error) {
      console.error('Lampa bookmark DELETE error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to remove bookmark' },
        { status: 500, headers: corsHeaders() }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed',
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Lampa bookmark DELETE error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    )
  }
}

// OPTIONS: CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  })
}
