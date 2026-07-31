'use client'

import { useOptimistic, useTransition } from 'react'
import { rankUp, toggleFavorite } from '@/app/actions/roster'
import { MAX_RANK } from '@/lib/scoring/config'

type Props = {
  id: string
  currentRank: number
  isFavorite: boolean
}

/**
 * Estado otimista: numa rede de celular, esperar o round-trip para ver a
 * estrela acender e o suficiente para o usuario largar o app.
 */
export function ChampionActions({ id, currentRank, isFavorite }: Props) {
  const [, startTransition] = useTransition()
  const [optimisticRank, setOptimisticRank] = useOptimistic(currentRank)
  const [optimisticFav, setOptimisticFav] = useOptimistic(isFavorite)

  const maxed = optimisticRank >= MAX_RANK

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        disabled={maxed}
        onClick={() =>
          startTransition(async () => {
            setOptimisticRank(optimisticRank + 1)
            await rankUp(id)
          })
        }
        className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-40"
      >
        {maxed ? 'Rank maximo' : `Subir para R${optimisticRank + 1}`}
      </button>

      <button
        type="button"
        aria-label={optimisticFav ? 'Desfavoritar' : 'Favoritar'}
        aria-pressed={optimisticFav}
        onClick={() =>
          startTransition(async () => {
            setOptimisticFav(!optimisticFav)
            await toggleFavorite(id, !optimisticFav)
          })
        }
        className={`rounded-lg border px-3 py-2 text-sm ${
          optimisticFav
            ? 'border-amber-500 text-amber-400'
            : 'border-neutral-700 text-neutral-400'
        }`}
      >
        ★
      </button>
    </div>
  )
}
