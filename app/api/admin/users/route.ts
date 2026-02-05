import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('Environment check:', {
      supabaseUrl: supabaseUrl ? 'exists' : 'missing',
      supabaseServiceKey: supabaseServiceKey ? 'exists' : 'missing',
      serviceKeyType: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'public' : process.env.SUPABASE_SERVICE_ROLE_KEY ? 'private' : 'none'
    })

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables')
      return NextResponse.json(
        { error: 'Server misconfigured: Supabase env vars missing' },
        { status: 500 }
      )
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Test connection first
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (testError) {
      console.error('Database connection test failed:', testError)
      return NextResponse.json(
        { error: 'Database connection failed', details: testError.message },
        { status: 500 }
      )
    }

    console.log('Database connection successful')

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false })

    if (profilesError) {
      console.error('Profiles error:', profilesError)
      throw profilesError
    }

    console.log('Fetched profiles:', profiles?.length || 0)

    // Fetch all watch history
    const { data: watchHistory, error: historyError } = await supabase
      .from('watch_history')
      .select('*')
      .order('created_at', { ascending: false })

    if (historyError) {
      console.error('Watch history error:', historyError)
      throw historyError
    }

    console.log('Fetched watch history:', watchHistory?.length || 0)

    // Fetch all bookmarks
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false })

    if (bookmarksError) {
      console.error('Bookmarks error:', bookmarksError)
      throw bookmarksError
    }

    console.log('Fetched bookmarks:', bookmarks?.length || 0)

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

    console.log('Processed users:', usersWithStats.length)

    return NextResponse.json({ users: usersWithStats })

  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch users data', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      { status: 500 }
    )
  }
}
