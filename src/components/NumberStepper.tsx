'use client'

import { useState } from 'react'
import { stepValue } from '@/lib/step-value'

type Props = {
  name: string
  label: string
  defaultValue: number
  min: number
  max: number
}

const BOTAO =
  'flex h-12 min-w-12 items-center justify-center rounded-lg border border-neutral-700 ' +
  'bg-neutral-800 px-3 text-sm font-semibold tabular-nums text-neutral-100 ' +
  'active:bg-neutral-700 disabled:opacity-30'

/**
 * Passos de 1 e de 20: o sig sobe de 20 em 20 quando uma duplicata sai no
 * cristal, mas nem todo valor e alcancavel assim — dai o numero do meio virar
 * campo digitavel. Nos extremos o botao desabilita, para o toque nao parecer
 * quebrado.
 */
export function NumberStepper({ name, label, defaultValue, min, max }: Props) {
  const [valor, setValor] = useState(defaultValue)

  const aplicar = (delta: number) => setValor((v) => stepValue(v, delta, min, max))

  return (
    <div className="space-y-1">
      <span className="text-sm text-neutral-400">{label}</span>

      <div className="flex items-stretch gap-1">
        {[-20, -1].map((delta) => (
          <button
            key={delta}
            type="button"
            onClick={() => aplicar(delta)}
            disabled={valor <= min}
            aria-label={`Diminuir ${Math.abs(delta)}`}
            className={BOTAO}
          >
            −{Math.abs(delta)}
          </button>
        ))}

        <input
          type="number"
          name={name}
          value={valor}
          min={min}
          max={max}
          inputMode="numeric"
          aria-label={label}
          onChange={(e) => setValor(Number(e.target.value))}
          onBlur={() => setValor((v) => stepValue(v, 0, min, max))}
          className="h-12 min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-center text-base tabular-nums"
        />

        {[1, 20].map((delta) => (
          <button
            key={delta}
            type="button"
            onClick={() => aplicar(delta)}
            disabled={valor >= max}
            aria-label={`Aumentar ${delta}`}
            className={BOTAO}
          >
            +{delta}
          </button>
        ))}
      </div>
    </div>
  )
}
