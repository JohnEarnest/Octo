/**
* Recording animated GIFs
*
* For the sake of simplicity, this does not perform ANY LZW compression
* or windowing, but does squash together identical sequential frames.
**/

function gifBuilder(width, height, colors) {
	const buffer = []
	const b = x => buffer.push(x & 0xFF)
	const s = x => { b(x); b(x >> 8) }
	const t = x => x.split('').forEach(x => b(x.charCodeAt(0)))

	t('GIF89a') // header
	s(width)
	s(height)
	b(241)      // global colortable, 8-bits per channel, 4 colors
	b(0)        // background color index
	b(0)        // 1:1 pixel aspect ratio
	colors.forEach(x => { b(x>>16); b(x>>8); b(x) })

	return {
		comment: text => {
			s(0xFE21)      // comment extension block
			b(text.length) // payload size
			t(text)        // payload
			b(0)           // terminator
		},
		loop: count => {
			s(0xFF21)      // application extension block
			b(11)          // name/version size
			t('NETSCAPE2.0')
			b(3)           // payload size
			b(1)           // data sub-block index
			s(count)       // repeat count (0 is forever)
			b(0)           // terminator
		},
		frame: (pixels,delay) => {
			s(0xF921)      // graphic control extension
			b(4)           // payload size
			b(4)           // do not dispose frame
			s(delay)       // n/100 seconds
			b(0)           // no transparent color
			b(0)           // terminator

			b(0x2C)        // image descriptor
			s(0)           // x offset
			s(0)           // y offset
			s(width)
			s(height)
			b(0)           // no local colortable
			b(7)           // minimum LZW code size
			for (var off = 0; off < pixels.length; off += 64) {
				b(1 + 64) // block size
				b(0x80)   // CLEAR
				pixels.slice(off, off+64).forEach(b)
			}
			b(0) // end of frame
		},
		finish: _ => { b(0x3B); return buffer },
	}
}

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
		saveAs(new Blob([new Uint8Array(currentRecording.finish())], {type: 'image/gif'}), 'recording.gif')
		runRecord.src = 'images/record.png'
		currentRecording = null
	}
}
