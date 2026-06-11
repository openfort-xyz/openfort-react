import { useSolanaMessageSigner } from '../../hooks/useSolanaMessageSigner'
import { TruncateData } from '../ui/TruncateData'

function SignMessage() {
  const { data, signMessage, isPending, error } = useSolanaMessageSigner()

  return (
    <div>
      <h2 className="mb-3">Sign Message</h2>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          const formData = new FormData(event.target as HTMLFormElement)
          signMessage({ message: formData.get('message') as string })
        }}
      >
        <textarea
          name="message"
          placeholder="Message to sign"
          rows={3}
          className="px-4 py-2 rounded-md bg-zinc-700 border-none outline-none w-full resize-none"
        />
        <button type="submit" className="btn" disabled={isPending}>
          {isPending ? 'Signing...' : 'Sign Message'}
        </button>
      </form>
      {error && (
        <TruncateData data={error.message} className="text-red-500" />
      )}
      <TruncateData data={data} />
    </div>
  )
}

export const Sign = () => {
  return (
    <div className="flex flex-col w-full">
      <h1>Sign Message</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Sign messages with your Solana embedded wallet using Ed25519.
      </p>
      <div className="space-y-6">
        <SignMessage />
      </div>
    </div>
  )
}
