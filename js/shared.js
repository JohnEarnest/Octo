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
var audioBuffer;
var audioPointer;
var audioLength;

var FREQ = 4000;
var TIMER_FREQ = 60;
var SAMPLES = 16;
var BUFFER_SIZE = SAMPLES * 8

function getResampledSize(size) {
	return audio? Math.floor(size * audio.sampleRate / FREQ): 0;
}

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
			var samples_n = outputBuffer.length;
			var audioBufferSize = audioBuffer.length;
			var half = audioBufferSize >> 1
			for (var channel = 0; channel < outputBuffer.numberOfChannels; ++channel) {
				var outputData = outputBuffer.getChannelData(channel);

				for (var sample = 0; sample < samples_n; ++sample) {
					var ptr = audioPointer + sample
					if (ptr - half < audioLength) {
						if (ptr > audioBufferSize)
							ptr = half + (ptr % half);
						outputData[sample] = audioBuffer[ptr];
					} else
						outputData[sample] = 0;
				}
			}
			audioPointer += samples_n
		}
		audioPointer = 0
		audioLength = 0
		audioBuffer = Array(getResampledSize(BUFFER_SIZE) * 2); //two buffers
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
}

var VOLUME = 0.25;

function playPattern(soundLength, buffer) {
	if (!audio) { return; }

	var samples = getResampledSize(BUFFER_SIZE)
	for(var i = 0; i < samples; ++i) {
		var next = i + samples;
		audioBuffer[i] = audioBuffer[next];
		var srcIndex = Math.floor(i * FREQ / audio.sampleRate);
		var cell = srcIndex >> 3;
		var bit = srcIndex & 7;
		audioBuffer[next] = (buffer[srcIndex >> 3] & (0x80 >> bit))? VOLUME: 0;
	}
	audioLength = soundLength * audio.sampleRate / TIMER_FREQ;
	audioPointer %= samples; //save phase
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};
