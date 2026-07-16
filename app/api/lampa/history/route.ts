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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

// GET: Return user's watch history to Lampa plugin
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
      .from('watch_history')
      .select('anime_id, title, poster, episode, episodes_total, timestamp, is_archived')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Lampa history error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch history' },
        { status: 500, headers: corsHeaders() }
      )
    }

    return NextResponse.json({
      success: true,
      history: data || [],
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Lampa history GET error:', error)
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
