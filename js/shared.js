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
var audioData;
/*
var audioSource;

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
*/
var FREQ = 4000;
var TIMER_FREQ = 60;
var SAMPLES = 16;
var BUFFER_SIZE = SAMPLES * 8


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
		/*
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
		*/
		if(!audioData) audioData = []
		if(!audioNode) audioNode = []
		
		audioNode.push(audio.createGain());
		audioData.push(new Array(SAMPLES));
		
		var k = audioNode[audioNode.length-1];
		
		k.osc = audio.createOscillator();
		k.connect(audio.destination);
		k.osc.connect(k);
		
		k.osc.setPeriodicWave(audio.createPeriodicWave([0,0],[0,0]))
		k.osc.frequency.value = FREQ/128;
		k.gain.value = 0;
		k.osc.start()
		
		return audioNode.length-1;
	}
	if (audio && audioNode) { return audioNode.length-1; }
	return -1;
}

function stopAudio() {
	if (!audio) { return; }
	if (audioNode) {
		for (var k in audioNode) {
			k = audioNode.pop();
			k.osc.disconnect();
			k.disconnect();
			k.osc.stop();
		}
		audioNode = null;
	}
	audioData = [];
}

var VOLUME = 0.25;

function FFT(R,I){
//The original code is ported directly from:
//https://youtu.be/h7apO7q16V0
	var n = R.length;
	if (n == 1)  return [R,I]
	var Wr = Math.cos(2*Math.PI/n)
	var Wi = Math.sin(2*Math.PI/n)
	var PEr=new Float32Array(n/2)
	var PEi=new Float32Array(n/2)
	var POr=new Float32Array(n/2)
	var POi=new Float32Array(n/2)
	for(var z=0;z<n;z++){
		if(z&1){
			POr[z>>1]=R[z]
			POi[z>>1]=I[z]
		}else{
			PEr[z>>1]=R[z]
			PEi[z>>1]=I[z]
		}
	}
	
	var ye = FFT(PEr,PEi)
	var yo = FFT(POr,POi)
	var yer = ye[0], yei = ye[1];
	var yor = yo[0], yoi = yo[1];
	var yr = new Float32Array(n)
	var yi = new Float32Array(n)
	
	for(var z=0,m=n/2,p=1,q=0,r=0;z<m;z++){
		var a=yer[z],b=yei[z];
		var c=yor[z],d=yoi[z];
		yr[z  ]=a+p*c-q*d;
		yi[z  ]=b+p*d+q*c;
		yr[z+m]=a-p*c+q*d;
		yi[z+m]=b-p*d-q*c;
		r=p*Wr-q*Wi
		q=p*Wi+q*Wr
		p=r
	}
	return [yr,yi]
}
	
function audioEngine(){
	this.id = audioSetup()
	this.audioData = audioData[this.id]
	this.audioNode = audioNode[this.id]
	this.waveData = []
	
	this.setBuffer = function(buffer){
		if (!audio) { return; }
		var wave = []
		for(var a=0,b=0,bl=buffer.length;b<bl;b++){
			var c = this.audioData[b] = buffer[b];
			for(var d=7;d>=0;d--)
				for(var e=0;e<16;e++)
					wave[a++]=(c>>d)&1;
		}
		this.waveData = wave;
		
		var myFFT = FFT(wave,new Float32Array(wave.length))
		var half  = Math.ceil(wave.length/2);
		this.real = myFFT[0].slice(0,half);
		this.imag = myFFT[1].slice(0,half);
		
		this.audioNode.osc.setPeriodicWave(
			audio.createPeriodicWave(this.real,this.imag)
		);
	}
	this.setPitch = function(pitch){
		if (!audio) { return; }
		this.audioNode.osc.detune.value = 1200*(pitch-128)/48;
	}
	this.setGain  = function(gain){
		if (!audio) { return; }
		this.audioNode.gain.value = gain*VOLUME;
	}
}
/*
function playPattern(soundLength, buffer, remainingTicks) {
	if (!audio) { return; }
	audioEnable()

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
*/
function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
