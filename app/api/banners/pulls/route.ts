import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return null

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) return null
  return user.id
}

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId(request)
    if (!userId) {
      return NextResponse.json({ pulls: {} })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ pulls: {} })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error } = await supabase
      .from('user_banner_pulls')
      .select('banner_id, pull_count, guaranteed_claimed')
      .eq('user_id', userId)

    if (error) {
      console.error('[banners/pulls] Error:', error)
      return NextResponse.json({ pulls: {} })
    }

    const pulls: Record<string, { pullCount: number; guaranteedClaimed: boolean }> = {}
    for (const row of data || []) {
      pulls[row.banner_id] = {
        pullCount: row.pull_count || 0,
        guaranteedClaimed: row.guaranteed_claimed || false,
      }
    }

    return NextResponse.json({ pulls })
  } catch (error) {
    console.error('[banners/pulls] Unexpected error:', error)
    return NextResponse.json({ pulls: {} })
  }
}
