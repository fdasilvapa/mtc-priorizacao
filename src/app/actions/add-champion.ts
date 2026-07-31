'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { MAX_RANK } from '@/lib/scoring/config'
import { createClient } from '@/lib/supabase/server'

export type AddState = { status: 'idle' | 'error'; message?: string }

export async function addChampion(
  _prevState: AddState,
  formData: FormData,
): Promise<AddState> {
  const championId = String(formData.get('championId') ?? '')
  const currentRank = Number(formData.get('currentRank'))
  const sigLevel = Number(formData.get('sigLevel'))
  const isAscended = formData.get('isAscended') === 'on'

  if (!championId) {
    return { status: 'error', message: 'Escolha um campeao.' }
  }
  if (!Number.isInteger(currentRank) || currentRank < 1 || currentRank > MAX_RANK) {
    return { status: 'error', message: `Rank deve estar entre 1 e ${MAX_RANK}.` }
  }
  if (!Number.isInteger(sigLevel) || sigLevel < 0 || sigLevel > 200) {
    return { status: 'error', message: 'Sig deve estar entre 0 e 200.' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Sessao expirada.' }

  const { error } = await supabase.from('user_champions').insert({
    user_id: user.id,
    champion_id: championId,
    current_rank: currentRank,
    sig_level: sigLevel,
    is_ascended: isAscended,
  })

  if (error) {
    // 23505 = unique_violation (constraint user_champions_unique)
    if (error.code === '23505') {
      return { status: 'error', message: 'Esse campeao ja esta no seu roster.' }
    }
    return { status: 'error', message: `Falha ao adicionar: ${error.message}` }
  }

  revalidatePath('/')
  redirect('/')
}
