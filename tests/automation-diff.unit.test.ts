import { describe, expect, it } from 'vitest'
import { diffFirings } from '../server/utils/automation-diff'

const subj = (id: string) => ({ subjectType: 'task' as const, subjectId: id, payload: {} })

describe('diffFirings', () => {
  it('opens new subjects and resolves vanished ones', () => {
    const r = diffFirings(
      [
        { id: 'f1', subjectType: 'task', subjectId: 'a' },
        { id: 'f2', subjectType: 'task', subjectId: 'b' },
      ],
      [subj('b'), subj('c')],
    )
    expect(r.toOpen.map((s) => s.subjectId)).toEqual(['c'])
    expect(r.toResolve).toEqual(['f1'])
  })

  it('is a no-op when sets match', () => {
    const r = diffFirings([{ id: 'f1', subjectType: 'task', subjectId: 'a' }], [subj('a')])
    expect(r.toOpen).toEqual([])
    expect(r.toResolve).toEqual([])
  })

  it('resolves everything when current is empty', () => {
    const r = diffFirings([{ id: 'f1', subjectType: 'task', subjectId: 'a' }], [])
    expect(r.toResolve).toEqual(['f1'])
  })

  it('keys by subject type as well as id', () => {
    const r = diffFirings(
      [{ id: 'f1', subjectType: 'sprint', subjectId: 'a' }],
      [subj('a')],
    )
    expect(r.toOpen).toHaveLength(1)
    expect(r.toResolve).toEqual(['f1'])
  })
})
