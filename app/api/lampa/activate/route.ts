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

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function generateDeviceToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

// POST: Generate a new PIN code (called by Lampa plugin)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const deviceId = body.device_id || null
    const deviceName = body.device_name || null

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500, headers: corsHeaders() }
      )
    }

    // Clean up expired codes
    await supabaseAdmin
      .from('lampa_device_codes')
      .delete()
      .lt('expires_at', new Date().toISOString())

    // Generate unique PIN
    let pin = generatePin()
    let attempts = 0
    while (attempts < 5) {
      const { data: existing } = await supabaseAdmin
        .from('lampa_device_codes')
        .select('id')
        .eq('pin', pin)
        .eq('status', 'pending')
        .single()
      if (!existing) break
      pin = generatePin()
      attempts++
    }

    const { data, error } = await supabaseAdmin
      .from('lampa_device_codes')
      .insert({
        pin,
        device_id: deviceId,
        device_name: deviceName,
        status: 'pending',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .select('id, pin, expires_at')
      .single()

    if (error) {
      console.error('Lampa activate insert error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to generate PIN' },
        { status: 500, headers: corsHeaders() }
      )
    }

    return NextResponse.json({
      success: true,
      pin: data.pin,
      code_id: data.id,
      expires_at: data.expires_at,
      activate_url: 'https://weeb-x.com/activate',
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Lampa activate POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    )
  }
}

// GET: Check activation status by PIN (called by Lampa plugin, polling)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pin = searchParams.get('pin')

    if (!pin) {
      return NextResponse.json(
        { success: false, message: 'PIN is required' },
        { status: 400, headers: corsHeaders() }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500, headers: corsHeaders() }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('lampa_device_codes')
      .select('id, pin, status, user_id, expires_at, authorized_at')
      .eq('pin', pin)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, status: 'invalid', message: 'PIN not found' },
        { status: 404, headers: corsHeaders() }
      )
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date() && data.status === 'pending') {
      return NextResponse.json({
        success: false,
        status: 'expired',
        message: 'PIN has expired. Please request a new one.',
      }, { headers: corsHeaders() })
    }

    if (data.status === 'authorized' && data.user_id) {
      // Generate a device token for this Lampa instance
      const rawToken = generateDeviceToken()
      const tokenHash = hashToken(rawToken)

      // Get device info from the code record
      const { data: codeData } = await supabaseAdmin
        .from('lampa_device_codes')
        .select('device_id, device_name')
        .eq('pin', pin)
        .single()

      const { error: tokenError } = await supabaseAdmin
        .from('lampa_device_tokens')
        .insert({
          user_id: data.user_id,
          device_id: codeData?.device_id || null,
          device_name: codeData?.device_name || 'Lampa Device',
          token_hash: tokenHash,
        })

      if (tokenError) {
        console.error('Lampa token insert error:', tokenError)
        return NextResponse.json(
          { success: false, status: 'error', message: 'Failed to create device token' },
          { status: 500, headers: corsHeaders() }
        )
      }

      // Mark code as used (delete it)
      await supabaseAdmin
        .from('lampa_device_codes')
        .delete()
        .eq('pin', pin)

      return NextResponse.json({
        success: true,
        status: 'authorized',
        token: rawToken,
        user_id: data.user_id,
      }, { headers: corsHeaders() })
    }

    return NextResponse.json({
      success: true,
      status: data.status,
      expires_at: data.expires_at,
    }, { headers: corsHeaders() })
  } catch (error) {
    console.error('Lampa activate GET error:', error)
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
