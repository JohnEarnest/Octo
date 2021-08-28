"use strict";

////////////////////////////////////
//
//   Emulator Execution
//
////////////////////////////////////

//must be set > 0
var scaleFactor = 5;
//dom id for canvas element
var renderTarget = "target";

const optionFlags = [
	"tickrate",
	"fillColor",
	"fillColor2",
	"blendColor",
	"backgroundColor",
	"buzzColor",
	"quietColor",
	"shiftQuirks",
	"loadStoreQuirks",
	"vfOrderQuirks",
	"clipQuirks",
	"vBlankQuirks",
	"jumpQuirks",
	"screenRotation",
	"maxSize",
	"touchInputMode",
	"logicQuirks",
	"fontStyle",
]
function unpackOptions(emulator, options) {
	optionFlags.forEach(x => { if (x in options) emulator[x] = options[x] })
	if (options["enableXO"]) emulator.maxSize = 65024 // legacy option
}
function packOptions(emulator) {
	const r = {}
	optionFlags.forEach(x => r[x] = emulator[x])
	return r
}

function setRenderTarget(scale, canvas) {
	scaleFactor = scale;
	renderTarget = canvas;
	var c = document.getElementById(canvas);

	// Remove any existing previous delta frame so first frame is always drawn:
	c.last = undefined;

	var w  = scaleFactor * 128;
	var h  = scaleFactor *  64;

	if (emulator.screenRotation == 90 || emulator.screenRotation == 270) {
		c.width  = h;
		c.height = w;
	}
	else {
		c.width  = w;
		c.height = h;
	}
}

function setTransform(emulator, g) {
	g.setTransform(1, 0, 0, 1, 0, 0);
	var x = scaleFactor * 128;
	var y = scaleFactor *  64;
	switch(emulator.screenRotation) {
		case 90:
			g.rotate(0.5 * Math.PI);
			g.translate(0, -y);
			break;
		case 180:
			g.rotate(1.0 * Math.PI);
			g.translate(-x, -y);
			break;
		case 270:
			g.rotate(1.5 * Math.PI);
			g.translate(-x, 0);
			break;
		default:
			console.assert(emulator.screenRotation === 0, 'Screen rotation not set to 0, 90, 180, or 270. Treating as 0.')
	}
}


function arrayEqual(a, b) {
	var length = a.length;
	if (length !== b.length) { return false; }
	for (var i = 0; i < length; i++) {
		if (a[i] !== b[i]) { return false; }
	}
	return true;
}

function getColor(id) {
	switch(id) {
		case 0: return emulator.backgroundColor;
		case 1: return emulator.fillColor;
		case 2: return emulator.fillColor2;
		case 3: return emulator.blendColor;
	}
	throw "invalid color: " + id;
}

function renderDisplay(emulator) {
	var c = document.getElementById(renderTarget);

	// Canvas rendering can be expensive. Exit out early if nothing has changed.
	var colors = [emulator.backgroundColor, emulator.fillColor, emulator.fillColor2, emulator.blendColor];
	if (c.last !== undefined) {
		if (arrayEqual(c.last.p[0], emulator.p[0]) && arrayEqual(c.last.p[1], emulator.p[1])
				&& arrayEqual(c.last.colors, colors)) {
			return;
		}
		if (c.last.hires !== emulator.hires)
			c.last = undefined;  // full redraw when switching resolution
	}
	var g = c.getContext("2d");
	setTransform(emulator, g);
	var w      = emulator.hires ? 128         : 64;
	var h      = emulator.hires ? 64          : 32;
	var size   = emulator.hires ? scaleFactor : scaleFactor*2;
	var lastPixels = c.last !== undefined? c.last.p: [[], []]

	g.scale(size, size)
	var z = 0;
	for(var y = 0; y < h; ++y) {
		for(var x = 0; x < w; ++x, ++z) {
			var oldColorIdx = lastPixels[0][z] + (lastPixels[1][z] << 1);
			var colorIdx = emulator.p[0][z] + (emulator.p[1][z] << 1);
			if (oldColorIdx !== colorIdx) {
				g.fillStyle = getColor(colorIdx);
				g.fillRect(x, y, 1, 1);
			}
		}
	}
	g.scale(1, 1) //restore scale to 1,1 just in case

	c.last = {
		colors: colors,
		p: [emulator.p[0].slice(), emulator.p[1].slice()],
		hires: emulator.hires,
	};
}

