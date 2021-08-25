/**
* Audio editor:
**/

const audioPatternEditor = textBox(document.getElementById('audio-pattern-editor'), false, '')
const audioBlendEditor   = textBox(document.getElementById('audio-blend-editor'), false, '')
const audioToneEditor    = textBox(document.getElementById('audio-tone-editor'), true, '')
const audioPatternCanvas = document.getElementById('audio-pattern-view')
const audioToneCanvas    = document.getElementById('audio-tone-view')

const PATTERN_SIZE = 16
const PATTERN_SCALE = 2
const emptySound = range(PATTERN_SIZE).map(_ => 0)
function readPattern(source)         { return readBytes(source, PATTERN_SIZE) }
function writePattern(target, bytes) { return writeBytes(target, PATTERN_SIZE, bytes) }
writePattern(audioPatternEditor, emptySound)
writePattern(audioBlendEditor,   emptySound)

var audioPreview;

function shiftBytes(bytes, n) {
	const r = bytes.map(x => x)
	for (var x = 0; x < bytes.length*8; x++) {
		setBit(r, x, getBit(bytes, mod(x+n, bytes.length*8)))
	}
	return r
}
function drawBytes(target, bytes) {
	const w = target.width
	const h = target.height
	const g = target.getContext('2d')
	g.fillStyle = emulator.backgroundColor
	g.fillRect(0, 0, w, h)
	g.fillStyle = emulator.fillColor
	range(8*PATTERN_SIZE).forEach(z => {
		const a = Math.floor(z / 8)
		const b = 7 - Math.floor(z % 8)
		g.fillRect(z * PATTERN_SCALE, 0, PATTERN_SCALE * ((bytes[a] >> b) & 1), 32)
	})
}
function generateFrequency(frequency, cutoff) {
	const w = audioToneCanvas.width
	const h = audioToneCanvas.height
	const g = audioToneCanvas.getContext('2d')
	g.fillStyle = emulator.backgroundColor
	g.fillRect(0, 0, w, h)
	g.fillStyle = emulator.fillColor

	// Samples are played at 4000 samples/second.
	// 128 samples is (1 seconds / 4000 * 128) = .032 seconds.
	// This also means that a full 128 bit pattern is ~ 2/60ths of a second.
	// A sine wave at N hz would be given by sin(t * N * 2Pi).
	var word = 0, r = []
	for(var z = 0; z < 8*PATTERN_SIZE; z++) {
		var t = z * (1 / 4000)                         // time in seconds
		var v = Math.sin(t * frequency * 2 * Math.PI)  // sine wave
		var s = Math.floor((v + 1) * 128)              // offset and scale

		word = (word << 1) | ((s >= cutoff) ? 1 : 0)
		if ((z % 8) == 7) { r.push(word); word = 0 }

		g.fillStyle = emulator.fillColor2
		g.fillRect(z*(w/128), h-(s*(h/256)), (w/128), s*(h/256))
		if (s >= cutoff) {
			g.fillStyle = emulator.fillColor
			g.fillRect(z*(w/128), h-(cutoff*(h/256)), (w/128), cutoff*(h/256))
		}
	}
	return r
}

/**
* Pattern panel
**/

drawOnCanvas(audioPatternCanvas, (x, y, draw) => {
	const index   = Math.min(PATTERN_SIZE*8, Math.max(0, Math.floor(x / PATTERN_SCALE)))
	const pattern = readPattern(audioPatternEditor)
	setBit(pattern, index, draw)
	writePattern(audioPatternEditor, pattern)
	updateAudio()
})

document.getElementById('audio-play').onclick = _ => {
	if (!audioPreview) audioPreview = new audioEngine();
	if (audioPreview) {
		var curTime = audio.currentTime;
		audioPreview.setBuffer(readPattern(audioPatternEditor));
		audioPreview.setGain(1,curTime);
		audioPreview.setGain(0,0.5+curTime);
		audioPreview.setTimer(255); audioPreview.refresh();
		audioEnable();
	}
	else {
		document.getElementById('audio-error').innerHTML = 'Your browser does not support HTML5 Audio!'
	}
}
document.getElementById('audio-random').onclick = _ => {
	writePattern(audioPatternEditor, emptySound.map(_ => (Math.random() * 256) & 0xFF))
	updateAudio()
}
document.getElementById('audio-clear').onclick = _ => {
	writePattern(audioPatternEditor, emptySound)
	updateAudio()
}
document.getElementById('audio-left').onclick = _ => {
	writePattern(audioPatternEditor, shiftBytes(readPattern(audioPatternEditor), 1))
	updateAudio()
}
document.getElementById('audio-right').onclick = _ => {
	writePattern(audioPatternEditor, shiftBytes(readPattern(audioPatternEditor), -1))
	updateAudio()
}
document.getElementById('audio-not').onclick = _ => {
	writePattern(audioPatternEditor, readPattern(audioPatternEditor).map(a => ~a))
	updateAudio()
}

/**
* Blend panel
**/

document.getElementById('audio-and').onclick = _ => {
	writePattern(audioPatternEditor, zip(
		readPattern(audioPatternEditor),
		readPattern(audioBlendEditor),
		(a,b) => a&b
	))
	updateAudio()
}
document.getElementById('audio-or').onclick = _ => {
	writePattern(audioPatternEditor, zip(
		readPattern(audioPatternEditor),
		readPattern(audioBlendEditor),
		(a,b) => a|b
	))
	updateAudio()
}
document.getElementById('audio-xor').onclick = _ => {
	writePattern(audioPatternEditor, zip(
		readPattern(audioPatternEditor),
		readPattern(audioBlendEditor),
		(a,b) => a^b
	))
	updateAudio()
}
document.getElementById('audio-swap').onclick = _ => {
	const a = readPattern(audioPatternEditor)
	const b = readPattern(audioBlendEditor)
	writePattern(audioPatternEditor, b)
	writePattern(audioBlendEditor,   a)
	updateAudio()
}

/**
* Tone Generator panel
**/

const audioFreq   = document.getElementById('audio-freq')
const audioCutoff = document.getElementById('audio-cutoff')

function updateAudioTone() {
	writePattern(audioToneEditor, generateFrequency(
		(+audioFreq.value)   || 0,
		(+audioCutoff.value) || 0
	))
}
updateAudioTone()

audioFreq.onchange   = updateAudioTone
audioFreq.onkeyup    = updateAudioTone
audioCutoff.onchange = updateAudioTone
audioCutoff.onkeyup  = updateAudioTone

document.getElementById('audio-toblend').onclick = _ => {
	writePattern(audioBlendEditor, readPattern(audioToneEditor))
	updateAudio()
}
document.getElementById('audio-topat').onclick = _ => {
	writePattern(audioPatternEditor, readPattern(audioToneEditor))
	updateAudio()
}

/**
* Main
**/

function updateAudio() {
	audioPatternEditor.refresh()
	audioBlendEditor.refresh()
	audioToneEditor.refresh()
	drawBytes(audioPatternCanvas, readPattern(audioPatternEditor))
	updateAudioTone()
}
audioPatternEditor.on('change', updateAudio)
