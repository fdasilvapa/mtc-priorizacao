import Link from 'next/link'
import { Suspense } from 'react'
import { ChampionCard } from '@/components/ChampionCard'
import { RosterFilters } from '@/components/RosterFilters'
import { SavedBanner } from '@/components/SavedBanner'
import { SignOutButton } from '@/components/SignOutButton'
import { getRoster } from '@/lib/roster'

type Props = {
  searchParams: Promise<{ classe?: string; rank?: string; busca?: string; salvo?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const { classe, rank, busca, salvo } = await searchParams
  const roster = await getRoster()

  const filtrado = roster.filter((c) => {
    if (classe && c.championClass !== classe) return false
    if (rank && c.currentRank !== Number(rank)) return false
    if (busca && !c.name.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  return (
    <main className="mx-auto max-w-5xl p-4 pb-16">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Prioridade de rank up</h1>
        <div className="flex items-center gap-4">
          <Link href="/adicionar" className="text-sm font-semibold text-amber-400">
            + Adicionar
          </Link>
          <SignOutButton />
        </div>
      </header>

      {salvo !== undefined && <SavedBanner nome={salvo} />}

      <Suspense>
        <RosterFilters />
      </Suspense>

      {filtrado.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-400">
          {roster.length === 0
            ? 'Nenhum campeao no seu roster ainda.'
            : 'Nenhum campeao com esses filtros.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrado.map((champion) => (
            <li key={champion.id}>
              <ChampionCard champion={champion} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
