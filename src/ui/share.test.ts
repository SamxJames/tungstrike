import { describe, expect, it, vi } from 'vitest'
import { shareLink } from './share.ts'

const abort = () => Object.assign(new Error('cancelled'), { name: 'AbortError' })

describe('shareLink', () => {
  it('uses navigator.share when present', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    expect(await shareLink('https://x/lab#v1', { share, clipboard: { writeText } })).toBe('shared')
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://x/lab#v1' }))
    expect(writeText).not.toHaveBeenCalled()
  })
  it('falls back to the clipboard when share is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await shareLink('u', { clipboard: { writeText } })).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('u')
  })
  it('falls back to the clipboard when share fails for a real reason', async () => {
    const share = vi.fn().mockRejectedValue(new Error('boom'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    expect(await shareLink('u', { share, clipboard: { writeText } })).toBe('copied')
  })
  it('treats the user cancelling the share sheet as not a failure and does not copy', async () => {
    const share = vi.fn().mockRejectedValue(abort())
    const writeText = vi.fn()
    expect(await shareLink('u', { share, clipboard: { writeText } })).toBe('shared')
    expect(writeText).not.toHaveBeenCalled()
  })
  it('returns failed (never throws) when nothing works', async () => {
    expect(await shareLink('u', {})).toBe('failed')
    expect(await shareLink('u', { clipboard: { writeText: () => Promise.reject(new Error('no')) } })).toBe('failed')
    expect(
      await shareLink('u', {
        share: () => {
          throw new Error('sync throw')
        },
        clipboard: {
          writeText: () => {
            throw new Error('sync throw too')
          },
        },
      }),
    ).toBe('failed')
  })
})
