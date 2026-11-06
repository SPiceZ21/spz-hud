// A rank's animated badge: the looping idle render from the leaderboard's rank
// assets (apps/spz-leaderboard/Assets/rankfx/RANK<letter><n>_idle.webm), with
// the still PNG as the poster until the video plays. "S-1" -> RANKS1.
const BASE = './apps/spz-leaderboard/Assets/rankfx/'

export function rankFile(rank?: string) {
  const m = /^([A-Za-z])-?(\d)/.exec(String(rank || ''))
  return m ? `RANK${m[1].toUpperCase()}${m[2]}` : null
}

export function RankBadge({ rank, size = 64 }: { rank?: string; size?: number }) {
  const f = rankFile(rank)
  if (!f) return null
  return (
    <video
      class="rank-badge"
      style={{ width: `${size}px`, height: `${size}px` }}
      src={`${BASE}${f}_idle.webm`}
      poster={`${BASE}${f}.png`}
      autoplay loop muted playsInline
      onError={e => { (e.currentTarget as HTMLVideoElement).style.display = 'none' }}
    />
  )
}
