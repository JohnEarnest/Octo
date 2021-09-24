/**
* Audio editor:
**/

const audioPianoKeys = document.getElementById('audio-piano-keys')
const audioPatternEditor = textBox(document.getElementById('audio-pattern-editor'), false, '')
const audioPatternCanvas = document.getElementById('audio-pattern-view')
const audioToneCanvas = document.getElementById('audio-tone-view')
const audioBlendMode = radioBar(document.getElementById('audio-blend-mode'), 'none', updateAudio)

const PATTERN_SIZE = 16
const PATTERN_SCALE = 2

function readPattern(source)         { return readBytes(source, PATTERN_SIZE) }
function writePattern(target, bytes) { return writeBytes(target, PATTERN_SIZE, bytes) }

var audioPatternData = range(PATTERN_SIZE).map(_ => 0)
writePattern(audioPatternEditor, audioPatternData)

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
function flipBytes(bytes, n){
	return bytes.map(x => x ^ 0xFF)
}

function reverseBits(bytes, n){
	return bytes.reverse().map(x =>
		x>>7& 1|x>>5& 2|x>>3& 4|x>>1&  8|
		x<<1&16|x<<3&32|x<<5&64|x<<7&128)
}

function playBytes(pattern, pitch){
	if (audioSetup(emulator)) {
		playPattern(0.5,pattern,pitch)
	}
	else {
		document.getElementById('audio-error').innerHTML = 'Your browser does not support HTML5 Audio!'
	}
}

/**
*  Piano keys panel
**/

function drawPiano(pressed=-1){
	const g = audioPianoKeys.getContext('2d');
	const octaves = 5, keywidth = 8;
	
	g.fillStyle = emulator.backgroundColor;
	g.fillRect(0,0,7*keywidth*octaves,32);

	// render white keys
	for (let key=0,keypos=0;key<octaves*7;key++,keypos+=keywidth){
		g.fillStyle = Math.ceil(12*(Math.floor(key)-3)/7)+5 == pressed ?
			emulator.blendColor : emulator.fillColor;
		g.fillRect(keypos,0,keywidth-1,31);
	}
	// render black keys
	for ( var m = 0; m < 2; m++ ){
		for (let key=0,keypos=-1;key<octaves*5;key++,keypos += keywidth + 1){
			if ( key%5 == 2 ) keypos += 6; if ( key%5 == 0 )  keypos += 5;
			g.fillStyle = !m ? emulator.backgroundColor :
				(Math.ceil(12*(key+1)/5)-2 != pressed)?
				emulator.fillColor2:emulator.blendColor;
			g.fillRect(keypos-m,-m,keywidth-2,20);
		}
	}
}

drawOnCanvas(audioPianoKeys, (x, y, draw) => {
	const keywidth = 8;
	// try to hover the piano keys
	var k = x / keywidth + 0.5;
	var press = !( y<20 && (k)%1<0.75 && 
		( Math.floor(k)%7!=2 || Math.floor(k)%7!=6 ) )?
		Math.ceil( 12 * ( Math.floor(k - 0.5 ) - 3 ) / 7 ) + 5:
		Math.ceil( 12 * ( Math.floor(k) - 3 ) / 7 ) + 4;
	audioPitch.value = press * 4 + 19;
	updatePiano();
}, (x, y, draw) => {
	switch(draw){
		case 1: audioPreview(); break;
		case 2: tonePreview(); break;
	}
})

/**
* Pattern panel
**/

const audioPitch = document.getElementById('audio-pitch')

drawOnCanvas(audioPatternCanvas, (x, y, draw) => {
	const index   = Math.min(PATTERN_SIZE*8, Math.max(0, Math.floor(x / PATTERN_SCALE)))
	setBit(audioPatternData, index, draw == 1)
	drawBytes(audioPatternCanvas, audioPatternData)
},(x, y, draw) => {
	writePattern(audioPatternEditor, audioPatternData)
	updateAudio()
})