////////////////////////////////////
//
//   Audio Playback
//
////////////////////////////////////

var audio;
var audioNode;
var audioSource;
var audioData = [];

var AudioBuffer = function(buffer, duration) {
	if (!(this instanceof AudioBuffer)) {
		return new AudioBuffer(buffer, duration);
	}

	this.pointer = 0;
	this.buffer = buffer;
	this.duration = duration;
}

AudioBuffer.prototype.write = function(buffer, index, size) {
	size = Math.max(0, Math.min(size, this.duration))
	if (!size) { return size; }

	this.duration -= size;
	var bufferSize = this.buffer.length;
	var end = index + size;

	for(var i = index; i < end; ++i) {
		buffer[i] += this.buffer[this.pointer++];
		this.pointer %= bufferSize;
	}

	return size;
}

AudioBuffer.prototype.dequeue = function(duration) {
	this.duration -= duration;
}

var FREQ = 4000;
var TIMER_FREQ = 62.5;
var SAMPLES = 128;
var BUFFER_SIZE = SAMPLES * 8;

var CHANNELS = 1;
var PITCH_BIAS = 64;
var DEFAULT_AUDIO_MODE = 0;


function audioEnable() {
	// this will only work if called directly from a user-generated input handler:
	if (audio && audio.state == 'suspended') audio.resume()
}

function audioSetup() {
	if (!audio) {
		if (typeof AudioContext !== 'undefined') {
			audio = new AudioContext();
		}
		else if (typeof webkitAudioContext !== 'undefined') {
			audio = new webkitAudioContext();
		}
	}
	audioEnable()
	if (audio && !audioNode) {
		audioNode = audio.createScriptProcessor(4096, 1, 1);
		audioNode.gain = audio.createGain();
		audioNode.gain.gain.value = VOLUME ;
		audioNode.onaudioprocess = function(audioProcessingEvent) {
			var outputBuffer = audioProcessingEvent.outputBuffer;
			var samples_n = outputBuffer.length;

			var outputData = outputBuffer.getChannelData(0);
			for(var ch=0;ch<CHANNELS;ch++){

				var index = 0;
				while(audioData[ch].length && index < samples_n) {
					var size = samples_n - index;
					var written = audioData[ch][0].write(outputData, index, size);
					index += written;
					if (written < size) {
						audioData[ch].shift();
					}
				}

				while(index < samples_n) {
					outputData[index++] += 0;
				}
				//the last one can be long sound with high value of buzzer, so always keep it
				if (audioData[ch].length > 1) {
					var audioDataSize = 0;
					var audioBufferSize = audioNode.bufferSize;
					audioData[ch].forEach(function(buffer) { audioDataSize += buffer.duration; })
					while(audioDataSize > audioBufferSize && audioData[ch].length > 1) {
						audioDataSize -= audioData[ch].shift().duration;
					}
				}
			}

		}
		audioData = [];
		for(var k=0; k<CHANNELS; k++)
			audioData[k] = []
		audioNode.connect(audioNode.gain);
		audioNode.gain.connect(audio.destination);
		return true;
	}
	if (audio && audioNode) { return true; }
	return false;
}

function stopAudio() {
	if (!audio) { return; }
	if (audioNode) {
		audioNode.disconnect();
		audioNode = null;
	}
	audioData = [];
}

var VOLUME = 0.25;

