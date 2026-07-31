import { createClient } from '@/lib/supabase/server'
import { scoreRoster } from '@/lib/scoring/score'
import type { McocClass, RosterChampion, ScoredChampion } from '@/lib/scoring/types'

/** Formato cru devolvido pelo join do Supabase. */
type RosterRow = {
  id: string
  champion_id: string
  current_rank: number
  sig_level: number
  is_favorite: boolean
  is_ascended: boolean
  base_champions: {
    name: string
    champion_class: McocClass
    attack_tier_score: number
    attack_recommended_sig: number
  } | null
}

/**
 * Busca o roster do usuario logado numa unica query, pontua e ordena.
 * O RLS ja filtra por usuario — nao passamos user_id aqui.
 */
export async function getRoster(): Promise<ScoredChampion[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_champions')
    .select(`
      id,
      champion_id,
      current_rank,
      sig_level,
      is_favorite,
      is_ascended,
      base_champions (
        name,
        champion_class,
        attack_tier_score,
        attack_recommended_sig
      )
    `)
    .returns<RosterRow[]>()

  if (error) throw new Error(`Falha ao buscar o roster: ${error.message}`)

  const roster: RosterChampion[] = (data ?? [])
    .filter((row): row is RosterRow & { base_champions: NonNullable<RosterRow['base_champions']> } =>
      row.base_champions !== null,
    )
    .map((row) => ({
      id: row.id,
      championId: row.champion_id,
      name: row.base_champions.name,
      championClass: row.base_champions.champion_class,
      attackTierScore: Number(row.base_champions.attack_tier_score),
      attackRecommendedSig: row.base_champions.attack_recommended_sig,
      currentRank: row.current_rank,
      sigLevel: row.sig_level,
      isFavorite: row.is_favorite,
      isAscended: row.is_ascended,
    }))

  return scoreRoster(roster)
}

/** Busca um campeao do roster pelo id. O RLS garante que so retorna o do dono. */
export async function getUserChampion(id: string): Promise<RosterChampion | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_champions')
    .select(`
      id,
      champion_id,
      current_rank,
      sig_level,
      is_favorite,
      is_ascended,
      base_champions (
        name,
        champion_class,
        attack_tier_score,
        attack_recommended_sig
      )
    `)
    .eq('id', id)
    .maybeSingle<RosterRow>()

  if (error) throw new Error(`Falha ao buscar o campeao: ${error.message}`)
  if (!data || !data.base_champions) return null

  return {
    id: data.id,
    championId: data.champion_id,
    name: data.base_champions.name,
    championClass: data.base_champions.champion_class,
    attackTierScore: Number(data.base_champions.attack_tier_score),
    attackRecommendedSig: data.base_champions.attack_recommended_sig,
    currentRank: data.current_rank,
    sigLevel: data.sig_level,
    isFavorite: data.is_favorite,
    isAscended: data.is_ascended,
  }
}
