import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CLASS_COLORS } from '@/components/ChampionCard'
import { getUserChampion } from '@/lib/roster'
import { EditChampionForm } from './EditChampionForm'

export default async function ChampionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const champion = await getUserChampion(id)

  if (!champion) notFound()

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/" className="text-sm text-neutral-400 underline">
        Voltar
      </Link>

      <header className="my-6 space-y-2">
        <h1 className="text-2xl font-bold">{champion.name}</h1>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${
            CLASS_COLORS[champion.championClass]
          }`}
        >
          {champion.championClass}
        </span>
      </header>

      <EditChampionForm champion={champion} />
    </main>
  )
}
