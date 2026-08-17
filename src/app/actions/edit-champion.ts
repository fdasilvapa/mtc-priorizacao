'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { removeChampion, updateChampion } from './roster'

export type EditState = { status: 'idle' | 'error'; message?: string }

export async function saveChampion(
  _prevState: EditState,
  formData: FormData,
): Promise<EditState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { status: 'error', message: 'Campeao invalido.' }

  const nome = String(formData.get('nome') ?? '')
  const currentRank = Number(formData.get('currentRank'))
  const sigLevel = Number(formData.get('sigLevel'))
  const isAscended = formData.get('isAscended') === 'on'

  try {
    await updateChampion(id, { currentRank, sigLevel, isAscended })
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Falha ao salvar.',
    }
  }

  // Fora do try: redirect() sinaliza lancando NEXT_REDIRECT, e um catch em
  // volta engoliria o redirecionamento e devolveria "Falha ao salvar".
  revalidatePath('/')
  redirect(`/?salvo=${encodeURIComponent(nome)}`)
}

export async function deleteChampion(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return

  await removeChampion(id)
  redirect('/')
}
