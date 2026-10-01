// Temporary placeholder for pages that are built in later commits.
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">Coming in the next step.</p>
    </div>
  )
}
