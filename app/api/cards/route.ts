import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Card } from '@/app/gacha/page'

async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  
  // Create Supabase clients
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  // Client for JWT verification
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
  
  // Admin client for database operations
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

  // Verify the JWT token
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

  if (authError || !user) {
    return null
  }

  return { user, supabaseAdmin }
}

// GET /api/cards - Get all user cards
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Добавляем таймаут на сервере
    const timeoutPromise = new Promise<NextResponse>((_, reject) => 
      setTimeout(() => reject(new Error('Server timeout')), 25000)
    );

    const result = await Promise.race([
      getCardsData(request),
      timeoutPromise
    ]);

    return result;
  } catch (error: any) {
    console.error('[GET] Cards API error:', error);
    
    if (error.message === 'Server timeout') {
      return NextResponse.json({ error: 'Database timeout' }, { status: 504 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCardsData(request: Request): Promise<NextResponse> {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header' }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    console.log('Authenticated user for GET:', user.id)

    // Get all user cards
    const { data, error } = await supabaseAdmin
      .from('user_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get cards error:', error)
      
      if (error.code === 'PGRST115') {
        return NextResponse.json({ cards: [], warning: 'Table not found' })
      }

      return NextResponse.json({ error: 'Failed to get cards' }, { status: 500 })
    }

    console.log('[GET] Retrieved cards for user', user.id, ':', data?.length || 0, 'cards')
    

    // Transform database rows to Card objects
    const cards: Card[] = (data || []).map(row => ({
      id: parseInt(row.serial_id, 10) || Date.now(),
      uniqueId: row.unique_id,
      serialId: row.serial_id,
      name: row.name,
      anime: row.anime,
      rarity: row.rarity,
      imageUrl: row.image_url,
      originalUrl: row.original_url,
      fallbackUrls: row.fallback_urls || [],
      score: parseFloat(row.score?.toString() || '0'),
      shikiId: row.shiki_id,
      characterId: row.character_id,
      stats: {
        hp: row.stats_hp,
        atk: row.stats_atk,
        def: row.stats_def,
        spd: row.stats_spd,
        luck: row.stats_luck
      },
      isMainCharacter: row.is_main_character || false,
      packId: row.pack_id || undefined,
      packName: row.pack_name || undefined,
      frameModifier: row.frame_modifier || undefined,
      coatingModifier: row.coating_modifier || undefined,
      isArtBlacklisted: row.is_art_blacklisted || false
    }))

    return NextResponse.json({ cards })

  } catch (error) {
    console.error('[getCardsData] Error:', error)
    return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 })
  }
}

// POST /api/cards - Save a new card
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Добавляем таймаут на сервере
    const timeoutPromise = new Promise<NextResponse>((_, reject) => 
      setTimeout(() => reject(new Error('Server timeout')), 15000)
    );

    const result = await Promise.race([
      saveCardData(request),
      timeoutPromise
    ]);

    return result;
  } catch (error: any) {
    console.error('[POST] Cards API error:', error);
    
    if (error.message === 'Server timeout') {
      return NextResponse.json({ error: 'Database timeout' }, { status: 504 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function saveCardData(request: Request): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: Supabase env vars missing' },
        { status: 500 },
      )
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey || supabaseAnonKey}`
          }
        }
      }
    )

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header:', authHeader ? 'Invalid format' : 'Missing header')
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error details:', { 
        error: authError?.message, 
        code: authError?.code,
        status: authError?.status,
        tokenLength: token.length,
        tokenStart: token.substring(0, 10) + '...'
      })
      return NextResponse.json({ 
        error: 'Unauthorized: Invalid or expired token', 
        details: authError?.message 
      }, { status: 401 })
    }

    console.log('Authenticated user:', user.id)

    const card: Card = await request.json()

    console.log('[saveCardData] Received card data:', {
      uniqueId: card.uniqueId,
      name: card.name,
      frameModifier: card.frameModifier,
      coatingModifier: card.coatingModifier
    })

    // Validate required fields
    if (!card.uniqueId || !card.characterId || !card.name) {
      return NextResponse.json({ error: 'Invalid card data' }, { status: 400 })
    }

    // Check if card with this uniqueId already exists
    console.log('Checking for existing card:', card.uniqueId, 'for user:', user.id)
    const { data: existingCard } = await supabaseAdmin
      .from('user_cards')
      .select('id')
      .eq('user_id', user.id)
      .eq('unique_id', card.uniqueId)
      .single()

    if (existingCard) {
      console.log('Card already exists for user:', card.uniqueId)
      return NextResponse.json({ 
        card, 
        warning: 'Card already exists',
        exists: true 
      })
    }

    // Insert new card
    console.log('Inserting new card:', card.uniqueId)
    const { data, error } = await supabaseAdmin
      .from('user_cards')
      .insert({
        user_id: user.id,
        unique_id: card.uniqueId,
        serial_id: card.serialId || card.characterId.toString(),
        name: card.name,
        anime: card.anime,
        rarity: card.rarity,
        image_url: card.imageUrl,
        original_url: card.originalUrl,
        fallback_urls: card.fallbackUrls || [],
        score: card.score || 0,
        shiki_id: card.shikiId,
        character_id: card.characterId,
        stats_hp: card.stats?.hp || 0,
        stats_atk: card.stats?.atk || 0,
        stats_def: card.stats?.def || 0,
        stats_spd: card.stats?.spd || 0,
        stats_luck: card.stats?.luck || 0,
        is_main_character: card.isMainCharacter || false,
        pack_id: card.packId || null,
        pack_name: card.packName || null,
        frame_modifier: card.frameModifier || null,
        coating_modifier: card.coatingModifier || null,
        is_art_blacklisted: card.isArtBlacklisted || false
      })
      .select()
      .single()

    if (error) {
      console.error('Save card error:', error)
      return NextResponse.json({ error: 'Failed to save card' }, { status: 500 })
    }

    return NextResponse.json({ card, saved: true })

  } catch (error) {
    console.error('[saveCardData] Error:', error)
    return NextResponse.json({ error: 'Failed to save card' }, { status: 500 })
  }
}

// DELETE /api/cards - Delete a card
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    // Добавляем таймаут на сервере
    const timeoutPromise = new Promise<NextResponse>((_, reject) => 
      setTimeout(() => reject(new Error('Server timeout')), 10000)
    );

    const result = await Promise.race([
      deleteCardData(request),
      timeoutPromise
    ]);

    return result;
  } catch (error: any) {
    console.error('[DELETE] Cards API error:', error);
    
    if (error.message === 'Server timeout') {
      return NextResponse.json({ error: 'Database timeout' }, { status: 504 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function deleteCardData(request: Request): Promise<NextResponse> {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header' }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    console.log('Authenticated user for DELETE:', user.id)

    const { uniqueId } = await request.json()

    if (!uniqueId) {
      return NextResponse.json({ error: 'Card uniqueId required' }, { status: 400 })
    }

    console.log('[DELETE] Attempting to delete card:', { 
      userId: user.id, 
      uniqueId,
      timestamp: new Date().toISOString()
    })

    const { error: deleteError } = await supabaseAdmin
      .from('user_cards')
      .delete()
      .eq('user_id', user.id)
      .eq('unique_id', uniqueId)

    if (deleteError) {
      console.error('Delete card error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
    }

    console.log('[DELETE] Card deleted successfully:', { 
      userId: user.id, 
      uniqueId,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[deleteCardData] Error:', error)
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
  }
}
