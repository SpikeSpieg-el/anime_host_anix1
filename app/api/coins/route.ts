import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { STARTING_COINS } from '@/lib/economy'

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

export async function GET(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    
    // Get user's coins
    const { data, error } = await supabaseAdmin
      .from('user_coins')
      .select('coins')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Coins query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: user.id
      })
      
      // PGRST116 = row not found
      if (error.code === 'PGRST116') {
        // Нет записи о балансе — выдаём стартовый бонус (2 000 = 40 круток)
        const { data: newRecord, error: insertError } = await supabaseAdmin
          .from('user_coins')
          .insert({ id: user.id, coins: STARTING_COINS })
          .select('coins')
          .single()

        if (insertError) {
          console.error('Create coins error:', insertError)
          console.error('Insert error details:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            userId: user.id
          })
          
          // Fallback: return default coins if database insert fails
          console.warn('Database insert failed, returning default coins as fallback')
          return NextResponse.json({ 
            success: true,
            coins: STARTING_COINS,
            warning: 'Using default coins due to database error',
            error: insertError.message
          })
        }

        return NextResponse.json({ success: true, coins: newRecord.coins })
      }

      // PGRST115 = relation does not exist (table doesn't exist)
      if (error.code === 'PGRST115') {
        console.warn('user_coins table does not exist, returning default coins')
        return NextResponse.json({ success: true, coins: STARTING_COINS, warning: 'Table not found' })
      }

      console.error('Get coins error:', error)
      return NextResponse.json({ success: false, message: 'Failed to get coins' }, { status: 500 })
    }

    return NextResponse.json({ success: true, coins: data.coins })

  } catch (error) {
    console.error('API GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authData = await getAuthenticatedUser(request)
    if (!authData) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { user, supabaseAdmin } = authData
    const body = await request.json()
    const { operation, amount, coins, refundToken } = body

    // Раньше здесь принимался { coins: <любое число> } — прямая установка баланса
    // по запросу клиента. Это печать монет из консоли браузера, формат удалён.
    void coins

    // Операции: 'spend' (списание за крутку) и 'add' (возврат по одноразовому токену).
    if (!operation) {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
    }

    let result: any

    switch (operation) {
      case 'add':
        // Начисление возможно ТОЛЬКО по одноразовому токену возврата,
        // который сервер выдал при списании (см. economy_refund_tokens).
        // Раньше здесь было обычное сложение: любой авторизованный игрок мог
        // напечатать себе сколько угодно монет одним POST-запросом.
        if (!refundToken || typeof refundToken !== 'string') {
          return NextResponse.json(
            { success: false, message: 'refundToken required' },
            { status: 400 }
          )
        }

        const { data: refundData, error: refundError } = await supabaseAdmin.rpc('economy_redeem_refund', {
          p_user_id: user.id,
          p_token: refundToken,
        })

        if (refundError) {
          console.error('[API Coins] redeem refund:', refundError)
          return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
        }

        const refundResult = refundData as { ok?: boolean; error?: string; amount?: number }
        if (!refundResult?.ok) {
          return NextResponse.json(
            { success: false, message: refundResult?.error || 'refund_rejected' },
            { status: 400 }
          )
        }

        const { data: afterRefund, error: afterRefundError } = await supabaseAdmin
          .from('user_coins')
          .select('coins')
          .eq('id', user.id)
          .single()

        if (afterRefundError) {
          console.error('[API Coins] balance after refund:', afterRefundError)
          return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
        }

        console.log(`[API Coins] Refunded ${refundResult.amount} coins to user ${user.id}`)
        result = {
          success: true,
          newBalance: afterRefund.coins,
          message: `Refunded ${refundResult.amount} coins`,
        }
        break

      case 'spend':
        if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
          return NextResponse.json(
            { success: false, message: 'Amount must be a positive integer' },
            { status: 400 }
          )
        }

        // Списание и возврат делает база под блокировкой строки (economy_spend):
        // раньше это было чтение-вычитание-запись из API, из-за чего два
        // параллельных запроса могли списать монеты дважды.
        const { data: spendData, error: spendError } = await supabaseAdmin.rpc('economy_spend', {
          p_user_id: user.id,
          p_amount: amount,
        })

        if (spendError) {
          console.error('[API Coins] spend:', spendError)
          return NextResponse.json({ success: false, message: "Database error" }, { status: 500 })
        }

        const spendResult = spendData as {
          ok?: boolean
          error?: string
          need?: number
          have?: number
          new_balance?: number
          refund_token?: string
        }

        if (!spendResult?.ok) {
          if (spendResult?.error === 'insufficient_coins') {
            return NextResponse.json(
              { success: false, message: 'Insufficient coins', need: spendResult.need, have: spendResult.have },
              { status: 400 }
            )
          }
          return NextResponse.json({ success: false, message: spendResult?.error || 'spend_rejected' }, { status: 400 })
        }

        console.log(`[API Coins] Spent ${amount} coins from user ${user.id}. New balance: ${spendResult.new_balance}`)
        result = {
          success: true,
          newBalance: spendResult.new_balance,
          message: `Spent ${amount} coins`,
          // Токен возврата: если крутка не выдалась (сеть, пустой набор),
          // клиент сможет вернуть ровно списанную сумму и ровно один раз.
          refundToken: spendResult.refund_token ?? null,
        }
        break

      default:
        return NextResponse.json({ success: false, message: "Invalid operation" }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('API POST error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
