'use client'

import { useActionState, useState } from 'react'
import { addChampion, type AddState } from '@/app/actions/add-champion'
import { ChampionFields } from '@/components/ChampionFields'
import type { AvailableChampion } from '@/lib/champions'

const INITIAL: AddState = { status: 'idle' }

export function AddChampionForm({ champions }: { champions: AvailableChampion[] }) {
  const [state, formAction, pending] = useActionState(addChampion, INITIAL)
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<AvailableChampion | null>(null)

  // Limita a lista: renderizar o catalogo inteiro a cada tecla trava o celular.
  const encontrados = champions
    .filter((c) => c.name.toLowerCase().includes(busca.trim().toLowerCase()))
    .slice(0, 30)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <span className="text-sm text-neutral-400">Campeao</span>

        <input type="hidden" name="championId" value={escolhido?.id ?? ''} />

        {escolhido ? (
          <button
            type="button"
            onClick={() => setEscolhido(null)}
            className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border border-amber-500 bg-neutral-900 px-4 py-3 text-left text-base"
          >
            <span className="min-w-0 truncate">{escolhido.name}</span>
            <span className="shrink-0 text-sm text-neutral-400">trocar</span>
          </button>
        ) : (
          <>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar campeao"
              aria-label="Buscar campeao"
              className="h-12 w-full min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 px-4 text-base"
            />

            <ul className="max-h-64 divide-y divide-neutral-800 overflow-y-auto rounded-lg border border-neutral-800">
              {encontrados.length === 0 ? (
                <li className="px-4 py-3 text-sm text-neutral-500">
                  Nenhum campeao com esse nome.
                </li>
              ) : (
                encontrados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setEscolhido(c)}
                      className="flex min-h-12 w-full items-center justify-between gap-2 px-4 py-3 text-left active:bg-neutral-800"
                    >
                      <span className="min-w-0 truncate text-base">{c.name}</span>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {c.championClass}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>

      <ChampionFields defaults={{ currentRank: 1, sigLevel: 0, isAscended: false }} />

      {state.status === 'error' && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Adicionar ao roster'}
      </button>
    </form>
  )
}
