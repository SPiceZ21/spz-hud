// NUI plumbing. Outside the game (vite dev) there is no resource to post to,
// so calls resolve quietly and the page can be designed in a normal browser.
declare function GetParentResourceName(): string

export const inGame = typeof (window as any).GetParentResourceName === 'function'

export async function post<T = unknown>(name: string, data: unknown = {}): Promise<T | null> {
  if (!inGame) return null
  try {
    const res = await fetch(`https://${GetParentResourceName()}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
    })
    return (await res.json()) as T
  } catch {
    return null
  }
}
