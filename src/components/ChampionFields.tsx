import { NumberStepper } from './NumberStepper'
import { RankPicker } from './RankPicker'
import { ToggleRow } from './ToggleRow'

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

      <ToggleRow name="isAscended" label="Ascendido" defaultChecked={defaults.isAscended} />
    </>
  )
}
