'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { MAX_RANK } from '@/lib/scoring/config'
import { MCOC_CLASSES } from '@/lib/scoring/types'

const FIELD = 'rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm'

/** Estado na URL: sobrevive ao refresh e da para salvar o link. */
export function RosterFilters() {
  const router = useRouter()
  const params = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/?${next.toString()}`)
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <input
        type="search"
        placeholder="Buscar por nome"
        defaultValue={params.get('busca') ?? ''}
        onChange={(e) => setParam('busca', e.target.value)}
        className={`${FIELD} min-w-0 flex-1`}
      />

      <select
        value={params.get('classe') ?? ''}
        onChange={(e) => setParam('classe', e.target.value)}
        className={FIELD}
      >
        <option value="">Toda classe</option>
        {MCOC_CLASSES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={params.get('rank') ?? ''}
        onChange={(e) => setParam('rank', e.target.value)}
        className={FIELD}
      >
        <option value="">Todo rank</option>
        {Array.from({ length: MAX_RANK }, (_, i) => i + 1).map((r) => (
          <option key={r} value={r}>
            R{r}
          </option>
        ))}
      </select>
    </div>
  )
}
