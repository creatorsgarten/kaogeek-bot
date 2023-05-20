import { describe, expect, it } from 'vitest'

import isOnlyEmoji from '../../../src/utils/isOnlyEmoji'

describe('isOnlyEmoji', () => {
  it.each([{ msg: '🫠' }, { msg: '🅰️' }, { msg: '🅾' }, { msg: '<:test:000>' }])(
    'should match emoji',
    async ({ msg }) => {
      expect(isOnlyEmoji(msg)).toBeTruthy()
    },
  )

  it.each([{ msg: '' }, { msg: 'hello' }, { msg: 'a' }, { msg: '<html>' }])(
    'should not match emoji',
    async ({ msg }) => {
      expect(isOnlyEmoji(msg)).toBeFalsy()
    },
  )

  it('should not match emoji with text', async () => {
    expect(isOnlyEmoji('hello 🫠')).toBeFalsy()
  })

  it.todo('should not match messages with only numbers', async () => {
    expect(isOnlyEmoji('1 2 3')).toBeFalsy()
  })
})
