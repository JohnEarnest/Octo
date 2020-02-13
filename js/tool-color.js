/**
* Color settings:
**/

const paletteKeys = [
  'backgroundColor',
  'fillColor',
  'fillColor2',
  'blendColor',
  'buzzColor',
  'quietColor',
]
const palettes = {
  octo:   ['#996600','#FFCC00','#FF6600','#662200','#FFAA00','#000000'],
  lcd:    ['#0F380F','#306230','#8BAC0F','#9BBC0F','#333333','#000000'],
  hotdog: ['#000000','#FF0000','#FFFF00','#FFFFFF','#990000','#330000'],
  gray:   ['#AAAAAA','#000000','#FFFFFF','#666666','#666666','#000000'],
  cga0:   ['#000000','#00FF00','#FF0000','#FFFF00','#999900','#333300'],
  cga1:   ['#000000','#FF00FF','#00FFFF','#FFFFFF','#990099','#330033'],
}

const palettePresets = radioBar(document.getElementById('palette-presets'), 'octo', x => {
  zip(paletteKeys, palettes[x], (a,b) => emulator[a] = b)
  saveLocalOptions()
  updateColor()
})

const fontChoices = radioBar(document.getElementById('emulator-fonts'), 'octo', x => {
  emulator.fontStyle = x
  saveLocalOptions()
  updateColor()
})

document.querySelectorAll('#color-table tr input').forEach((input,i) => {
  function update() {
    emulator[paletteKeys[i]] = input.value
    saveLocalOptions()
    updateColor()
  }
  input.onkeyup  = update
  input.onchange = update
})

function updateColor() {
  document.querySelectorAll('#color-table tr').forEach((row,i) => {
    const v = emulator[paletteKeys[i]]
    row.querySelector('.swatch').style.background = v
    row.querySelector('input').value              = v
  })
  palettePresets.setValue('none')
  for (key in palettes) {
    if (paletteKeys.every((x,i) => emulator[x] == palettes[key][i])) palettePresets.setValue(key)
  }

  // draw font choice
  const fg = document.getElementById('font-draw').getContext('2d')
  const FSCALE = 2
  fg.fillStyle = emulator.backgroundColor
  fg.fillRect(0, 0, FSCALE * 145, FSCALE * 23)
  fg.fillStyle = emulator.fillColor

  const drawChar = (font,xoff,yoff,w,h,c) => {
    for(var y = 0; y < h; y++) {
      for(var x = 0; x < w; x++) {
        if ((font[c * h + y] >> (7-x) & 1) == 0) continue
        fg.fillRect(FSCALE * (9 * c + x + xoff), FSCALE * (y + yoff), FSCALE, FSCALE)
      }
    }
  }
  const fonts = fontsets[emulator.fontStyle]
  for(let z = 0; z < 16; z++) {
    drawChar(fonts.small, 1, 1,5, 5,z)
    drawChar(fonts.big,   1,11,8,10,z)
  }
}
