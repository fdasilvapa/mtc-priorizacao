import { signOut } from '@/app/login/actions'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-sm text-neutral-400 underline">
        Sair
      </button>
    </form>
  )
}
