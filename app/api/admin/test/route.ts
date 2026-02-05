import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const env = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'exists' : 'missing',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing',
      supabaseServiceKeyPublic: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing',
      adminUsername: process.env.NEXT_PUBLIC_ADMIN_USERNAME ? 'exists' : 'missing',
      adminPassword: process.env.NEXT_PUBLIC_ADMIN_PASSWORD ? 'exists' : 'missing',
    }

    console.log('Environment variables:', env)

    return NextResponse.json({ 
      message: 'Test endpoint',
      environment: env,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
