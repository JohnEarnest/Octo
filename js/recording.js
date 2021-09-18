/**
*
* Recording animated GIFs
*
**/

function paletteToRGB(pal) {
	// convert CSS colors into packed RGB colors
	const g = document.createElement('canvas').getContext('2d')
	pal.forEach((x,i) => { g.fillStyle = x; g.fillRect(i, 0, 1, 1) })
	const d = g.getImageData(0, 0, pal.length, 1)
	return pal.map((_,i) => (d.data[i*4]<<16) | (d.data[i*4+1]<<8) | (d.data[i*4+2]))
}

const runRecord = document.getElementById('run-record')
var currentRecording = null
var heldFrame = null
var heldTicks = 1

function recordFrame() {
	if (currentRecording == null) return
	const last = document.getElementById(renderTarget).last
	if (last != undefined && arrayEqual(last.p[0], emulator.p[0]) && arrayEqual(last.p[1], emulator.p[1])) {
		heldTicks++
	}
	else {
		if (heldFrame != null) currentRecording.frame(heldFrame, heldTicks * 2)
		if (emulator.hires) {
			heldFrame = zip(emulator.p[0].slice(0,128*64), emulator.p[1], (a,b) => a | (b << 1))
		}
		else {
			heldFrame = range(128*64).map(x => {
				const i = Math.floor((x % 128) / 2) + 64 * Math.floor((x / 128) / 2)
				return emulator.p[0][i] | (emulator.p[1][i] << 1)
			})
		}
		heldTicks = 1
	}
}

runRecord.onclick = _ => {
	if (currentRecording == null) {
		runRecord.src = 'images/recording.png'
		const pal = [emulator.backgroundColor, emulator.fillColor, emulator.fillColor2, emulator.blendColor]
		currentRecording = gifBuilder(128, 64, paletteToRGB(pal))
		currentRecording.comment('made with octo on ' + new Date().toISOString())
		currentRecording.loop()
		heldFrame = null
		heldTicks = 1
		document.getElementById(renderTarget).last = undefined // flush repaint buffer
	}
	else {
		if (heldFrame != null) currentRecording.frame(heldFrame, heldTicks * 2)
		saveGif('recording.gif',currentRecording.finish())
		runRecord.src = 'images/record.png'
		currentRecording = null
	}
}
