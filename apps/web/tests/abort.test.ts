import { expect, it } from '@rstest/core'
import { throwIfAborted } from '../src/utils/abort'

it('checks cancellation without modern AbortSignal methods or reason', () => {
  expect(() => throwIfAborted({ aborted: false } as AbortSignal)).not.toThrow()
  try {
    throwIfAborted({ aborted: true } as AbortSignal)
    throw new Error('Expected cancellation')
  } catch (error) {
    expect((error as Error).name).toBe('AbortError')
  }
})

it('preserves the abort reason when available', () => {
  const reason = new Error('cancelled')
  expect(() => throwIfAborted({ aborted: true, reason } as AbortSignal)).toThrow(reason)
})
