'use client'

import { useActionState } from 'react'
import { deleteChampion, saveChampion, type EditState } from '@/app/actions/edit-champion'
import { ChampionFields } from '@/components/ChampionFields'
import type { RosterChampion } from '@/lib/scoring/types'

const INITIAL: EditState = { status: 'idle' }

export function EditChampionForm({ champion }: { champion: RosterChampion }) {
  const [state, formAction, pending] = useActionState(saveChampion, INITIAL)

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={champion.id} />

        <ChampionFields
          defaults={{
            currentRank: champion.currentRank,
            sigLevel: champion.sigLevel,
            isAscended: champion.isAscended,
          }}
        />

        {state.status === 'error' && <p className="text-sm text-red-400">{state.message}</p>}
        {state.status === 'saved' && (
          <p className="text-sm text-emerald-400">Alteracoes salvas.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
      </form>

      <form action={deleteChampion}>
        <input type="hidden" name="id" value={champion.id} />
        <button type="submit" className="w-full py-2 text-sm text-red-400 underline">
          Remover do roster
        </button>
      </form>
    </div>
  )
}
