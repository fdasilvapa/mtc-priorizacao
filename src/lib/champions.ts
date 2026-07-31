import type { McocClass } from '@/lib/scoring/types'
import { createClient } from '@/lib/supabase/server'

export type AvailableChampion = {
  id: string
  name: string
  championClass: McocClass
}

/** Campeoes da base que ainda nao estao no roster do usuario. */
export async function getAvailableChampions(): Promise<AvailableChampion[]> {
  const supabase = await createClient()

  const { data: owned } = await supabase.from('user_champions').select('champion_id')
  const ownedIds = new Set((owned ?? []).map((row) => row.champion_id))

  const { data, error } = await supabase
    .from('base_champions')
    .select('id, name, champion_class')
    .order('name')

  if (error) throw new Error(`Falha ao buscar campeoes: ${error.message}`)

  return (data ?? [])
    .filter((row) => !ownedIds.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      championClass: row.champion_class as McocClass,
    }))
}
