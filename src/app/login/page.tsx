'use client'

import { useActionState } from 'react'
import { signInWithOtp, type AuthState } from './actions'

const INITIAL: AuthState = { status: 'idle' }

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInWithOtp, INITIAL)

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Priorizacao MCOC</h1>
          <p className="text-sm text-neutral-400">
            Entre para ver seu roster priorizado.
          </p>
        </header>

        {state.status === 'sent' ? (
          <p className="rounded-lg bg-emerald-950 p-4 text-center text-sm text-emerald-200">
            Link enviado. Confira sua caixa de entrada.
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50"
            >
              {pending ? 'Enviando...' : 'Enviar link de acesso'}
            </button>
            {state.status === 'error' && (
              <p className="text-sm text-red-400">{state.message}</p>
            )}
          </form>
        )}
      </div>
    </main>
  )
}
