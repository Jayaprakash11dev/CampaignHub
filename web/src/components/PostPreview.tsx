import { Fragment } from 'react'
import { formatIst } from '../lib/datetime'
import { PLATFORM_LABEL } from '../lib/labels'
import type { Platform } from '../lib/types'

interface Props {
  platform: Platform
  clientName: string
  caption: string
  // UTC ISO string, or null while the time field is empty/invalid
  scheduledAt: string | null
}

// A rough idea of how the post will look on each network. Not pixel
// perfect; it's there so creators and reviewers can picture the post.
export function PostPreview({ platform, clientName, caption, scheduledAt }: Props) {
  const name = clientName || 'Client name'
  const handle = '@' + name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const header = (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-slate-500">
          {platform === 'LINKEDIN'
            ? 'Company page · Promoted'
            : platform === 'FACEBOOK'
              ? 'Sponsored'
              : handle}
        </p>
      </div>
    </div>
  )

  const text = (
    <p className="text-sm whitespace-pre-wrap text-slate-800">
      {caption ? <Highlighted text={caption} /> : (
        <span className="text-slate-400">Your caption will appear here…</span>
      )}
    </p>
  )

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span className="font-semibold tracking-wide uppercase">
          {PLATFORM_LABEL[platform]} preview
        </span>
        <span>
          {scheduledAt ? `Goes live ${formatIst(scheduledAt)} IST` : 'No time set'}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {platform === 'INSTAGRAM' ? (
          <>
            <div className="p-3">{header}</div>
            <div className="aspect-square bg-gradient-to-br from-pink-400 via-orange-300 to-amber-200" />
            <div className="space-y-2 p-3">
              <p className="text-lg tracking-widest">♡ 💬 ↗</p>
              {text}
            </div>
          </>
        ) : platform === 'X' ? (
          <div className="space-y-2 p-4">
            {header}
            {text}
            <p className="flex justify-between pt-1 text-xs text-slate-500">
              <span>💬 0</span>
              <span>🔁 0</span>
              <span>♡ 0</span>
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {header}
            {text}
            <div className="h-40 rounded-md bg-gradient-to-br from-slate-200 to-slate-100" />
            <p className="flex gap-6 border-t border-slate-100 pt-2 text-xs text-slate-500">
              <span>👍 Like</span>
              <span>💬 Comment</span>
              <span>↗ Share</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Colours hashtags and @mentions like the real apps do.
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/([#@][\p{L}\p{N}_]+)/u)
  return (
    <>
      {parts.map((part, i) =>
        /^[#@]/.test(part) ? (
          <span key={i} className="text-sky-600">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