document.getElementById('audio-reverse').onclick = _ => {
	writePattern(audioPatternEditor, audioPatternData = reverseBits(audioPatternData))
	updateAudio()
}
document.getElementById('audio-invert').onclick = _ => {
	writePattern(audioPatternEditor, audioPatternData = flipBytes(audioPatternData))
	updateAudio()
}
document.getElementById('audio-left').onclick = _ => {
	writePattern(audioPatternEditor, audioPatternData = shiftBytes(audioPatternData, 1))
	updateAudio()
}
document.getElementById('audio-right').onclick = _ => {
	writePattern(audioPatternEditor, audioPatternData = shiftBytes(audioPatternData, -1))
	updateAudio()
}

document.getElementById('audio-random').onclick = _ => {
	writePattern(audioPatternEditor,
		audioPatternData = audioPatternData.map(_ => (Math.random() * 256) & 0xFF))
		updateAudio(); audioPreview()
}

document.getElementById('audio-clear').onclick = _ => {
	writePattern(audioPatternEditor, audioPatternData = audioPatternData.map(_=>0));
	updateAudio(); 
}

document.getElementById('audio-play').onclick = audioPreview

/**
* Tone Generator panel
**/

const tonePulse  = document.getElementById('tone-pulse')
const toneDuty   = document.getElementById('tone-duty')
const toneInfo   = document.getElementById('tone-info')

function audioBlend(){
	return ({
		none: (x,y)=>y,
		and : (x,y)=>x&y,
		or  : (x,y)=>x|y,
		xor : (x,y)=>x^y,
	})[audioBlendMode.getValue()]
}

function audioTone(){
	const pulse=128/Math.max(0,Math.min(+tonePulse.value,64))
	const duty=Math.ceil(toneDuty.value*pulse/100)
	const blend=audioBlend()
	return audioPatternData.map((old,i) => {
		let r=0
		for(let b=0;b<8;b++) r |= ((i*8+b)%pulse<duty?1:0)*(1<<(7-b))
		return blend(old,r)
	})
}

toneDuty.onchange = toneDuty.onkeyup = updateAudio
tonePulse.onchange = tonePulse.onkeyup = updateAudio
audioPitch.onchange = audioPitch.onkeyup = updatePiano

document.getElementById('audio-tone-preview').onclick = tonePreview

document.getElementById('audio-generate').onclick = _ => {
	writePattern(audioPatternEditor, audioPatternData = audioTone())
	updateAudio(); audioPreview()
}

/**
* Main
**/

function audioPreview(){ playBytes(audioPatternData, +audioPitch.value) }

function tonePreview(){ playBytes(audioTone(), +audioPitch.value) }

function updateAudio() {
	audioPatternEditor.refresh()
	drawBytes(audioPatternCanvas, audioPatternData)
	drawBytes(audioToneCanvas, audioTone())
	updatePiano()
}

function updatePiano() {
	drawPiano(Math.floor((+audioPitch.value-19)/4),Math.floor((+audioPitch.value-19)/4));
	updateNoteInfo(+audioPitch.value,Math.max(0,Math.min(+tonePulse.value,64)));
}

function updateNoteInfo(pitch,multiply) {
	let freq = multiply*4000*2**((pitch-64)/48)/128;
	let note = Math.round(Math.log2(freq/440)*48);
	let dist = note-Math.round(Math.log2(freq/440/multiply)*48);
	let intv = (dist<0?"":"+")+Math.round(dist/4)+" ("+dist+")";
	let nfrq = 2**(Math.round(note/4)/12)*440;
	let ikey = (12+Math.round(note/4)%12)%12;
	let nkey = "AABCCDDEFFGG"[ikey]+"-$--$-$--$-$"[ikey]+
		Math.floor((Math.round(note/4)-3)/12+5);
	toneInfo.innerHTML = freq.toFixed(2)+" hz ≈ "+
		nfrq.toFixed(2)+" hz ["+nkey+"]; "+intv;
}

audioPatternEditor.on('change', _=>(
	audioPatternData=readPattern(audioPatternEditor),updateAudio()))