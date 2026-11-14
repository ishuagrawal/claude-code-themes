import { expect, mock, test } from 'claude-code/testing'

const BACKDROP = (surface: 'desktop' | 'mobile' | 'terminal', plugin = 'rainy-window', scene = 'rainy-window') => ({
  plugin,
  surface,
  component: 'Backdrop' as const,
  requestId: 'backdrop',
  props: { scene, plugin, glass: { blur: 18, opacity: 0.62 } } as any,
})

// Stand in for Claude Code: answer each $ call the theme makes.
function engine(on: any, sets: any[]) {
  mock.clock(on)
  const store = new Map<string, unknown>()
  on('store.get', (_: any, e: any) => ({ value: store.get(e.key ?? e) }))
  on('store.set', (_: any, e: any) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    store.delete(e.key ?? e)
    return { value: undefined }
  })
  on('session.start', (_: any, e: any) => e)
  on('command.register', () => ({ value: {} }))
  on('theme.set', (_: any, e: any) => {
    sets.push(e)
    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('theme.clear', () => {
    sets.push('clear')
    return { value: { isDrawn: false, reason: 'the theme is cleared' } }
  })
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Text({ children: ['engine'] }))
}

const start = (T: any) => T.session.start({ source: 'startup', cwd: '/tmp', model: 'x', sessionId: 's' })
const run = (T: any, args: string) => T.command.run({ command: 'rainy-window', args, origin: { kind: 'user' }, presentation: {} })

test('session start sets colors and the backdrop in one call', async ($, on) => {
  const sets: any[] = []
  engine(on, sets)
  await start($)
  expect(sets.length).toBe(1)
  expect(sets[0].backdrop.scene).toBe('rainy-window')
  expect(sets[0].colors.label).toBe('Rainy window')
})

test('the scene animates the way the desktop app allows, with no words and under the size limit', async ($, on) => {
  engine(on, [])
  await start($)
  const ui: any = await $.ui.mount(BACKDROP('desktop') as any)
  const svg = await ui.find({ type: 'Svg' })
  const source: string = svg?.props?.source ?? ''
  expect(source.startsWith('<svg')).toBe(true)
  expect(source.length < 131072).toBe(true)
  expect(/<text/.test(source)).toBe(false)
  // The app moves a backdrop only if it passes its check: SMIL for motion, no
  // viewport units, no media queries, no CSS functions off its list.
  expect(source.includes('<animate')).toBe(true)
  expect(/\d(?:[dsl]?v(?:w|h|i|b|min|max))(?![a-z0-9_-])/i.test(source)).toBe(false)
  expect(source.includes('@media')).toBe(false)
  expect(/shape-rendering|vector-effect|color-scheme/.test(source)).toBe(false)
  const allowed = new Set('color color-mix hsl hsla hwb lab lch oklab oklch rgb rgba abs calc clamp max min mod rem round sign var matrix rotate scale skew translate cubic-bezier linear steps url'.split(' '))
  const called = [...source.matchAll(/([a-z-]+)\(/gi)].map(m => (m[1] as string).toLowerCase())
  expect(called.filter(f => !allowed.has(f))).toEqual([])
  // Drawn as dot patterns, with only Clawd's own masks: the app times each frame.
  expect((source.match(/ mask="/g) ?? []).length <= 3).toBe(true)
  expect(svg?.props?.alt).toContain('Clawd')
  await ui.unmount()
})

test('Clawd appears once, in dots', async ($, on) => {
  engine(on, [])
  await start($)
  const ui: any = await $.ui.mount(BACKDROP('desktop') as any)
  const source: string = (await ui.find({ type: 'Svg' }))?.props?.source ?? ''
  expect(source.split('class="corner"').length - 1).toBe(1)
  expect(source.includes('<g mask="url(#c0)">')).toBe(true)
  await ui.unmount()
})

test('the scene stays the same through a turn', async ($, on) => {
  const T: any = $
  engine(on, [])
  on('turn.start', (_: any, e: any) => ({ turnId: e.turnId, kind: 'engine', ref: 1 }))
  on('tool.call', () => ({ result: 'ok' }))
  await start($)
  const ui: any = await $.ui.mount(BACKDROP('desktop') as any)
  const before = (await ui.find({ type: 'Svg' }))?.props?.source
  await T.turn.start({ text: 'hi', turnId: 't1' })
  await T.tool.call({ tool: 'Bash', command: 'ls' })
  expect((await ui.find({ type: 'Svg' }))?.props?.source).toBe(before)
  await ui.unmount()
})

test('off clears the theme and on sets it again', async ($, on) => {
  const T: any = $
  const sets: any[] = []
  engine(on, sets)
  await start($)
  await run(T, 'off')
  expect(sets[sets.length - 1]).toBe('clear')
  await run(T, 'on')
  expect(sets[sets.length - 1].backdrop.scene).toBe('rainy-window')
})

test('it leaves other backdrops and the terminal alone', async ($, on) => {
  engine(on, [])
  await start($)
  const other: any = await $.ui.mount(BACKDROP('desktop', 'someone-else', 'night-sky') as any)
  expect(await other.find({ type: 'Svg' })).toBeFalsy()
  await other.unmount()
  const terminal: any = await $.ui.mount(BACKDROP('terminal') as any)
  expect(await terminal.find({ type: 'Svg' })).toBeFalsy()
  await terminal.unmount()
})
