/**
* Sprite editor:
**/

const SPRITE_SCALE  = 16
const spriteDraw    = document.getElementById('sprite-draw')
const sprite16      = toggleButton(document.getElementById('sprite-16'), 0, changeSpriteSize)
const spriteColor   = toggleButton(document.getElementById('sprite-color'), 0, updateSpriteEditor)
const spritePalette = radioBar(document.getElementById('sprite-palette'), 1, x => {})
const spriteEditor  = textBox(document.getElementById('sprite-editor'), false, '')
const spriteBlend   = textBox(document.getElementById('sprite-blend'), false, '')

function spriteLength() { return (sprite16.getValue() ? 32 : 15) * (spriteColor.getValue() ? 2 : 1) }
function spriteDim(big) { return big ? { rows:16, cols:16 } : { rows:15, cols:8 } }

/**
* Model:
**/

var spritePixels = []

function clampSpriteData() {
  for (var z = spriteLength()+1; z < 64; z++) { spritePixels[z] = 0 }
}
function spritePixel(x,y,wide) {
  const index = wide ? (y*2)+(x > 7 ? 1:0) : y
  return {
    mask:   128 >> (x % 8),
    layer1: index,
    layer2: index + (wide ? 32 : 15),
  }
}
function getSpritePixel(x,y,wide,color) {
  var t = spritePixel(x,y,wide)
  const c1     = !!(t.mask & spritePixels[t.layer1])
  const c2     = !!(t.mask & spritePixels[t.layer2])
  return c1 + (2 * (c2 & color))
}
function setSpritePixel(x,y,wide,color,p) {
  if (x >= (wide ? 16 :  8)) return
  if (y >= (wide ? 16 : 15)) return
  var t = spritePixel(x,y,wide)
  spritePixels[t.layer1] = (spritePixels[t.layer1] & ~t.mask) | ((-!!(p&1))&t.mask)
  spritePixels[t.layer2] = (spritePixels[t.layer2] & ~t.mask) | ((-!!(p&2))&t.mask)
}

/**
* Shifting and Clipping:
**/

function getSpritePixels(dim, dx, dy) {
  const c = spriteColor.getValue()
  return range(dim.rows).map(row => {
    return range(dim.cols).map(col => {
      return getSpritePixel(mod(col - dx, dim.cols), mod(row - dy, dim.rows), dim.cols == 16, c)
    })
  })
}
function setSpritePixels(dim, pix) {
  const c = spriteColor.getValue()
  range(dim.rows).forEach(row => {
    range(dim.cols).forEach(col => {
      setSpritePixel(col, row, dim.cols == 16, c, (pix[row]||[])[col]||0)
    })
  })
}
function changeSpriteSize(toBig) {
  setSpritePixels(spriteDim(toBig), getSpritePixels(spriteDim(!toBig), 0, 0))
  updateSpriteEditor()
}
function scrollSprite(dx, dy) {
  const dim = spriteDim(sprite16.getValue())
  setSpritePixels(dim, getSpritePixels(dim, dx, dy))
  updateSpriteEditor()
}
function spriteFlipH(){ // Flip Horizontally
  const c = spriteColor.getValue()
  const dim = spriteDim(sprite16.getValue())
  setSpritePixels(dim, range(dim.rows).map(row => {
    return range(dim.cols).map(col => {
      return getSpritePixel(dim.cols-col-1, row,dim.cols == 16, c)
    })
  }));
}
function spriteFlipV(){ // Flip Vertically
  const c = spriteColor.getValue()
  const dim = spriteDim(sprite16.getValue())
  setSpritePixels(dim, range(dim.rows).map(row => {
    return range(dim.cols).map(col => {
      return getSpritePixel(col,dim.rows-row-1,dim.cols == 16, c)
    })
  }));
}
function spriteFlipD(){ // Flip Diagonally
  const c = spriteColor.getValue()
  const dim = spriteDim(sprite16.getValue())
  setSpritePixels(dim, range(dim.rows).map(row => {
    return range(dim.cols).map(col => {
      return getSpritePixel(row,col,dim.cols == 16, c)
    })
  }));
}

/**
*  Blending:
**/

function spriteBlendSwap(){
  let temp = readBytes(spriteBlend, spriteLength());
  showHex(spriteBlend,spritePixels);
  showHex(spriteEditor,temp);
  spritePixels = temp; updateSpriteEditor();
}

function spriteBlendOR(){
  let temp = readBytes(spriteBlend, spriteLength());
  for(var i=0;i<temp.length;i++) spritePixels[i] |= temp[i];
  showHex(spriteEditor,spritePixels); updateSpriteEditor();
}

