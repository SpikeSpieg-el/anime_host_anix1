import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const adminAuth = cookieStore.get('admin_auth')?.value
    
    if (adminAuth !== 'true') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: Supabase env vars missing' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false })

    if (profilesError) {
      throw profilesError
    }

    const { data: watchHistory, error: historyError } = await supabase
      .from('watch_history')
      .select('*')
      .order('created_at', { ascending: false })

    if (historyError) {
      throw historyError
    }

    const { data: bookmarks, error: bookmarksError } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false })

    if (bookmarksError) {
      throw bookmarksError
    }

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
        recentHistory: userHistory.slice(0, 5),
        recentBookmarks: userBookmarks.slice(0, 5),
        allHistory: userHistory,
        allBookmarks: userBookmarks
      }
    })

    return NextResponse.json({ users: usersWithStats })

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch users data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
