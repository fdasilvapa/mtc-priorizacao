'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Aviso curto depois de salvar. Some sozinho e limpa o parametro da URL, para
 * um refresh nao ressuscitar a mensagem.
 */
export function SavedBanner({ nome }: { nome: string }) {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 3000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <p
      role="status"
      className="mb-3 rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-emerald-300"
    >
      {nome ? `${nome} salvo.` : 'Alteracoes salvas.'}
    </p>
  )
}
