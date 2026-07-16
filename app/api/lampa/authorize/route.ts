import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
  if (error || !user) return null
  return user
}

// POST: Authorize a PIN code (called by website when user enters PIN)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { pin } = body

    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { success: false, message: 'Invalid PIN format' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Find the pending code
    const { data: codeData, error: findError } = await supabaseAdmin
      .from('lampa_device_codes')
      .select('id, pin, status, expires_at')
      .eq('pin', pin)
      .eq('status', 'pending')
      .single()

    if (findError || !codeData) {
      return NextResponse.json(
        { success: false, message: 'PIN not found or already used' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date(codeData.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, message: 'PIN has expired' },
        { status: 410 }
      )
    }

    // Authorize the code with the user's ID
    const { error: updateError } = await supabaseAdmin
      .from('lampa_device_codes')
      .update({
        user_id: user.id,
        status: 'authorized',
        authorized_at: new Date().toISOString(),
      })
      .eq('pin', pin)
      .eq('status', 'pending')

    if (updateError) {
      console.error('Lampa authorize update error:', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to authorize device' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Device authorized successfully',
    })
  } catch (error) {
    console.error('Lampa authorize POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
