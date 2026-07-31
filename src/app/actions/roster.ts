'use server'

import { revalidatePath } from 'next/cache'
import { MAX_RANK } from '@/lib/scoring/config'
import { createClient } from '@/lib/supabase/server'

export type ChampionPatch = {
  currentRank?: number
  sigLevel?: number
  isAscended?: boolean
}

/**
 * Nenhuma action recebe user_id: o RLS filtra pela sessao. Um id adivinhado
 * nao atinge a linha de outro usuario.
 */

export async function rankUp(userChampionId: string) {
  const supabase = await createClient()

  const { data: current, error: readError } = await supabase
    .from('user_champions')
    .select('current_rank')
    .eq('id', userChampionId)
    .single()

  if (readError) throw new Error(`Campeao nao encontrado: ${readError.message}`)

  if (current.current_rank >= MAX_RANK) {
    throw new Error(`Campeao ja esta no rank maximo (R${MAX_RANK})`)
  }

  const { error } = await supabase
    .from('user_champions')
    .update({ current_rank: current.current_rank + 1 })
    .eq('id', userChampionId)

  if (error) throw new Error(`Falha ao subir de rank: ${error.message}`)

  revalidatePath('/')
}

export async function toggleFavorite(userChampionId: string, next: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('user_champions')
    .update({ is_favorite: next })
    .eq('id', userChampionId)

  if (error) throw new Error(`Falha ao favoritar: ${error.message}`)

  revalidatePath('/')
}

export async function updateChampion(userChampionId: string, patch: ChampionPatch) {
  if (patch.currentRank !== undefined && (patch.currentRank < 1 || patch.currentRank > MAX_RANK)) {
    throw new Error(`Rank deve estar entre 1 e ${MAX_RANK}`)
  }
  if (patch.sigLevel !== undefined && (patch.sigLevel < 0 || patch.sigLevel > 200)) {
    throw new Error('Sig deve estar entre 0 e 200')
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('user_champions')
    .update({
      ...(patch.currentRank !== undefined && { current_rank: patch.currentRank }),
      ...(patch.sigLevel !== undefined && { sig_level: patch.sigLevel }),
      ...(patch.isAscended !== undefined && { is_ascended: patch.isAscended }),
    })
    .eq('id', userChampionId)

  if (error) throw new Error(`Falha ao atualizar: ${error.message}`)

  revalidatePath('/')
}

export async function removeChampion(userChampionId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('user_champions').delete().eq('id', userChampionId)

  if (error) throw new Error(`Falha ao remover: ${error.message}`)

  revalidatePath('/')
}
