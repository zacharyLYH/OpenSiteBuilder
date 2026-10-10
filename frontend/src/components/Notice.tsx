export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{message}</p>
}

export function SuccessNote({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="mt-2 rounded bg-green-50 p-3 text-sm text-green-700">{message}</p>
}
