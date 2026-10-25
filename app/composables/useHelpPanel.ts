export type HelpTab = 'page' | 'keys'

export function useHelpPanel() {
  const open = useState('help-panel-open', () => false)
  const tab = useState<HelpTab>('help-panel-tab', () => 'page')

  function show(next: HelpTab = 'page') {
    tab.value = next
    open.value = true
  }

  return { open, tab, show }
}
