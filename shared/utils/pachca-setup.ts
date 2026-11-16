export type PachcaSetupStep = 'connect' | 'link' | 'feed' | 'invite' | 'previews'

export type PachcaSetupState = {
  connected: boolean
  linked: boolean
  feeds: number
  linkedMembers: number
  members: number
  linkPreviews: boolean
}

export function pachcaSetupSteps(s: PachcaSetupState): { done: number, total: 5, next: PachcaSetupStep | null, status: Record<PachcaSetupStep, boolean> } {
  const steps: [PachcaSetupStep, boolean][] = [
    ['connect', s.connected],
    ['link', s.linked],
    ['feed', s.feeds > 0],
    ['invite', s.linkedMembers >= 2 || s.linkedMembers >= s.members],
    ['previews', s.linkPreviews],
  ]
  return {
    done: steps.filter(([, ok]) => ok).length,
    total: 5,
    next: steps.find(([, ok]) => !ok)?.[0] ?? null,
    status: Object.fromEntries(steps) as Record<PachcaSetupStep, boolean>,
  }
}
