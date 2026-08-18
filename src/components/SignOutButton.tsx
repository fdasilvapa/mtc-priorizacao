import { signOut } from '@/app/login/actions'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-sm text-neutral-400 min-h-11 rounded-lg px-3 py-2">
        Sair
      </button>
    </form>
  )
}
