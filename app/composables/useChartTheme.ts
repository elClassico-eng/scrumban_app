type ChartTokens = {
  ink: string
  sub: string
  axisLabel: string
  axisLine: string
  grid: string
  surface: string
  accent: string
  accentDim: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
}

const LIGHT: ChartTokens = {
  ink: '#1c1917',
  sub: '#57534e',
  axisLabel: '#78716c',
  axisLine: '#e7e2dc',
  grid: '#efece7',
  surface: '#ffffff',
  accent: '#e85002',
  accentDim: 'rgba(232, 80, 2, 0.14)',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e7e2dc',
  tooltipText: '#292524',
}

const DARK: ChartTokens = {
  ink: '#e7e5e4',
  sub: '#a8a29e',
  axisLabel: '#8f8781',
  axisLine: '#2b2622',
  grid: '#242019',
  surface: '#1c1917',
  accent: '#ff6a2b',
  accentDim: 'rgba(255, 106, 43, 0.18)',
  tooltipBg: '#211d1a',
  tooltipBorder: '#332e29',
  tooltipText: '#ece9e6',
}

// Sequential flow ramp for ordered stages (backlog -> done), light to dark.
// One hue, monotonic lightness = colorblind-safe by construction.
const FLOW_LIGHT = ['#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8']
const FLOW_DARK = ['#c7ddff', '#93c5fd', '#60a5fa', '#3b82f6', '#2f6fe0', '#2159c4']

export function useChartTheme() {
  const colorMode = useColorMode()
  const isDark = computed(() => colorMode.value === 'dark')
  const t = computed<ChartTokens>(() => (isDark.value ? DARK : LIGHT))

  function flowRamp(n: number): string[] {
    const stops = isDark.value ? FLOW_DARK : FLOW_LIGHT
    if (n <= 1) return [stops[3]!]
    const out: string[] = []
    for (let i = 0; i < n; i++) {
      const idx = Math.round((i / (n - 1)) * (stops.length - 1))
      out.push(stops[idx]!)
    }
    return out
  }

  const textStyle = computed(() => ({ fontFamily: 'inherit', color: t.value.ink }))

  const tooltip = computed(() => ({
    backgroundColor: t.value.tooltipBg,
    borderColor: t.value.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12] as [number, number],
    textStyle: { color: t.value.tooltipText, fontSize: 12, fontFamily: 'inherit' },
    extraCssText: 'border-radius:10px;box-shadow:0 6px 24px -8px rgba(0,0,0,0.28);',
    axisPointer: {
      type: 'line',
      lineStyle: { color: t.value.axisLine, width: 1, type: [4, 4] as [number, number] },
      label: { show: false },
    },
  }))

  function categoryAxis(extra: Record<string, unknown> = {}) {
    return {
      type: 'category',
      axisLine: { lineStyle: { color: t.value.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: t.value.axisLabel, fontSize: 11, hideOverlap: true },
      splitLine: { show: false },
      ...extra,
    }
  }

  function valueAxis(extra: Record<string, unknown> = {}) {
    return {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.value.axisLabel, fontSize: 11 },
      splitLine: { lineStyle: { color: t.value.grid, type: [3, 4] as [number, number] } },
      ...extra,
    }
  }

  return { isDark, tokens: t, flowRamp, textStyle, tooltip, categoryAxis, valueAxis }
}
