"use strict";

////////////////////////////////////
//
//   Emulator Execution
//
////////////////////////////////////

var scaleFactor = 5;
var renderTarget = "target";

function unpackOptions(emulator, options) {
	if (options["tickrate"       ]) { emulator.ticksPerFrame   = options["tickrate"       ]; }
	if (options["fillColor"      ]) { emulator.fillColor       = options["fillColor"      ]; }
	if (options["fillColor2"     ]) { emulator.fillColor2      = options["fillColor2"     ]; }
	if (options["blendColor"     ]) { emulator.blendColor      = options["blendColor"     ]; }
	if (options["backgroundColor"]) { emulator.backColor       = options["backgroundColor"]; }
	if (options["buzzColor"      ]) { emulator.buzzColor       = options["buzzColor"      ]; }
	if (options["quietColor"     ]) { emulator.quietColor      = options["quietColor"     ]; }
	if (options["shiftQuirks"    ]) { emulator.shiftQuirks     = options["shiftQuirks"    ]; }
	if (options["loadStoreQuirks"]) { emulator.loadStoreQuirks = options["loadStoreQuirks"]; }
	if (options["vfOrderQuirks"  ]) { emulator.vfOrderQuirks   = options["vfOrderQuirks"  ]; }
	if (options["enableXO"       ]) { emulator.enableXO        = options["enableXO"       ]; }
}

function setRenderTarget(scale, canvas) {
	scaleFactor = scale;
	renderTarget = canvas;
	var c = document.getElementById(canvas);
	c.width  = scaleFactor * 128;
	c.height = scaleFactor *  64;
	c.style.marginLeft = (scaleFactor * -64) + "px";
	c.style.marginTop  = (scaleFactor * -32) + "px";
}

function getColor(id) {
	switch(id) {
		case 0: return emulator.backColor;
		case 1: return emulator.fillColor;
		case 2: return emulator.fillColor2;
		case 3: return emulator.blendColor;
	}
	throw "invalid color: " + id;
}

function renderDisplay(emulator) {
	var c = document.getElementById(renderTarget);
	var g = c.getContext("2d");
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.fillStyle = emulator.backColor;
	g.fillRect(0, 0, c.width, c.height);
	var max    = emulator.hires ? 128*64      : 64*32;
	var stride = emulator.hires ? 128         : 64;
	var size   = emulator.hires ? scaleFactor : scaleFactor*2;

	for(var z = 0; z < max; z++) {
		g.fillStyle = getColor(emulator.p[0][z] + (emulator.p[1][z] * 2));
		g.fillRect(
			Math.floor(z%stride)*size,
			Math.floor(z/stride)*size,
			size, size
		);
	}
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

var AudioBuffer = function(buffer, duration) {
	if (!(this instanceof AudioBuffer))
		return new AudioBuffer(buffer, duration)

	this.pointer = 0
	this.buffer = buffer
	this.duration = duration
}

AudioBuffer.prototype.write = function(buffer, index, size) {
	size = Math.max(0, Math.min(size, this.duration))
	if (!size)
		return size

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
	this.duration -= duration
}

var FREQ = 4000;
var TIMER_FREQ = 60;
var SAMPLES = 16;
var BUFFER_SIZE = SAMPLES * 8

function audioSetup() {
	if (audio) { return; }

	if (typeof AudioContext !== 'undefined') {
		audio = new AudioContext();
	}
	else if (typeof webkitAudioContext !== 'undefined') {
		audio = new webkitAudioContext();
	}

	if (audio) {
		audioNode = audio.createScriptProcessor(4096, 1, 1);
		audioNode.onaudioprocess = function(audioProcessingEvent) {
			var outputBuffer = audioProcessingEvent.outputBuffer;
			var outputData = outputBuffer.getChannelData(0);
			var samples_n = outputBuffer.length;

			var index = 0;
			while(audioData.length && index < samples_n) {
				var size = samples_n - index;
				var written = audioData[0].write(outputData, index, size);
				index += written;
				if (written < size)
					audioData.shift();
			}

			while(index < samples_n)
				outputData[index++] = 0;
		}
		audioData = []
		audioNode.connect(audio.destination);
		return true
	}
	else
		return false;
}

function stopAudio() {
	if (!audio) { return; }
	audioNode.disconnect(audio.destination)
	audio.close()
	audio = null
	audioData = [];
}

var VOLUME = 0.25;

function playPattern(soundLength, buffer, remainingTicks) {
	if (!audio) { return; }

	var samples = Math.floor(BUFFER_SIZE * audio.sampleRate / FREQ);
	var audioBuffer = new Array(samples);
	if (remainingTicks && audioData.length > 0)
		audioData[audioData.length - 1].dequeue(Math.floor(remainingTicks * audio.sampleRate / TIMER_FREQ));

	for(var i = 0; i < samples; ++i) {
		var srcIndex = Math.floor(i * FREQ / audio.sampleRate);
		var cell = srcIndex >> 3;
		var bit = srcIndex & 7;
		audioBuffer[i] = (buffer[srcIndex >> 3] & (0x80 >> bit))? VOLUME: 0;
	}
	audioData.push(new AudioBuffer(audioBuffer, Math.floor(soundLength * audio.sampleRate / TIMER_FREQ)));
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};
