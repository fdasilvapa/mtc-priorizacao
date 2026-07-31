import { ChampionCard } from '@/components/ChampionCard'
import { SignOutButton } from '@/components/SignOutButton'
import { getRoster } from '@/lib/roster'

export default async function HomePage() {
  const roster = await getRoster()

  return (
    <main className="mx-auto max-w-5xl p-4 pb-16">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Prioridade de rank up</h1>
        <SignOutButton />
      </header>

      {roster.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-400">
          Nenhum campeao no seu roster ainda.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((champion) => (
            <li key={champion.id}>
              <ChampionCard champion={champion} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
