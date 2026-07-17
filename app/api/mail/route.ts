import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Card } from '@/app/gacha/types'

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

interface MailItem {
  id: string
  userId: string
  sender: string
  type: 'card_gift' | 'coins' | 'dust' | 'event_reward' | 'message'
  title: string
  body: string | null
  cardPayload: Card | null
  amount: number
  isRead: boolean
  isClaimed: boolean
  expiresAt: string | null
  createdAt: string
  claimedAt: string | null
}

function mapMailRow(row: any): MailItem {
  return {
    id: row.id,
    userId: row.user_id,
    sender: row.sender,
    type: row.type,
    title: row.title,
    body: row.body,
    cardPayload: row.card_payload || null,
    amount: row.amount || 0,
    isRead: row.is_read || false,
    isClaimed: row.is_claimed || false,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
    claimedAt: row.claimed_at || null
  }
}

// GET /api/mail - Get all user mail
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const timeoutPromise = new Promise<NextResponse>((_, reject) =>
      setTimeout(() => reject(new Error('Server timeout')), 25000)
    );

    const result = await Promise.race([
      getMailData(request),
      timeoutPromise
    ]);

    return result;
  } catch (error: any) {
    console.error('[GET] Mail API error:', error);

    if (error.message === 'Server timeout') {
      return NextResponse.json({ error: 'Database timeout' }, { status: 504 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getMailData(request: Request): Promise<NextResponse> {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header' }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    console.log('Authenticated user for mail GET:', user.id)

    const { data, error } = await supabaseAdmin
      .from('user_mail')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get mail error:', error)

      if (error.code === 'PGRST115') {
        return NextResponse.json({ mail: [], warning: 'Table not found' })
      }

      return NextResponse.json({ error: 'Failed to get mail' }, { status: 500 })
    }

    const mail: MailItem[] = (data || []).map(mapMailRow)

    return NextResponse.json({ mail })

  } catch (error) {
    console.error('[getMailData] Error:', error)
    return NextResponse.json({ error: 'Failed to load mail' }, { status: 500 })
  }
}

// POST /api/mail - Claim, mark read, or delete mail
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const timeoutPromise = new Promise<NextResponse>((_, reject) =>
      setTimeout(() => reject(new Error('Server timeout')), 25000)
    );

    const result = await Promise.race([
      handleMailAction(request),
      timeoutPromise
    ]);

    return result;
  } catch (error: any) {
    console.error('[POST] Mail API error:', error);

    if (error.message === 'Server timeout') {
      return NextResponse.json({ error: 'Database timeout' }, { status: 504 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleMailAction(request: Request): Promise<NextResponse> {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header' }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { action, mailId } = body

    if (!action || !mailId) {
      return NextResponse.json({ error: 'Invalid request: action and mailId required' }, { status: 400 })
    }

    if (action === 'mark_read') {
      const { error } = await supabaseAdmin
        .from('user_mail')
        .update({ is_read: true })
        .eq('id', mailId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Mark read error:', error)
        return NextResponse.json({ error: 'Failed to mark mail as read' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from('user_mail')
        .delete()
        .eq('id', mailId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Delete mail error:', error)
        return NextResponse.json({ error: 'Failed to delete mail' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'claim') {
      const { data: mail, error: fetchError } = await supabaseAdmin
        .from('user_mail')
        .select('*')
        .eq('id', mailId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !mail) {
        return NextResponse.json({ error: 'Mail not found' }, { status: 404 })
      }

      if (mail.is_claimed) {
        return NextResponse.json({ error: 'Already claimed' }, { status: 400 })
      }

      const mailType = mail.type as string
      const cardPayload = mail.card_payload as Card | null
      const amount = mail.amount || 0

      const isCardType = mailType === 'card_gift' || (mailType === 'event_reward' && !!cardPayload)
      const isCoinsType = mailType === 'coins' || (mailType === 'event_reward' && !cardPayload && amount > 0)
      const isDustType = mailType === 'dust'

      if (isCardType && cardPayload) {
        let uniqueId = cardPayload.uniqueId
        let serialId = cardPayload.serialId || cardPayload.characterId.toString()

        const { data: existingCard } = await supabaseAdmin
          .from('user_cards')
          .select('id')
          .eq('user_id', user.id)
          .eq('unique_id', uniqueId)
          .single()

        if (existingCard) {
          uniqueId = `${cardPayload.uniqueId}-${Date.now()}`
          serialId = `${cardPayload.serialId}-G`
        }

        const { error: insertError } = await supabaseAdmin
          .from('user_cards')
          .insert({
            user_id: user.id,
            unique_id: uniqueId,
            serial_id: serialId,
            name: cardPayload.name,
            anime: cardPayload.anime,
            rarity: cardPayload.rarity,
            image_url: cardPayload.imageUrl,
            original_url: cardPayload.originalUrl,
            fallback_urls: cardPayload.fallbackUrls || [],
            score: cardPayload.score || 0,
            shiki_id: cardPayload.shikiId,
            character_id: cardPayload.characterId,
            stats_hp: cardPayload.stats?.hp || 0,
            stats_atk: cardPayload.stats?.atk || 0,
            stats_def: cardPayload.stats?.def || 0,
            stats_spd: cardPayload.stats?.spd || 0,
            stats_luck: cardPayload.stats?.luck || 0,
            is_main_character: cardPayload.isMainCharacter || false,
            pack_id: cardPayload.packId || null,
            pack_name: cardPayload.packName || null,
            frame_modifier: cardPayload.frameModifier || null,
            coating_modifier: cardPayload.coatingModifier || null,
            is_art_blacklisted: cardPayload.isArtBlacklisted || false,
            image_layers: cardPayload.imageLayers || null,
            art_position: cardPayload.artPosition || null
          })

        if (insertError) {
          console.error('Claim card insert error:', insertError)
          return NextResponse.json({ error: 'Failed to claim card' }, { status: 500 })
        }
      } else if (isCoinsType) {
        const { data: profile, error: fetchError } = await supabaseAdmin
          .from('user_coins')
          .select('coins')
          .eq('id', user.id)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Claim coins fetch error:', fetchError)
          return NextResponse.json({ error: 'Failed to fetch coins balance' }, { status: 500 })
        }

        const currentBalance = profile?.coins || 0
        const newBalance = currentBalance + amount

        const { error: updateError } = await supabaseAdmin
          .from('user_coins')
          .upsert({
            id: user.id,
            coins: newBalance,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (updateError) {
          console.error('Claim coins update error:', updateError)
          return NextResponse.json({ error: 'Failed to add coins' }, { status: 500 })
        }
      } else if (isDustType) {
        const { data: dustRow, error: fetchError } = await supabaseAdmin
          .from('user_dust')
          .select('dust')
          .eq('id', user.id)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Claim dust fetch error:', fetchError)
          return NextResponse.json({ error: 'Failed to fetch dust balance' }, { status: 500 })
        }

        const currentDust = dustRow?.dust || 0
        const newDust = currentDust + amount

        const { error: updateError } = await supabaseAdmin
          .from('user_dust')
          .upsert({
            id: user.id,
            dust: newDust,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (updateError) {
          console.error('Claim dust update error:', updateError)
          return NextResponse.json({ error: 'Failed to add dust' }, { status: 500 })
        }
      }

      const { error: claimError } = await supabaseAdmin
        .from('user_mail')
        .update({
          is_claimed: true,
          is_read: true,
          claimed_at: new Date().toISOString()
        })
        .eq('id', mailId)
        .eq('user_id', user.id)

      if (claimError) {
        console.error('Claim mail update error:', claimError)
        return NextResponse.json({ error: 'Failed to mark mail as claimed' }, { status: 500 })
      }

      const claimedType = isCardType ? 'card_gift' : isCoinsType ? 'coins' : isDustType ? 'dust' : 'message'

      return NextResponse.json({ success: true, claimedType })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('[handleMailAction] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
