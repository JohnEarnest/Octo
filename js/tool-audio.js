/**
* Audio editor:
**/

const audioPatternEditor = textBox(document.getElementById('audio-pattern-editor'), false, '')
const audioPatternCanvas = document.getElementById('audio-pattern-view')
const audioToneCanvas = document.getElementById('audio-tone-view')
const audioBlendMode = radioBar(document.getElementById('audio-blend-mode'), 'none', updateAudio)

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
function shiftBytes(bytes, n) {
	const r = bytes.map(x => x)
	for (var x = 0; x < bytes.length*8; x++) {
		setBit(r, x, getBit(bytes, mod(x+n, bytes.length*8)))
	}
	return r
}
function playBytes(pattern, pitch){
	if (audioSetup(emulator)) {
		playPattern(0.5,pattern,undefined,undefined,pitch)
	}
	else {
		document.getElementById('audio-error').innerHTML = 'Your browser does not support HTML5 Audio!'
	}
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
	playBytes(readPattern(audioPatternEditor), Math.max(0,Math.min(+audioPitch.value,255)))
}
document.getElementById('audio-left').onclick = _ => {
	writePattern(audioPatternEditor, shiftBytes(readPattern(audioPatternEditor), 1))
	updateAudio()
}
document.getElementById('audio-right').onclick = _ => {
	writePattern(audioPatternEditor, shiftBytes(readPattern(audioPatternEditor), -1))
	updateAudio()
}
document.getElementById('audio-play').onclick = _ => audioPreview()
document.getElementById('audio-random').onclick = _ => {
	audioPitch.value=(Math.random() * 256) & 0xFF
	writePattern(audioPatternEditor, emptySound.map(_ => (Math.random() * 256) & 0xFF))
	updateAudio()
	audioPreview()
}

/**
* Tone Generator panel
**/

const toneDuty  = document.getElementById('audio-width')
const tonePulse = document.getElementById('audio-pulse')
const toneFreq  = document.getElementById('audio-freq')

function audioBlend(){
	return ({
		none: (x,y)=>y,
		and : (x,y)=>x&y,
		or  : (x,y)=>x|y,
		xor : (x,y)=>x^y,
	})[audioBlendMode.getValue()]
}
function audioTone(){
	const duty=Math.max(0,Math.min(+toneDuty.value,255))
	const freq=+toneFreq.value
	const pulse=Math.ceil(tonePulse.value*duty)
	const blend=audioBlend()
	const pattern=readPattern(audioPatternEditor).map((old,i) => {
		let r=0
		for(let b=0;b<8;b++) r |= ((i*8+b)%duty<pulse?1:0)*(1<<(7-b))
		return blend(old,r)
	})
	const pitch=0|Math.max(0,Math.min(255, Math.log2((freq*duty)/4000)*48+64))
	return {pattern,pitch}
}
toneDuty.onchange =toneDuty.onkeyup =updateAudio
tonePulse.onchange=tonePulse.onkeyup=updateAudio
toneFreq.onchange =toneFreq.onkeyup =updateAudio

document.getElementById('audio-tone-preview').onclick = _ => {
	const tone=audioTone()
	playBytes(tone.pattern,tone.pitch)
}
document.getElementById('audio-generate').onclick = _ => {
	const tone=audioTone()
	writePattern(audioPatternEditor, tone.pattern)
	audioPitch.value=tone.pitch
	updateAudio()
	audioPreview()
}

/**
* Main
**/

function updateAudio() {
	audioPatternEditor.refresh()
	drawBytes(audioPatternCanvas, readPattern(audioPatternEditor))
	const tone=audioTone()
	drawBytes(audioToneCanvas, tone.pattern)
}
audioPatternEditor.on('change', updateAudio)
