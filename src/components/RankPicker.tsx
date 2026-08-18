'use client'

import { useState } from 'react'
import { MAX_RANK } from '@/lib/scoring/config'

type Props = {
  name: string
  defaultValue: number
}

const RANKS = Array.from({ length: MAX_RANK }, (_, i) => i + 1)

/** Cinco opcoes fixas — um toque, sem overlay do sistema. */
export function RankPicker({ name, defaultValue }: Props) {
  const [rank, setRank] = useState(defaultValue)

  return (
    <div className="space-y-1">
      <span className="text-sm text-neutral-400">Rank atual</span>

      <input type="hidden" name={name} value={rank} />

      <div role="radiogroup" aria-label="Rank atual" className="flex gap-1">
        {RANKS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={rank === r}
            onClick={() => setRank(r)}
            className={`h-12 min-w-0 flex-1 rounded-lg border text-sm font-semibold tabular-nums ${
              rank === r
                ? 'border-amber-500 bg-amber-500 text-neutral-950'
                : 'border-neutral-700 bg-neutral-800 text-neutral-300'
            }`}
          >
            R{r}
          </button>
        ))}
      </div>
    </div>
  )
}
