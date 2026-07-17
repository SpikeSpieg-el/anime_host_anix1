import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export interface BannerCard {
  id: string
  cardPayload: any
  weight: number
  isFeatured: boolean
}

export interface Banner {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  promoImageUrl: string | null
  featuredAnimeIds: number[]
  boostedRarity: string | null
  price: number | null
  color: string | null
  startDate: string | null
  endDate: string | null
  isActive: boolean
  sortOrder: number
  cards: BannerCard[]
  guaranteedCardPayload: any | null
  guaranteedCardPity: number
}

export async function GET() {
  try {
    const timeoutPromise = new Promise<NextResponse>((_, reject) =>
      setTimeout(() => reject(new Error('Server timeout')), 15000)
    )

    const result = await Promise.race([
      getBannersData(),
      timeoutPromise
    ])

    return result
  } catch (error: any) {
    console.error('[GET] Banners API error:', error)

    if (error.message === 'Server timeout') {
      return NextResponse.json({ error: 'Database timeout' }, { status: 504 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getBannersData(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ banners: [] })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data, error } = await supabase
      .from('banners')
      .select(`
        id,
        name,
        description,
        image_url,
        promo_image_url,
        featured_anime_ids,
        boosted_rarity,
        price,
        color,
        start_date,
        end_date,
        is_active,
        sort_order,
        guaranteed_card_payload,
        guaranteed_card_pity,
        banner_cards (
          id,
          card_payload,
          weight,
          is_featured
        )
      `)
      .eq('is_active', true)
      .lte('start_date', 'now()')
      .or('end_date.is.null,end_date.gt.now()')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[getBannersData] Error:', error)

      if (error.code === 'PGRST115') {
        return NextResponse.json({ banners: [] })
      }

      return NextResponse.json({ banners: [] })
    }

    const banners: Banner[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      promoImageUrl: row.promo_image_url || null,
      featuredAnimeIds: row.featured_anime_ids || [],
      boostedRarity: row.boosted_rarity,
      price: row.price,
      color: row.color,
      startDate: row.start_date,
      endDate: row.end_date,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      cards: (row.banner_cards || []).map((c: any) => ({
        id: c.id,
        cardPayload: c.card_payload,
        weight: c.weight,
        isFeatured: c.is_featured
      })),
      guaranteedCardPayload: row.guaranteed_card_payload || null,
      guaranteedCardPity: row.guaranteed_card_pity || 0,
    }))

    return NextResponse.json({ banners })
  } catch (error) {
    console.error('[getBannersData] Error:', error)
    return NextResponse.json({ banners: [] })
  }
}
