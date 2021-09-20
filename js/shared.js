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
var audioData;
var XOAudio;

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
		buffer[i] = this.buffer[this.pointer++];
		this.pointer %= bufferSize;
	}

	return size;
}

AudioBuffer.prototype.dequeue = function(duration) {
	this.duration -= duration;
}

var FREQ = 4000;
var PITCH_BIAS = 64;

function audioEnable() {
	// this will only work if called directly from a user-generated input handler:
	if (audio && audio.state == 'suspended') audio.resume()
}

function audioSetup(emulator) {
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
		audioNode = audio.createScriptProcessor(2048, 1, 1);
		audioNode.gain = audio.createGain();
		audioNode.gain.gain.value = VOLUME ;
		audioNode.onaudioprocess = function(audioProcessingEvent) {
			var outputBuffer = audioProcessingEvent.outputBuffer;
			var outputData = outputBuffer.getChannelData(0);
			var samples_n = outputBuffer.length;
			var index = 0;
			while(audioData.length && index < samples_n) {
				var size = samples_n - index;
				var written = audioData[0].write(outputData, index, size);
				index += written;
				if (written < size) {
					audioData.shift();
				}
			}

			while(index < samples_n) {
				outputData[index++] = 0;
			}
			//the last one can be long sound with high value of buzzer, so always keep it
			if (audioData.length > 1) {
				var audioDataSize = 0;
				var audioBufferSize = audioNode.bufferSize;
				audioData.forEach(function(buffer) { audioDataSize += buffer.duration; })
				while(audioDataSize > audioBufferSize && audioData.length > 1) {
					audioDataSize -= audioData.shift().duration;
				}
			}
		}
		audioData = [];
		audioNode.connect(audioNode.gain);
		audioNode.gain.connect(audio.destination);

		XOAudio = new AudioControl();
		emulator.buzzTimer  = _ => XOAudio.setTimer(_);
		emulator.buzzBuffer = _ => XOAudio.setBuffer(_);
		emulator.buzzPitch  = _ => XOAudio.setPitch(_);
	}
	return audio && audioNode
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

function playPattern(soundLength,buffer,pitch=PITCH_BIAS,
	sampleState={ pos: 0 }) {
	if (!audio) { return; }
	audioEnable()

	var freq = FREQ*2**((pitch-PITCH_BIAS)/48);
	var samples = Math.ceil(audio.sampleRate * soundLength);
	
	var bufflen = buffer.length * 8;
	var audioBuffer = new Float32Array(samples);

	var step = freq / audio.sampleRate;
	var pos = sampleState.pos;

	var quality = 8;
	var lowPassAlpha = getLowPassAlpha(audio.sampleRate * quality);
	
	for(var i = 0, il = samples; i < il; i++) {
		for (var j = 0; j < quality; ++j) {
			var cell = pos >> 3, shift = pos & 7 ^ 7;
			var value = getLowPassFilteredValue(lowPassAlpha, buffer[cell] >> shift & 1);
			pos = ( pos + step/quality ) % bufflen;
		}
		audioBuffer[i] = value;
	}

	audioData.push(new AudioBuffer(audioBuffer, samples));
	
	return { pos };
}

const silentPattern = new Array(64).fill(0);

function AudioControl(){
	this.state = { pos: 0 };
	this.reset = true;
	this.buffer = [];

	this.timer = 0;
	this.pitch = PITCH_BIAS;

	this.refresh = _ => {
		if (this.reset) this.state.pos = 0; this.reset = false;
		if (this.timer == 0) playPattern(_,silentPattern);
		else this.state = playPattern(_,this.buffer,this.pitch,this.state);
		if((this.timer -= this.timer>0) == 0) this.reset = true;
		while(audioData.length > 8) audioData.shift();
	}
	this.setTimer = (timer) => {
		if(timer == 0) this.reset = true;
		this.timer = timer;
	}
	this.setBuffer = buffer => this.buffer = buffer;
	this.setPitch = pitch => this.pitch = pitch;
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Should be a good way below the Nyquist limit of 22.05 kHz.
const cutoffFrequency = 18000;

// How many filters to put in sequence.
const lowPassFilterSteps = 4;

// Each filter is an exponential filter, which mimics a simple analog RC filter.
// We need multiple of them in series to get decent attenuation near the stop band.

const lowPassBuffer = new Array(lowPassFilterSteps + 1).fill(0);

function getLowPassAlpha(samplingFrequency) {
	const c = Math.cos(2 * Math.PI * cutoffFrequency / samplingFrequency);
	return c - 1 + Math.sqrt(c * c - 4 * c + 3);
}

function getLowPassFilteredValue(alpha, targetValue) {
	lowPassBuffer[0] = targetValue;
	for (let i = 1; i < lowPassBuffer.length; ++i) {
		lowPassBuffer[i] += (lowPassBuffer[i - 1] - lowPassBuffer[i]) * alpha;
	}
	return lowPassBuffer[lowPassBuffer.length - 1];
}
