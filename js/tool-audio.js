/**
* Audio editor:
**/

const audioPatternEditor = textBox(document.getElementById('audio-pattern-editor'), false, '')
const audioPatternCanvas = document.getElementById('audio-pattern-view')
const audioToneDuty = radioBar(document.getElementById('audio-tone-duty'), '2', x => {})

const PATTERN_SIZE = 16
const PATTERN_SCALE = 2
const emptySound = range(PATTERN_SIZE).map(_ => 0)
function readPattern(source)         { return readBytes(source, PATTERN_SIZE) }
function writePattern(target, bytes) { return writeBytes(target, PATTERN_SIZE, bytes) }
writePattern(audioPatternEditor, emptySound)

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

/**
* Pattern panel
**/

const audioPitch = document.getElementById('audio-pitch')

drawOnCanvas(audioPatternCanvas, (x, y, draw) => {
	const index   = Math.min(PATTERN_SIZE*8, Math.max(0, Math.floor(x / PATTERN_SCALE)))
	const pattern = readPattern(audioPatternEditor)
	setBit(pattern, index, draw)
	writePattern(audioPatternEditor, pattern)
	updateAudio()
})
function audioPreview(){
	const pitch = Math.max(0,Math.min(+audioPitch.value,255))
	if (audioSetup(emulator)) {
		playPattern(0.5, readPattern(audioPatternEditor),undefined,undefined,pitch)
	}
	else {
		document.getElementById('audio-error').innerHTML = 'Your browser does not support HTML5 Audio!'
	}
}
document.getElementById('audio-play').onclick = _ => audioPreview()
document.getElementById('audio-random').onclick = _ => {
	audioPitch.value=(Math.random() * 256) & 0xFF
	writePattern(audioPatternEditor, emptySound.map(_ => (Math.random() * 256) & 0xFF))
	updateAudio()
	audioPreview()
}
document.getElementById('audio-clear').onclick = _ => {
	writePattern(audioPatternEditor, emptySound)
	updateAudio()
}

/**
* Tone Generator panel
**/

document.getElementById('audio-generate').onclick = _ => {
	const duty = audioToneDuty.getValue()
	const freq = +document.getElementById('audio-freq').value
	const pulse = Math.ceil(document.getElementById('audio-pulse').value*duty)
	writePattern(audioPatternEditor, emptySound.map((_,i) => {
		let r=0
		for(let b=0;b<8;b++) r |= ((i*8+b)%duty<pulse?1:0)*(1<<(7-b))
		return r
	}))
	const pitch = Math.log2((freq*duty)/4000)*48+64
	audioPitch.value=0|Math.max(0,Math.min(pitch,255))
	updateAudio()
	audioPreview()
}

/**
* Main
**/

function updateAudio() {
	audioPatternEditor.refresh()
	drawBytes(audioPatternCanvas, readPattern(audioPatternEditor))
}
audioPatternEditor.on('change', updateAudio)
