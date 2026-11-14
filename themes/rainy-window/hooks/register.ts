// rainy-window: a theme for the Code tab of the Claude desktop app (and the
// mobile app). It follows the docs' recipe for a theme: one `$.theme.set` call
// with both the colors and a backdrop scene, at session start, and a
// `ui.render` hook that draws that scene at the `Backdrop` site.
// https://code.claude.com/docs/en/plugins/mods/interface#put-a-backdrop-behind-the-conversation
//
// The scene is Clawd's room on a rainy day, with Clawd, the plain mascot as
// clawdhouse draws him, typing at his desk. It's one drawing that animates on
// its own, so it never redraws.

import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE_ALT, sceneSvg } from './scene'

const SCENE = 'rainy-window'

// Cream paper and ink by day, a lamp-lit navy by night, to match the scene.
const { theme, problems } = makeColors({
  label: 'Rainy window',
  roles: { accent: '#5562C9', danger: '#C9553E', success: '#4E8B62', warning: '#D9892F', pro: '#7E5FC0' },
  light: {
    gray: {
      anchors: { 'surface-0': '#E9E3D6', 'surface-1': '#F0EBE1', 'surface-2': '#F6F2EA', 'text-primary': '#1F1F26', 'text-secondary': '#45444F', 'text-muted': '#5F5D68' },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#12142A',
        'surface-1': '#181B33',
        'surface-2': '#1D2140',
        'surface-3': '#22264A',
        'text-primary': '#EDE6D6',
        'text-secondary': '#CBC3B3',
        'text-muted': '#A8A192',
      },
    },
  },
})

// Colors and backdrop go in the same call: a later $.theme call replaces both.
const THEME: ThemeSetArgs = { colors: theme, backdrop: { scene: SCENE, glass: { blur: 18, opacity: 0.62 } } }

async function setTheme($: EngineInterface) {
  const set = await $.theme.set(THEME)
  if (!set.isDrawn) $.ui.log(`rainy-window: the theme is set but not drawn here: ${set.reason}`, { to: 'debug' })
  return set
}

export const register: Register = on => {
  // Neither a reload of this mod nor --resume keeps a theme, so set it here.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'rainy-window', description: 'The rainy window theme: /rainy-window off | on' })
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) $.ui.toast(`rainy-window: ${unpainted}`)
    if ((await $.store.get('off')) !== true) await setTheme($)
    return next(e)
  })

  on('command.run', { command: 'rainy-window' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'off') {
      await $.store.set('off', true)
      await $.theme.clear()
      return { text: 'The rainy window is off and the app has its own look again. /rainy-window on brings it back.' }
    }
    if (arg === 'on' || arg === '') {
      await $.store.delete('off')
      const set = await setTheme($)
      return { text: set.isDrawn ? 'The rainy window is on.' : `The rainy window is on, but nothing here draws it: ${set.reason}` }
    }
    return { text: 'Try /rainy-window off or /rainy-window on.' }
  })

  // The scene itself. This hook hears every mod's backdrop, and another mod
  // could use the same scene name, so it draws only its own.
  //
  //
  // The desktop app moves a backdrop only when the drawing passes its check:
  // a short list of SVG elements and CSS functions, no viewport units, no
  // media queries but reduced motion's, and cheap enough to draw each frame.
  // Anything else it draws as a still copy. scene.ts keeps to those rules.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const { Svg } = $.ui.resolve(e)
    return Svg({ source: sceneSvg(), alt: SCENE_ALT })
  })
}
