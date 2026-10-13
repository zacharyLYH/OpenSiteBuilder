/** The one inline error surface. `role="alert"` so a failed request is
 * announced, not just drawn — the message is the only feedback a publish or
 * state call has. */
export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {message}
    </p>
  )
}