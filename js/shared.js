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
function audioSetup() {
	if (audio) { return; }
	if (typeof webkitAudioContext !== 'undefined') {
		audio = new webkitAudioContext();
		return true;
	}
	else if (typeof AudioContext !== 'undefined') {
		audio = new AudioContext();
		return true;
	}
	return false;
}

function stopAudio() {
	if (!audio) { return; }
	if (soundSource != null) {
		soundSource.stop(0);
		soundSource = null;
	}
}

var SAMPLES = 16;
var VOLUME = 0.25;
var soundSource = null;

function playPattern(soundLength, buffer) {
	if (!audio) { return; }
	if (soundLength < 1) { return; }
	stopAudio();

	// construct an audio buffer from the pattern buffer
	var sampleCount = Math.floor((audio.sampleRate / 120) * soundLength);
	var sampleMult  = Math.floor(audio.sampleRate / 30 / (8*SAMPLES));
	var soundBuffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
	var sound = soundBuffer.getChannelData(0);
	for(var z = 0; z < sampleCount;) {
		var bit   = Math.floor(z / sampleMult) % (8*SAMPLES); // index into pattern bits
		var cell  = Math.floor(bit / 8);                      // index into pattern bytes
		var shift = 7 - (bit % 8);                            // index into byte bits
		var value = ((buffer[cell] >> shift) & 1) == 1;       // on or off

		// unroll sampleMult copies of this sample:
		for(var repeats = 0; repeats < sampleMult; repeats++) {
			sound[z] = value ? VOLUME : 0;
			z++;
		}
	}

	// play the sound
	soundSource = audio.createBufferSource();
	soundSource.buffer = soundBuffer;
	soundSource.connect(audio.destination);
	soundSource.loop = false;
	soundSource.start(0);
}
