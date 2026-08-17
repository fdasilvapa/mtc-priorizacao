import { NumberStepper } from './NumberStepper'
import { RankPicker } from './RankPicker'

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
      <RankPicker name="currentRank" defaultValue={defaults.currentRank} />

      <NumberStepper name="sigLevel" label="Nivel de sig" defaultValue={defaults.sigLevel} min={0} max={200} />

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
