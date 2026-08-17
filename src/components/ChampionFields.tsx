import { NumberStepper } from './NumberStepper'
import { RankPicker } from './RankPicker'
import { ToggleRow } from './ToggleRow'

export type ChampionFieldDefaults = {
  currentRank: number
  sigLevel: number
  isAscended: boolean
}

/**
 * Campos comuns a adicionar e editar. RankPicker e NumberStepper sao
 * 'use client' e guardam estado proprio, que espelham no FormData (um
 * input escondido e um input com value controlado, respectivamente);
 * ToggleRow continua um checkbox nao controlado comum.
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