function playPattern(soundLength, buffer, remainingTicks,  channel=0,
	mode=DEFAULT_AUDIO_MODE,startPos=0,pitch=PITCH_BIAS,volume=1) {
	if (!audio) { return; }
	audioEnable()
	var freq = FREQ*2**((pitch-PITCH_BIAS)/48);
	var samplesPerTick = audio.sampleRate / TIMER_FREQ;

	/////////////////////////////////////////////////////////////////////
	//  Samples extraction from buffer's bytes

	//  Each sample will be always normalized to byte range, suppose:
	//  mode 0: 1-bit sample 0bA normalized to 0bAAAAAAAA
	//  mode 1: 2-bit sample 0bAB normalized to 0bABABABAB
	//  mode 2: 4-bit sample 0bABCD normalized to 0bABCDABCD
	//  mode 3: 8-bit sample 0bABCDEFGH simply skips this process

	var bits = 1 << mode;
	var samplesPerByte = 8 >> mode;
	var bitMasker = ( ( 1 << bits ) - 1 ) << 8;
	var sampleData = new Uint8Array(buffer.length*samplesPerByte);
	for(var cellAt=0,sampleAt=0;sampleAt<sampleData.length;cellAt=++cellAt%buffer.length){
		var cellValue = buffer[cellAt];
		for(var a=0;a<samplesPerByte;a++){
			var sampleValue = ( ( cellValue << bits ) & bitMasker ) >> 8; 
			for(var shifts=bits;shifts<8;shifts<<=1)
				sampleValue = sampleValue << shifts | sampleValue
			sampleData[sampleAt++] = sampleValue;
			cellValue = cellValue << bits & 255;
		}
	}
	if (remainingTicks && audioData[channel].length > 0)
		audioData[channel][audioData[channel].length - 1].dequeue(Math.floor(remainingTicks * samplesPerTick));
	
		
	var samples = Math.ceil(samplesPerTick * soundLength);

	var audioBuffer = new Float32Array(samples);
	var step = freq / audio.sampleRate, pos = startPos;
	for(var i = 0, il = samples; i < il; i++) {
		audioBuffer[i] = ( sampleData[Math.floor(pos)] / 255 - 0.5 ) * volume;
		pos = ( pos + step ) % sampleData.length;
	}
	audioData[channel].push(new AudioBuffer(audioBuffer, Math.floor(soundLength * samplesPerTick)));
	
	return pos;
}

function channelControl(channelTarget){
	this.channel = channelTarget;
	this.position = 0;
	this.reset = true;
	this.buffer = [];
	this.mode = 0;

	this.timer = 0;
	this.pitch = PITCH_BIAS;
	this.pitchRamp = 0;
	this.volume = 255;
	this.volumeRamp = 0;

	this.refresh =_=> {
		if (this.reset) { this.position = 0; this.reset = false; }
		if (this.timer>0)
			this.position = playPattern(1,this.buffer,0,this.channel,
				this.mode,this.position,this.pitch,this.volume/255);
		this.pitch=Math.min(Math.max(this.pitch+this.pitchRamp/4,0),255.75);
		this.volume=Math.min(Math.max(this.volume+this.volumeRamp/4,0),255.75);
		this.timer-=this.timer>0;
		if(this.timer == 0) this.reset = true;
	}
	this.setTimer = (timer) => {
		if(timer == 0) this.reset = true;
		this.timer = timer;
	}
	this.setBuffer=(buffer,mode) => {
		this.buffer = buffer;
		this.mode = mode;
	}
	this.setPitch = (pitch) => (this.pitch = pitch);
	this.setVolume = (volume) => this.volume = volume;
	this.setPitchRamp = (ramp) => this.pitchRamp = ramp-256*(ramp>=128);
	this.setVolumeRamp = (ramp) => this.volumeRamp = ramp-256*(ramp>=128);
}

function audioControl(){
	this.channels = new Array(CHANNELS);
	for(var k=0;k<this.channels.length;k++)
		this.channels[k] = new channelControl(k);

	this.refresh = _=>{
		for(var k=0;k<this.channels.length;k++)
			this.channels[k].refresh();
	}

	this.assignTimerSetter = stubs=>{
		for(var k=0;k<this.channels.length;k++)
			stubs[k] = this.channels[k].setTimer;
	}

	this.assignBufferSetter = stubs=>{
		for(var k=0;k<this.channels.length;k++)
			stubs[k] = this.channels[k].setBuffer;
	}

	this.assignPitchSetter = stubs=>{
		for(var k=0;k<this.channels.length;k++)
			stubs[k] = this.channels[k].setPitch;
	}

	this.assignVolumeSetter = stubs=>{
		for(var k=0;k<this.channels.length;k++)
			stubs[k] = this.channels[k].setVolume;
	}

	this.assignPitchRampSetter = stubs=>{
		for(var k=0;k<this.channels.length;k++)
			stubs[k] = this.channels[k].setPitchRamp;
	}

	this.assignVolumeRampSetter = stubs=>{
		for(var k=0;k<this.channels.length;k++)
			stubs[k] = this.channels[k].setVolumeRamp;
	}
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
