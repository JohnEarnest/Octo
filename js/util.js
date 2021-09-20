/**
* Misc. utility functions
**/

const emulator = new Emulator()

function range(x) { return Array.apply(undefined, Array(x)).map((_, i) => i) }
function zip(a, b, dyad) { return a.map((x,i) => dyad(x, b[i])) }
function mod(x, y) { x %= y; if (x < 0) x += y; return x }
function toset(x) { return x.reduce((a,b) => (a[b]=1,a), {}) }
function distinct(x) { return Object.keys(toset(x)) }
function except(x, y) { return Object.keys(x.reduce((a,b) => (b!=y?a[b]=1:0,a), {})) }

const FORMATS = { dec:decimalFormat, hex:hexFormat, bin:binaryFormat, default:hexFormat }
function zeroPad(str, n) { const d = str.length % n; return (d == 0 ? '' : '00000000'.substr(0, n - d)) + str }
function decimalFormat(n)         { return n.toString(10) }
function hexFormat    (n)         { return '0x' + zeroPad(n.toString(16).toUpperCase(), 2) }
function binaryFormat (n)         { return '0b' + zeroPad(n.toString(2), 8) }
function maskFormat   (n)         { return emulator.maskFormatOverride ? binaryFormat(n) : numericFormat(n) }
function numericFormat(n, format) { return (FORMATS[format||emulator.numericFormatStr])(n) }

const saveFile=(n,u)=>{const t=document.querySelector('#mainlink');t.download=n,t.href=u,t.click()}
const saveText=(n,x)=>{saveFile(n,`data:text/plain;base64,${btoa(x)}`)}
const saveGif =(n,x)=>{saveFile(n,`data:image/octet-stream;base64,${btoa(x.map(x=>String.fromCharCode(x)).join(''))}`)}
const saveBin =(n,x)=>{saveFile(n,`data:application/octet-stream;base64,${btoa(x.map(x=>String.fromCharCode(x)).join(''))}`)}

function ajax(method, url, payload, then) {
  const x = new XMLHttpRequest()
  x.open(method, url)
  x.onreadystatechange = _ => {
    if (x.readyState != 4) return
    if (method == 'GET' && x.status != 200) {
      setStatusMessage('Unable to retrieve <tt>' + url +'</tt>', false)
      return
    }
    then(JSON.parse(x.responseText), x.status)
  }
  x.send(payload ? JSON.stringify(payload) : null)
}

function readBytes(source, size) {
  const tokens = source.getValue().trim().split(/\s+/)
  return zip(range(size || tokens.length), tokens, (_,x) => {
    return ((x||'').slice(0,2)=='0b' ? parseInt(x.slice(2),2) : +x)||0
  })
}
function writeBytes(target, size, bytes) {
  target.setValue(zip(range(size || bytes.length), bytes, (_,x) => hexFormat(x & 0xFF)).join(' '))
}
function getBit(bytes, n) {
  return (bytes[Math.floor(n / 8)] >> (7-Math.floor(n % 8))) & 1
}
function setBit(bytes, n, v) {
  const mask = 128 >> Math.floor(n % 8)
  bytes[Math.floor(n / 8)] = (bytes[Math.floor(n / 8)] & ~mask) | (mask * v)
}
function drawOnCanvas(target, eventPress, eventRelease=(a,b,c)=>c) {
  var mode = 0
  function drag(event) {
    if (mode == 0) { return }
    const r = target.getBoundingClientRect()
    eventPress(
      event.clientX - r.left,
      event.clientY - r.top,
      mode
    )
  }
  function release(event) {
    const r = target.getBoundingClientRect()
    eventRelease(
      event.clientX - r.left,
      event.clientY - r.top,
      mode
    )
    mode = 0;
  }
  function press  (event) { mode = event.button == 2 ? 2 : 1; drag(event) }
  function context(event) { drag(event); return false }
  target.onmousemove   = drag
  target.onmouseup     = release
  target.onmouseout    = release
  target.onmousedown   = press
  target.oncontextmenu = context
}

function setVisible(element, value, disp) {
  element.style.display = value ? disp || (element.tagName == 'SPAN' ? 'inline' : 'block') : 'none'
}

function radioBar(element, value, change) {
  element.classList.add('radiobar')
  const get = _ => element.querySelector('span.selected').dataset.value
  const set = v => (element.querySelectorAll('span').forEach(x => {
    x.classList.toggle('selected', x.dataset.value == v)
  }), v)
  const vis = x => element.style.display = x ? 'flex' : 'none'
  element.querySelectorAll('span').forEach(x => x.onclick = _ => change(set(x.dataset.value)))
  set(value)
  return { getValue: get, setValue: set, setVisible: vis }
}

function checkBox(element, value, change) {
  element.classList.add('checkbox')
  const c = document.createElement('span')
  c.classList.add('check')
  element.prepend(c)
  const get = _ => c.classList.contains('selected')
  const set = x => (c.classList.toggle('selected', x), x)
  c.onclick = _ => change(set(!get()))
  set(value)
  return { getValue: get, setValue: set }
}

function toggleButton(element, value, change) {
  const get = _ => element.classList.contains('selected')
  const set = x => (element.classList.toggle('selected', x), x)
  element.onclick = _ => change(set(!get()))
  set(value)
  return { getValue: get, setVisible: set }
}

function menuChooser(element, value, change) {
  const get = _ => element.querySelector('li.selected').dataset.value
  const set = v => (element.querySelectorAll('li').forEach(x => {
    x.classList.toggle('selected', x.dataset.value == v)
  }), v)
  element.querySelectorAll('li').forEach(x => x.onclick = _ => change(set(x.dataset.value)))
  set(value)
  return { getValue: get, setValue: set }
}

function textBox(element, readonly, value) {
  return CodeMirror(element, {
    mode:         'none',
    readOnly:     readonly,
    theme:        'monokai',
    lineNumbers:  false,
    lineWrapping: true,
    value:        value,
  })
}
