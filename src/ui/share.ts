export type ShareResult = 'shared' | 'copied' | 'failed'

/** The slice of `navigator` we use, so tests can inject a fake. */
export interface ShareNav {
  share?: (data: { url: string; title?: string }) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

const isAbort = (e: unknown) => typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError'

/**
 * Share with the system sheet when there is one, else copy to the clipboard. Never throws.
 * The user closing the share sheet is not a failure (returns 'shared' so no error is shown).
 */
export async function shareLink(
  url: string,
  nav: ShareNav = typeof navigator === 'undefined' ? {} : navigator,
): Promise<ShareResult> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ url, title: 'Tungstrike' })
      return 'shared'
    } catch (e) {
      if (isAbort(e)) return 'shared'
    }
  }
  try {
    if (!nav.clipboard) return 'failed'
    await nav.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
