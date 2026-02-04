import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: Supabase env vars missing' },
        { status: 500 }
      )
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false })

    if (profilesError) throw profilesError

    // Fetch all watch history
    const { data: watchHistory, error: historyError } = await supabase
      .from('watch_history')
      .select('*')
      .order('created_at', { ascending: false })

    if (historyError) throw historyError

    // Fetch all bookmarks
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false })

    if (bookmarksError) throw bookmarksError

    // Combine data
    const usersWithStats = profiles.map(profile => {
      const userHistory = watchHistory.filter(item => item.user_id === profile.id)
      const userBookmarks = bookmarks.filter(item => item.user_id === profile.id)
      
      const lastActivity = [
        ...userHistory.map(h => h.created_at),
        ...userBookmarks.map(b => b.created_at),
        profile.updated_at
      ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

      return {
        ...profile,
        watchHistoryCount: userHistory.length,
        bookmarksCount: userBookmarks.length,
        lastActivity,
        recentHistory: userHistory,
        recentBookmarks: userBookmarks,
        allHistory: userHistory,
        allBookmarks: userBookmarks
      }
    })

    return NextResponse.json({ users: usersWithStats })

  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users data' },
      { status: 500 }
    )
  }
}
