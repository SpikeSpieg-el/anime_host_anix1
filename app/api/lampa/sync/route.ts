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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  // Update last_used_at
  await supabaseAdmin
    .from('lampa_device_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)

  return data.user_id
}

// POST: Receive watch progress from Lampa plugin
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
    const {
      anime_id,
      title,
      poster,
      episode,
      episodes_total,
      time,
      percent,
      shikimori_id,
    } = body

    if (!anime_id && !shikimori_id) {
      return NextResponse.json(
        { success: false, message: 'anime_id or shikimori_id is required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    // Use shikimori_id as anime_id if anime_id not provided
    const finalAnimeId = String(anime_id || shikimori_id)

    // Determine if anime is completed (watched >= 90% of last episode)
    const isCompleted = percent >= 90 && episodes_total && episode && episode >= episodes_total

    // Upsert into watch_history (same table used by the website)
    const { error } = await supabaseAdmin
      .from('watch_history')
      .upsert({
        user_id: userId,
        anime_id: finalAnimeId,
        title: title || 'Unknown Anime',
        poster: poster || '',
        episode: episode || null,
        episodes_total: episodes_total || null,
        timestamp: Date.now(),
        is_archived: isCompleted || false,
      }, {
        onConflict: 'user_id, anime_id',
      })

    if (error) {
      console.error('Lampa sync error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to sync progress' },
        { status: 500, headers: corsHeaders() }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Progress synced',
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Lampa sync POST error:', error)
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
