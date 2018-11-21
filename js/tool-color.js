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
}
