'use server'

import { redirect } from 'next/navigation'
import { removeChampion, updateChampion } from './roster'

export type EditState = { status: 'idle' | 'saved' | 'error'; message?: string }

export async function saveChampion(
  _prevState: EditState,
  formData: FormData,
): Promise<EditState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { status: 'error', message: 'Campeao invalido.' }

  const currentRank = Number(formData.get('currentRank'))
  const sigLevel = Number(formData.get('sigLevel'))
  const isAscended = formData.get('isAscended') === 'on'

  try {
    await updateChampion(id, { currentRank, sigLevel, isAscended })
    return { status: 'saved' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Falha ao salvar.',
    }
  }
}

export async function deleteChampion(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return

  await removeChampion(id)
  redirect('/')
}