function spriteBlendAND(){
  let temp = readBytes(spriteBlend, spriteLength());
  for(var i=0;i<temp.length;i++) spritePixels[i] &= temp[i];
  showHex(spriteEditor,spritePixels); updateSpriteEditor();
}

function spriteBlendXOR(){
  let temp = readBytes(spriteBlend, spriteLength());
  for(var i=0;i<temp.length;i++) spritePixels[i] ^= temp[i];
  showHex(spriteEditor,spritePixels); updateSpriteEditor();
}

/**
* Data binding:
**/

// important: loop-breaker!
// CodeMirror itself does not detect when a modification triggers a revalidation,
// and does not ignore writes that are identical to the current data.
var spriteHandlingRefresh = false

function showHex(target, data) {
  if (spriteHandlingRefresh) return
  writeBytes(target, spriteLength(), data)
}

spriteEditor.on('change', _ => {
  if (spriteHandlingRefresh) return
  spriteHandlingRefresh = true
  spritePixels = readBytes(spriteEditor, spriteLength())
  updateSpriteEditor()
  spriteHandlingRefresh = false
})

/**
* Rendering:
**/

function showSprite() {
  const c = spriteColor.getValue()
  const d = spriteDim(sprite16.getValue())
  const g = spriteDraw.getContext('2d')
  g.fillStyle = getColor(0)
  g.fillRect(0, 0, spriteDraw.width, spriteDraw.height)
  range(d.rows).forEach(row => {
    range(d.cols).forEach(col => {
      g.fillStyle = getColor(getSpritePixel(col, row, d.cols == 16, c))
      g.fillRect(col * SPRITE_SCALE, row * SPRITE_SCALE, SPRITE_SCALE, SPRITE_SCALE)
    })
  })
}

/**
* Main:
**/
document.getElementById('sprite-clear' ).onclick = _ => {
  spritePixels = []; updateSpriteEditor() }
document.getElementById('sprite-invert').onclick = _ => {
  spritePixels = spritePixels.map(_=>_^255); updateSpriteEditor()  }

document.getElementById('sprite-left' ).onclick = _ => scrollSprite(-1, 0)
document.getElementById('sprite-right').onclick = _ => scrollSprite( 1, 0)
document.getElementById('sprite-up'   ).onclick = _ => scrollSprite( 0,-1)
document.getElementById('sprite-down' ).onclick = _ => scrollSprite( 0, 1)
document.getElementById('sprite-swap' ).onclick = _ => spriteBlendSwap()
document.getElementById('sprite-or'   ).onclick = _ => spriteBlendOR()
document.getElementById('sprite-and'  ).onclick = _ => spriteBlendAND()
document.getElementById('sprite-xor'  ).onclick = _ => spriteBlendXOR()
document.getElementById('sprite-hflip').onclick = _ => (spriteFlipH(),updateSpriteEditor())
document.getElementById('sprite-vflip').onclick = _ => (spriteFlipV(),updateSpriteEditor())
document.getElementById('sprite-rotCW').onclick = _ => (spriteFlipD(),spriteFlipH(),updateSpriteEditor())
document.getElementById('sprite-rotCC').onclick = _ => (spriteFlipD(),spriteFlipV(),updateSpriteEditor())

const spriteRotCW = document.getElementById('sprite-rotCW')
const spriteRotCC = document.getElementById('sprite-rotCC')

drawOnCanvas(spriteDraw, (x, y, draw) => {
  setSpritePixel(
    Math.floor(x / SPRITE_SCALE),
    Math.floor(y / SPRITE_SCALE),
    sprite16.getValue(),
    spriteColor.getValue(),
    draw ? spritePalette.getValue() : 0
  )
  updateSpriteEditor()
})

function updateSpriteEditor() {
  document.querySelectorAll('#sprite-palette>span').forEach((x,i) => {
    x.style.backgroundColor = getColor(i)
  })
  
  if (sprite16.getValue()) {
    spriteDraw.width  = SPRITE_SCALE * 16
    spriteDraw.height = SPRITE_SCALE * 16
    spriteRotCC.style.display = "block"
    spriteRotCW.style.display = "block"
  }
  else {
    spriteDraw.width  = SPRITE_SCALE * 8
    spriteDraw.height = SPRITE_SCALE * 15
    spriteRotCC.style.display = "none"
    spriteRotCW.style.display = "none"
  }
  if (!spriteColor.getValue()) {
    spritePalette.setValue(1)
  }
  spritePalette.setVisible(spriteColor.getValue())
  spriteEditor.refresh()
  spriteBlend.refresh()

  clampSpriteData()
  showHex(spriteEditor,spritePixels)
  showSprite()
}

clampSpriteData()
showHex(spriteBlend,spritePixels)