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

export async function GET(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Profile query error:', {
        code: error.code,
        message: error.message,
        userId: user.id
      })

      // PGRST116 = row not found, create profile
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert({ id: user.id, username: user.email })
          .select('*')
          .single()

        if (insertError) {
          console.error('Create profile error:', insertError)
          return NextResponse.json({ success: false, message: 'Failed to create profile' }, { status: 500 })
        }

        return NextResponse.json({ success: true, profile: newProfile })
      }

      return NextResponse.json({ success: false, message: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: data })

  } catch (error) {
    console.error('API GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
