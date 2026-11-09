import { describe, expect, it } from 'vitest'
import { uploadImagePlan } from './upload-image-plan'

describe('uploadImagePlan', () => {
  it('avatars, logos and board images become small squares', () => {
    expect(uploadImagePlan('user_avatar')).toEqual({ maxSide: 256, square: true })
    expect(uploadImagePlan('board_image')).toEqual({ maxSide: 256, square: true })
  })

  it('attachments are uploaded as is', () => {
    expect(uploadImagePlan('attachment')).toBeNull()
  })
})
