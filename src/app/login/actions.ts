'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthState = {
  status: 'idle' | 'sent' | 'error'
  message?: string
}

export async function signInWithOtp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()

  if (!email.includes('@')) {
    return { status: 'error', message: 'Informe um e-mail valido.' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl && process.env.NODE_ENV === 'production') {
    console.error('NEXT_PUBLIC_SITE_URL nao configurada em producao: login desabilitado.')
    return { status: 'error', message: 'Login indisponivel no momento. Tente novamente mais tarde.' }
  }
  const origin = siteUrl ?? 'http://localhost:3000'

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  })

  if (error) {
    return { status: 'error', message: 'Nao foi possivel enviar o link. Tente de novo.' }
  }

  return { status: 'sent' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
