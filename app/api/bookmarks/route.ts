import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

async function getAuthenticatedUser(request: Request) {
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

// GET - Fetch user's bookmarks
export async function GET(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    
    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .select('anime_data, is_completed, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Bookmarks fetch error:', error)
      return NextResponse.json({ success: false, message: "Failed to fetch bookmarks" }, { status: 500 })
    }

    const bookmarks = data?.map((row: any) => ({
      ...row.anime_data,
      is_completed: row.is_completed || false,
      created_at: row.created_at
    })) || []

    return NextResponse.json({ success: true, bookmarks })
  } catch (error) {
    console.error('Bookmarks GET error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// POST - Add a bookmark
export async function POST(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { anime } = body

    if (!anime || !anime.id) {
      return NextResponse.json({ success: false, message: "Invalid anime data" }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('bookmarks').insert({
      user_id: user.id,
      anime_id: anime.id,
      anime_data: anime,
      created_at: new Date().toISOString()
    })

    if (error && error.code !== '23505') {
      console.error('Bookmark insert error:', error)
      return NextResponse.json({ success: false, message: "Failed to add bookmark" }, { status: 500 })
    }

    // Update account stats
    try {
      const { data: currentStats } = await supabaseAdmin
        .from('account_stats')
        .select('bookmarks_added')
        .eq('user_id', user.id)
        .single()

      const currentCount = currentStats?.bookmarks_added ?? 0
      await supabaseAdmin
        .from('account_stats')
        .upsert({ 
          user_id: user.id, 
          bookmarks_added: currentCount + 1,
          last_updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
    } catch (statsError) {
      console.error('Failed to update bookmark stats:', statsError)
      // Don't fail the request if stats update fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bookmarks POST error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// DELETE - Remove a bookmark
export async function DELETE(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const { searchParams } = new URL(request.url)
    const animeId = searchParams.get('anime_id')

    if (!animeId) {
      return NextResponse.json({ success: false, message: "Missing anime_id" }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .match({ user_id: user.id, anime_id: animeId })

    if (error) {
      console.error('Bookmark delete error:', error)
      return NextResponse.json({ success: false, message: "Failed to remove bookmark" }, { status: 500 })
    }

    // Update account stats
    try {
      const { data: currentStats } = await supabaseAdmin
        .from('account_stats')
        .select('bookmarks_added')
        .eq('user_id', user.id)
        .single()

      const currentCount = currentStats?.bookmarks_added ?? 0
      await supabaseAdmin
        .from('account_stats')
        .upsert({ 
          user_id: user.id, 
          bookmarks_added: Math.max(0, currentCount - 1),
          last_updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
    } catch (statsError) {
      console.error('Failed to update bookmark stats:', statsError)
      // Don't fail the request if stats update fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bookmarks DELETE error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// PATCH - Update bookmark (e.g., toggle completion)
export async function PATCH(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { anime_id, is_completed, anime_data } = body

    if (!anime_id) {
      return NextResponse.json({ success: false, message: "Missing anime_id" }, { status: 400 })
    }

    const updateData: any = {}
    if (typeof is_completed === 'boolean') {
      updateData.is_completed = is_completed
    }
    if (anime_data) {
      updateData.anime_data = anime_data
    }

    const { error } = await supabaseAdmin
      .from('bookmarks')
      .update(updateData)
      .match({ user_id: user.id, anime_id })

    if (error) {
      console.error('Bookmark update error:', error)
      return NextResponse.json({ success: false, message: "Failed to update bookmark" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bookmarks PATCH error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}