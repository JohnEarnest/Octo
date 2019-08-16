/**
* Binary tools:
**/

const binaryInput    = document.getElementById('fileinput')
const binaryFilename = document.getElementById('binary-filename')
const binaryEditor   = textBox(document.getElementById('binary-editor'), false, '')
const decompilerMode = radioBar(document.getElementById('decompiler-mode'), 'static', x => {})
radioBar(document.getElementById('decompiler-numbers'), 'hex', x => emulator.numericFormatStr = x)

function decompileRaw(rom) {
	var r = '\n: main\n'
	for(var x = 0; x < rom.length; x += 2) {
		var a = rom[x  ] | 0
		var b = rom[x+1] | 0
		r += '\t' + hexFormat(a) + ' ' + hexFormat(b) + ' # ' + hexFormat(0x200 + x)
		r += '\t' + formatInstruction(a, b)
		r += '\n'
	}
	editor.setValue('# decompiled program:\n' + r)
}
function decompileStatic(rom) {
	const decompileCover = document.getElementById('decompile-cover')
	setVisible(decompileCover, true, 'flex')
	analyzeInit(rom, {
		shiftQuirks:     emulator.shiftQuirks,
		loadStoreQuirks: emulator.loadStoreQuirks,
		vfOrderQuirks:   emulator.vfOrderQuirks,
		jumpQuirks:      emulator.jumpQuirks,
	})
	const process = _ => {
		var finished = false;
		for(var z = 0; z < 100 && !finished; z++) { finished |= analyzeWork() }
		if (!finished) {
			window.setTimeout(process, 0)
			return
		}
		analyzeFinish()
		setVisible(decompileCover, false)
		editor.setValue('# decompiled program:\n' + formatProgram(rom.length))
	}
	process()
}

/**
* UI Glue
**/

binaryInput.onchange = _ => {
	const reader = new FileReader()
	reader.onload = _ => writeBytes(binaryEditor, null, new Uint8Array(reader.result))
	reader.readAsArrayBuffer(binaryInput.files[0])
}
document.getElementById('binary-decompile').onclick = _ => {
	(decompilerMode.getValue() == 'static' ? decompileStatic : decompileRaw)(readBytes(binaryEditor))
}
document.getElementById('binary-run').onclick = _ => {
	runRom({ rom:readBytes(binaryEditor), breakpoints:{}, aliases:{}, labels:{} })
}
document.getElementById('binary-open').onclick = _ => {
	binaryInput.click()
}
document.getElementById('binary-save-ch8').onclick = _ => {
	var prog = compile()
	if (prog == null) { return }
	const name = binaryFilename.value
	saveAs(new Blob([new Uint8Array(prog.rom)], {type: 'application/octet-stream'}), name+'.ch8')
}
document.getElementById('binary-save-8o').onclick = _ => {
	const name = binaryFilename.value
	saveAs(new Blob([editor.getValue()], {type: 'text/plain;charset=utf-8'}), name+'.8o')
}
document.getElementById('binary-save-cart').onclick = _ => {
	const name = binaryFilename.value
	document.getElementById('cartridge-filename').innerText = name + '.gif'
	drawCartridgePreview()
	setVisible(cartModal, true, 'flex')
	cartImageBytes = null
	cartDesc.setValue('')
}
writeBytes(binaryEditor, null, [0xD0, 0x15, 0x70, 0x04, 0x40, 0x40, 0x71, 0x05, 0x40, 0x40, 0x60, 0x00, 0x12, 0x00])

function updateBinary() {
	binaryEditor.refresh()
}

/**
* Cartridge Builder
**/

const cartModal      = document.getElementById('cartridge-modal')
const cartError      = document.getElementById('cartridge-err')
const cartImage      = document.getElementById('cartridge-image')
const cartPreview    = document.getElementById('cartridge-preview')
const cartDesc       = textBox(document.getElementById('cartridge-desc'), false, '')
let   cartImageBytes = null

function getCartridgeLabel() {
	return cartDesc.getValue() ||
		binaryFilename.value + '\n' + (new Date().toISOString().replace('T','\n'))
}
function validateCartridgeImage() {
	cartError.innerText = ''
	if (!cartImageBytes) return null
	try {
		const g = gifDecode(cartImageBytes)
		if (g.width != 128 || g.height != 64) {
			cartImageBytes = null
			cartError.innerText = 'Label images must be 128x64.'
		}
		return g
	}
	catch(e) {
		cartImageBytes = null
		cartError.innerText = 'Unable to decode GIF: '+e
		return null
	}
}
function drawCartridgePreview() {
	const p = decorateCartridge(getCartridgeLabel(), validateCartridgeImage())
	const g = cartPreview.getContext('2d')
	const b = g.createImageData(p.width*2, p.height*2)
	p.frames[0].pixels.forEach((x,i) => {
		// 2x upscale on this sucker, the painful way.
		const c = p.frames[0].palette[x]
		const s = Math.floor(i / p.width) * p.width * 16 + (Math.floor(i % p.width) * 8)
		const t1 = s
		const t2 = s + 4
		const t3 = s + (p.width * 8)
		const t4 = s + (p.width * 8) + 4
		b.data[t1  ] = b.data[t2  ] = b.data[t3  ] = b.data[t4  ] = 0xFF & (c >> 16)
		b.data[t1|1] = b.data[t2|1] = b.data[t3|1] = b.data[t4|1] = 0xFF & (c >> 8)
		b.data[t1|2] = b.data[t2|2] = b.data[t3|2] = b.data[t4|2] = 0xFF & c
		b.data[t1|3] = b.data[t2|3] = b.data[t3|3] = b.data[t4|3] = 0xFF
	})
	g.putImageData(b, 0, 0)
}
cartPreview.onclick = _ => {
	cartImage.click()
}
cartImage.onchange = _ => {
	const reader = new FileReader()
	reader.onload = _ => { cartImageBytes = new Uint8Array(reader.result); drawCartridgePreview() }
	reader.readAsArrayBuffer(cartImage.files[0])
}
cartDesc.on('change', _ => {
	cartImageBytes = null
	drawCartridgePreview()
})
document.getElementById('cartridge-cancel').onclick = _ => {
	setVisible(cartModal, false)
}
document.getElementById('cartridge-save').onclick = _ => {
	const cart = buildCartridge(getCartridgeLabel(), preparePayload(), cartImageBytes)
	saveAs(new Blob([new Uint8Array(cart)], {type: 'image/gif'}), binaryFilename.value+'.gif')
	setVisible(cartModal, false)
}
