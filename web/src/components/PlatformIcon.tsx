import type { IconType } from 'react-icons'
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaXTwitter } from 'react-icons/fa6'
import type { Platform } from '../lib/types'

// Brand logos from Font Awesome (via react-icons). Drawn in one ink colour
// rather than each network's brand colour, to keep the palette consistent.
const ICONS: Record<Platform, IconType> = {
  INSTAGRAM: FaInstagram,
  FACEBOOK: FaFacebookF,
  LINKEDIN: FaLinkedinIn,
  X: FaXTwitter,
}

export function PlatformIcon({
  platform,
  className = 'h-3.5 w-3.5',
}: {
  platform: Platform
  className?: string
}) {
  const Icon = ICONS[platform]
  return <Icon aria-hidden className={className} />
}
