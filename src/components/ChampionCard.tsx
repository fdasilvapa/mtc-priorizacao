import Link from 'next/link'
import type { McocClass, ScoredChampion } from '@/lib/scoring/types'
import { ChampionActions } from './ChampionActions'

/** Cores de classe do MCOC — identidade visual reconhecivel de relance. */
export const CLASS_COLORS: Record<McocClass, string> = {
  Cosmic: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
  Tech: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  Science: 'bg-green-500/15 text-green-300 ring-green-500/30',
  Mutant: 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30',
  Mystic: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  Skill: 'bg-red-500/15 text-red-300 ring-red-500/30',
}

export function ChampionCard({ champion }: { champion: ScoredChampion }) {
  return (
    <article
      className={`rounded-xl border border-neutral-800 bg-neutral-900 p-4 ${
        champion.maxed ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">
            <Link href={`/campeao/${champion.id}`} className="hover:underline">
              {champion.name}
            </Link>
          </h2>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${
              CLASS_COLORS[champion.championClass]
            }`}
          >
            {champion.championClass}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold tabular-nums">
            {champion.maxed ? '—' : champion.score.toFixed(3)}
          </div>
          <div className="text-xs text-neutral-500">score</div>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-400">
        <div className="flex gap-1">
          <dt>Rank</dt>
          <dd className="font-medium text-neutral-200">R{champion.currentRank}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Sig</dt>
          <dd className="font-medium text-neutral-200">{champion.sigLevel}</dd>
        </div>
        {champion.isAscended && <div><span className="text-amber-400">Ascendido</span></div>}
        {champion.isFavorite && <div><span className="text-amber-400">Favorito</span></div>}
        {champion.maxed && <div><span className="text-neutral-500">Rank maximo</span></div>}
      </dl>

      <ChampionActions
        id={champion.id}
        currentRank={champion.currentRank}
        isFavorite={champion.isFavorite}
      />
    </article>
  )
}
