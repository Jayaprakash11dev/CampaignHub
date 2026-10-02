// A coloured circle with initials, for clients and people.
// The colour is chosen from the name, so the same client always gets the
// same colour on every page. No blues, to match the palette.
const COLOURS = [
  'bg-brand-600 text-white',
  'bg-amber-600 text-white',
  'bg-emerald-700 text-white',
  'bg-rose-600 text-white',
  'bg-fuchsia-700 text-white',
  'bg-lime-700 text-white',
  'bg-orange-700 text-white',
  'bg-stone-700 text-white',
]

const SIZES = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-lg',
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

function colourFor(name: string): string {
  let hash = 0
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return COLOURS[Math.abs(hash) % COLOURS.length]
}

export function Avatar({
  name,
  size = 'sm',
  // Clients get a single letter ("T" for Tandoor Tales), people get two.
  single = false,
}: {
  name: string
  size?: keyof typeof SIZES
  single?: boolean
}) {
  const initials = single ? initialsOf(name).charAt(0) : initialsOf(name)
  return (
    <span
      aria-hidden
      data-testid="avatar"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${colourFor(name)}`}
    >
      {initials}
    </span>
  )
}
