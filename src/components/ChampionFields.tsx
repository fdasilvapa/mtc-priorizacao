import { MAX_RANK } from '@/lib/scoring/config'

const FIELD = 'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-base'

export type ChampionFieldDefaults = {
  currentRank: number
  sigLevel: number
  isAscended: boolean
}

/**
 * Campos comuns a adicionar e editar. Sem 'use client': sao inputs nao
 * controlados, lidos pelo FormData da action que envolve o formulario.
 */
export function ChampionFields({ defaults }: { defaults: ChampionFieldDefaults }) {
  return (
    <>
      <label className="block space-y-1">
        <span className="text-sm text-neutral-400">Rank atual</span>
        <select name="currentRank" defaultValue={defaults.currentRank} className={FIELD}>
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
          defaultValue={defaults.sigLevel}
          inputMode="numeric"
          className={FIELD}
        />
      </label>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="isAscended"
          defaultChecked={defaults.isAscended}
          className="size-5"
        />
        <span className="text-sm">Ascendido</span>
      </label>
    </>
  )
}
