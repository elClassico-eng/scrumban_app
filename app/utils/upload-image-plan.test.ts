import { describe, expect, it } from 'vitest'
import { averageHex, uploadImagePlan } from './upload-image-plan'

const MB = 1_048_576

describe('uploadImagePlan', () => {
  it('avatars, logos and board images become small squares', () => {
    expect(uploadImagePlan('user_avatar', MB)).toEqual({ maxSide: 256, square: true })
    expect(uploadImagePlan('board_image', MB)).toEqual({ maxSide: 256, square: true })
  })

  it('a background up to 10 MB goes as is, a bigger one is scaled down keeping its shape', () => {
    expect(uploadImagePlan('user_background', 10 * MB)).toBeNull()
    expect(uploadImagePlan('user_background', 10 * MB + 1)).toEqual({ maxSide: 3840, square: false })
  })

  it('attachments are uploaded as is', () => {
    expect(uploadImagePlan('attachment', 50 * MB)).toBeNull()
  })
})

describe('averageHex', () => {
  it('averages RGBA pixels and ignores alpha', () => {
    expect(averageHex(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 10]))).toBe('#800080')
  })
})
