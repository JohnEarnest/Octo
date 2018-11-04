"use strict";

////////////////////////////////////
//
//   Emulator Execution
//
////////////////////////////////////

var scaleFactor = 12;
var renderTarget = "target";
var ov = 0;

function unpackOptions(emulator, options) {
	var flags = [
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
		"jumpQuirks",
		"enableXO",
		"screenRotation",
	]
	for (var x = 0; x < flags.length; x++) {
		var flag = flags[x];
		if (flag in options) { emulator[flag] = options[flag]; }
	}
}

function setRenderTarget(scale, canvas) {
	scaleFactor = scale;
	renderTarget = canvas;
	var c = document.getElementById(canvas);

	// Remove any existing previous delta frame so first frame is always drawn:
	c.last = undefined;

	var w  = scaleFactor * 64;
	var h  = scaleFactor *  32;
	var wm = (scaleFactor * -32) + "px";
	var hm = (scaleFactor * -16) + "px";

	if (emulator.screenRotation == 90 || emulator.screenRotation == 270) {
		c.width  = h;
		c.height = w;
		c.style.marginLeft = hm;
		c.style.marginTop  = wm;
	}
	else {
		c.width  = w;
		c.height = h;
		c.style.marginLeft = wm;
		c.style.marginTop  = hm;
	}
}

function getTransform(emulator, g) {
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
			/* nothing to do */
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

function renderDisplay(emulator) { ov=0
	if(emulator.g[0]!=0){
		var c = document.getElementById(renderTarget);

		// Canvas rendering can be expensive. Exit out early if nothing has changed.
		// NOTE: toggling emulator.hires changes emulator.p dimensions.
		var colors = [emulator.backColor,emulator.fillColor,emulator.fillColor2,emulator.blendColor];
		//if (c.last !== undefined
		//		&& arrayEqual(c.last.p[0], emulator.p[0]) && arrayEqual(c.last.p[1], emulator.p[1])
		//		&& arrayEqual(c.last.colors, colors)) {return;}
		//c.last = { colors: colors, p: [emulator.p[0].slice(), emulator.p[1].slice()]};

		var g = c.getContext("2d");
		getTransform(emulator, g);

		var stride = 64<<emulator.rexp;
		var size   = scaleFactor>>emulator.rexp;
		
		if(emulator.g[0]<2){
			var max   = emulator.g[1]+2;
			for(var i = 2,pl; i < max; i++){
				var z = emulator.g[i]; emulator.p[3][z]=0;
				pl = emulator.p[0][z] + (emulator.p[1][z] * 2);
				if(emulator.p[2][z]!=pl){  emulator.p[2][z]=pl;
					g.fillStyle = getColor(pl);
					g.fillRect(
						Math.floor(z%stride)*size,
						Math.floor(z/stride)*size,
						size, size
					); ov += 1;
				}
			}
		}else{
			var max   = (64<<emulator.rexp)*(32<<emulator.rexp);
			for(var z = 0,pl; z < max; z++) {  emulator.p[3][z] = 0;
				pl = emulator.p[0][z] + (emulator.p[1][z] * 2);
				if(emulator.p[2][z]!=pl){  emulator.p[2][z]=pl;
					g.fillStyle = getColor(pl);
					g.fillRect(
						Math.floor(z%stride)*size,
						Math.floor(z/stride)*size,
						size, size
					); ov += 1;
				}
			}
		}
		emulator.g = [0,0];
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
var TIMER_FREQ = 60;
var SAMPLES = 16;
var BUFFER_SIZE = SAMPLES * 8

function audioSetup() {
	if (!audio) {
		if (typeof AudioContext !== 'undefined') {
			audio = new AudioContext();
		}
		else if (typeof webkitAudioContext !== 'undefined') {
			audio = new webkitAudioContext();
		}
	}
	if (audio && !audioNode) {
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
		audioNode.connect(audio.destination);
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

function playPattern(soundLength, buffer, remainingTicks) {
	if (!audio) { return; }

	var samples = Math.floor(BUFFER_SIZE * audio.sampleRate / FREQ);
	var audioBuffer = new Array(samples);
	if (remainingTicks && audioData.length > 0) {
		audioData[audioData.length - 1].dequeue(Math.floor(remainingTicks * audio.sampleRate / TIMER_FREQ));
	}

	for(var i = 0; i < samples; ++i) {
		var srcIndex = Math.floor(i * FREQ / audio.sampleRate);
		var cell = srcIndex >> 3;
		var bit = srcIndex & 7;
		audioBuffer[i] = (buffer[srcIndex >> 3] & (0x80 >> bit)) ? VOLUME: 0;
	}
	audioData.push(new AudioBuffer(audioBuffer, Math.floor(soundLength * audio.sampleRate / TIMER_FREQ)));
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
