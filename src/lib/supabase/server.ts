import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Cliente para Server Components, Server Actions e Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component nao pode escrever cookie. O middleware ja
            // renova a sessao, entao ignorar aqui e seguro.
          }
        },
      },
    },
  )
}
