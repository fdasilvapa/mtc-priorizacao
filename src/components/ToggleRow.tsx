type Props = {
  name: string
  label: string
  defaultChecked: boolean
}

/**
 * Checkbox com a linha inteira clicavel. Sem 'use client': e um input nao
 * controlado, lido pelo FormData da action que envolve o formulario.
 */
export function ToggleRow({ name, label, defaultChecked }: Props) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-6 shrink-0 accent-amber-500"
      />
      <span className="text-base">{label}</span>
    </label>
  )
}
