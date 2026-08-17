'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Aviso curto depois de salvar. Some sozinho e limpa so o parametro 'salvo'
 * da URL, preservando os demais (filtros), para um refresh nao ressuscitar
 * a mensagem nem descartar filtros que o dono tenha ajustado nesse meio tempo.
 */
export function SavedBanner({ nome }: { nome: string }) {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      next.delete('salvo')
      const query = next.toString()
      router.replace(query ? `/?${query}` : '/')
    }, 3000)
    return () => clearTimeout(t)
  }, [router, params])

  return (
    <p
      role="status"
      className="mb-3 rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-emerald-300"
    >
      {nome ? `${nome} salvo.` : 'Alteracoes salvas.'}
    </p>
  )
}
