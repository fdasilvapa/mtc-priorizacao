'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-lg font-bold">Algo deu errado</h1>
      <p className="mt-2 text-sm text-neutral-400">Nao foi possivel completar a acao. Tente de novo.</p>
      {error.digest && <p className="mt-2 text-xs text-neutral-600">Codigo: {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-neutral-950"
      >
        Tentar de novo
      </button>
    </main>
  )
}
