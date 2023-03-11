/**
* Options
**/

const compatProfile  = radioBar(document.getElementById('compatibility-profile'), 'octo', setCompatibilityProfile)
const screenRotation = radioBar(document.getElementById('screen-rotation'), 0, x => emulator.screenRotation = +x)

const compatibilityProfiles = {
  chip8: { shiftQuirks:0, loadStoreQuirks:0, clipQuirks:1, jumpQuirks:0, logicQuirks:1, vBlankQuirks:1, maxSize:3232  },
  schip: { shiftQuirks:1, loadStoreQuirks:1, clipQuirks:1, jumpQuirks:1, logicQuirks:0, vBlankQuirks:0, maxSize:3583  },
  octo:  { shiftQuirks:0, loadStoreQuirks:0, clipQuirks:0, jumpQuirks:0, logicQuirks:0, vBlankQuirks:0, maxSize:3584  },
  xo:    { shiftQuirks:0, loadStoreQuirks:0, clipQuirks:0, jumpQuirks:0, logicQuirks:0, vBlankQuirks:0, maxSize:65024 },
}
const compatibilityFlags = {
  shiftQuirks:     checkBox(document.getElementById('compat-shift' ), false, setOptions),
  loadStoreQuirks: checkBox(document.getElementById('compat-load'  ), false, setOptions),
  clipQuirks:      checkBox(document.getElementById('compat-clip'  ), false, setOptions),
  jumpQuirks:      checkBox(document.getElementById('compat-jump0' ), false, setOptions),
  logicQuirks:     checkBox(document.getElementById('compat-logic' ), false, setOptions),
  vBlankQuirks:    checkBox(document.getElementById('compat-vblank'), false, setOptions),
  maxSize:         radioBar(document.getElementById('max-size'), 3584, setOptions),
}

function setCompatibilityProfile(x) {
  const p = compatibilityProfiles[x]
  for (key in compatibilityFlags) emulator[key] = p[key]
  saveLocalOptions()
  updateOptions()
}
function setOptions() {
  for (key in compatibilityFlags) emulator[key] = compatibilityFlags[key].getValue()
  saveLocalOptions()
  updateOptions()
}
function updateOptions() {
  for (key in compatibilityFlags) compatibilityFlags[key].setValue(emulator[key])
  screenRotation.setValue(emulator.screenRotation)
  compatProfile.setValue('none')
  for (key in compatibilityProfiles) {
    const p = compatibilityProfiles[key]
    const same = Object.keys(p).every(x => emulator[x] == p[x])
    if (same) compatProfile.setValue(key)
  }
}

/**
* Keyboard Config
**/

const keyConfigModal = document.getElementById('key-config-modal')
const vimMode=checkBox(document.getElementById('vim-mode'), getPref('octoVimMode'), x=>setPref('octoVimMode',x))

document.getElementById('key-config-show').onclick = _ => {
  keyConfigModal.querySelectorAll('table .button').forEach(x => {
    const k = x.dataset.key
    const i = keyConfigModal.querySelector(`table input[data-key="${k}"]`)
    i.value = Object.keys(keymap[parseInt(k,16)]).join(',')
    x.onclick = _ => {
      i.onkeydown = event => {
        event.stopPropagation()
        event.preventDefault()
        i.onkeydown = null
        keyConfigModal.querySelectorAll('table input').forEach(x => {
          x.value = except(x.value.split(','), event.key).join(',')
        })
        i.value = distinct(i.value.split(',').concat(event.key)).join(',')
      }
      i.focus()
    }
  })
  setVisible(keyConfigModal, true)
}

document.getElementById('key-config-done').onclick = _ => {
  keyConfigModal.querySelectorAll('table input').forEach(x => {
    const k = parseInt(x.dataset.key, 16)
    keymap[k] = toset(x.value.split(','))
  })
  keymapInverse = invertKeymap(keymap)
  setPref('octoKeymap', keymap)
  setVisible(keyConfigModal, false)
}

/**
* Touch Config
**/

const touchDescs = {
  none:      'Do not attempt to handle touch input.',
  swipe:     'Taps on the screen are treated like pressing key 6. Swipes or dragging and holding on the screen are treated like a virtual directional pad based on keys 5,8,7 and 9.',
  seg16:     'Treat taps and holds on the center of the screen like an invisible 4x4 hex keypad. Also supports mouse input.',
  seg16fill: 'The same as <b>Seg16</b>, but the virtual keys take up the entire display, rather than a square region. Also supports mouse input.',
  gamepad:   'Draw a translucent virtual gamepad around the screen. The directional pad is mapped to keys 5,8,7 and 9, and buttons A and B are mapped to keyboard keys 6 and 4, respectively.',
  vip:       'Display a 4x4 hex keypad under the screen. Also supports mouse input.',
}
function setTouchInputMode(mode) {
  emulator.touchInputMode = mode
  document.getElementById('touch-input-desc').innerHTML = touchDescs[mode]
}

const touchConfigModal = document.getElementById('touch-config-modal')
const touchInputMode = radioBar(document.getElementById('touch-input-mode'), 'none', setTouchInputMode)

document.getElementById('touch-config-show').onclick = _ => {
  touchInputMode.setValue(emulator.touchInputMode)
  setTouchInputMode(emulator.touchInputMode)
  setVisible(touchConfigModal, true)
}
document.getElementById('touch-config-done').onclick = _ => {
  injectAdaptiveControls(
    emulator.touchInputMode,
    document.getElementById('target'),
    window.onkeyup,
    window.onkeydown
  )
  saveLocalOptions()
  setVisible(touchConfigModal, false)
}
