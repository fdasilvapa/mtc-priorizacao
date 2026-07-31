import Link from 'next/link'
import { getAvailableChampions } from '@/lib/champions'
import { AddChampionForm } from './AddChampionForm'

export default async function AdicionarPage() {
  const champions = await getAvailableChampions()

  return (
    <main className="mx-auto max-w-md p-4">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Adicionar campeao</h1>
        <Link href="/" className="text-sm text-neutral-400 underline">
          Voltar
        </Link>
      </header>

      {champions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-400">
          Todos os campeoes da base ja estao no seu roster.
        </p>
      ) : (
        <AddChampionForm champions={champions} />
      )}
    </main>
  )
}
