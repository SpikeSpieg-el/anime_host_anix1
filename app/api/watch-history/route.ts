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

// GET - Fetch user's watch history
export async function GET(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    
    const { data, error } = await supabaseAdmin
      .from('watch_history')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Watch history fetch error:', error)
      return NextResponse.json({ success: false, message: "Failed to fetch watch history" }, { status: 500 })
    }

    const history = data?.map((row: any) => ({
      id: String(row.anime_id),
      title: row.title,
      poster: row.poster,
      timestamp: row.timestamp,
      episode: row.episode,
      episodesTotal: row.episodes_total,
      is_archived: row.is_archived === true
    })) || []

    return NextResponse.json({ success: true, history })
  } catch (error) {
    console.error('Watch history GET error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// POST - Add or update watch history
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

    const { error } = await supabaseAdmin.from('watch_history').upsert({
      user_id: user.id,
      anime_id: anime.id,
      title: anime.title,
      poster: anime.poster,
      timestamp: anime.timestamp,
      episode: anime.episode,
      episodes_total: anime.episodesTotal,
      is_archived: anime.is_archived ?? false,
    }, { 
      onConflict: 'user_id, anime_id' 
    })

    if (error) {
      console.error('Watch history upsert error:', error)
      return NextResponse.json({ success: false, message: "Failed to save watch history" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Watch history POST error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// DELETE - Remove watch history items
export async function DELETE(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { anime_ids, clear_all } = body

    if (clear_all) {
      // Clear all history for user
      const { error } = await supabaseAdmin
        .from('watch_history')
        .delete()
        .eq('user_id', user.id)

      if (error) {
        console.error('Watch history clear error:', error)
        return NextResponse.json({ success: false, message: "Failed to clear watch history" }, { status: 500 })
      }
    } else if (anime_ids && Array.isArray(anime_ids)) {
      // Delete specific items
      for (const animeId of anime_ids) {
        await supabaseAdmin
          .from('watch_history')
          .delete()
          .match({ user_id: user.id, anime_id: animeId })
      }
    } else {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Watch history DELETE error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// PATCH - Update watch history (e.g., toggle archive status)
export async function PATCH(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { anime_id, is_archived } = body

    if (!anime_id || typeof is_archived !== 'boolean') {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('watch_history')
      .update({ is_archived })
      .match({ user_id: user.id, anime_id })

    if (error) {
      console.error('Watch history update error:', error)
      return NextResponse.json({ success: false, message: "Failed to update watch history" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Watch history PATCH error:', error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}