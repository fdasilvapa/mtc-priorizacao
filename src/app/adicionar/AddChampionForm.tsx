'use client'

import { useActionState } from 'react'
import { addChampion, type AddState } from '@/app/actions/add-champion'
import type { AvailableChampion } from '@/lib/champions'
import { MAX_RANK } from '@/lib/scoring/config'

const INITIAL: AddState = { status: 'idle' }

const FIELD = 'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base'

export function AddChampionForm({ champions }: { champions: AvailableChampion[] }) {
  const [state, formAction, pending] = useActionState(addChampion, INITIAL)

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Campeao</span>
        <select name="championId" required defaultValue="" className={FIELD}>
          <option value="" disabled>
            Selecione...
          </option>
          {champions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.championClass})
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Rank atual</span>
        <select name="currentRank" defaultValue="1" className={FIELD}>
          {Array.from({ length: MAX_RANK }, (_, i) => i + 1).map((r) => (
            <option key={r} value={r}>
              R{r}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Nivel de sig (0 a 200)</span>
        <input
          type="number"
          name="sigLevel"
          min={0}
          max={200}
          defaultValue={0}
          inputMode="numeric"
          className={FIELD}
        />
      </label>

      <label className="flex items-center gap-3">
        <input type="checkbox" name="isAscended" className="size-5" />
        <span className="text-sm">Ascendido</span>
      </label>

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
