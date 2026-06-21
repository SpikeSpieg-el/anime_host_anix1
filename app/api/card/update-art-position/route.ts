import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey || supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

  if (authError || !user) {
    return null
  }

  return { user, supabaseAdmin }
}

export async function POST(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { uniqueId, artPosition } = body

    if (!uniqueId || !artPosition || typeof artPosition.x !== 'number' || typeof artPosition.y !== 'number') {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
    }

    const { data: card, error: cardError } = await supabaseAdmin
      .from('user_cards')
      .select('id, user_id')
      .eq('unique_id', uniqueId)
      .single()

    if (cardError || card.user_id !== user.id) {
      return NextResponse.json({ success: false, message: "Card not found or not owned" }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_cards')
      .update({ art_position: artPosition })
      .eq('unique_id', uniqueId)

    if (updateError) {
      console.error('[ArtPosition] Error updating:', updateError)
      return NextResponse.json({ success: false, message: "Failed to update art position" }, { status: 500 })
    }

    return NextResponse.json({ success: true, artPosition })
  } catch (error) {
    console.error('[ArtPosition] Unexpected error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
