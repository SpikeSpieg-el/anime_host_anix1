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

// GET: List user's linked Lampa devices
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('lampa_device_tokens')
      .select('id, device_id, device_name, created_at, last_used_at, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Lampa devices query error:', error)
      return NextResponse.json({ success: false, message: 'Failed to fetch devices' }, { status: 500 })
    }

    return NextResponse.json({ success: true, devices: data || [] })
  } catch (error) {
    console.error('Lampa devices GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Unlink a Lampa device
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { device_id } = body

    if (!device_id) {
      return NextResponse.json({ success: false, message: 'device_id is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
    }

    const { error } = await supabaseAdmin
      .from('lampa_device_tokens')
      .update({ is_active: false })
      .eq('id', device_id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Lampa device unlink error:', error)
      return NextResponse.json({ success: false, message: 'Failed to unlink device' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Device unlinked' })
  } catch (error) {
    console.error('Lampa devices DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
