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
var audioNode=[];
var audioData=[];
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
			r=p*Wr-q*Wi;
			q=p*Wi+q*Wr;
			p=r;
		}
		return [yr,yi];
	}
	
function audioOscillator(k){
	k.updateBuffer = false;
	k.oscStopped = true;
	k.reset = false;
	
	k.bins = 4096;
	k.freq = FREQ/128;
	k.norm = k.bins/2**0.5;
	k.half = Math.ceil(k.bins/2);
	k.real = new Float32Array(k.bins);
	k.imag = new Float32Array(k.bins);
	k.wave = audio.createPeriodicWave(k.real,k.imag);
	
	k.stopOsc = function(time=0){
		k.dcf.offset.setValueAtTime(0,time);
		if ( !k.oscStopped ){
			k.oscStopped = true;
			k.osc.disconnect(time);
			k.osc.stop(time);
		}
	}
	
	k.runOsc = function(time=0){
		if( k.reset ){ k.reset = false; k.stopOsc(time);}
		if ( k.oscStopped  )
			k.osc = audio.createOscillator();
		var pitchVal = 1200*(k.pitch-64)/48;
		k.osc.detune.setValueAtTime(pitchVal,time);
		k.osc.frequency.setValueAtTime(k.freq,time);
		k.osc.setPeriodicWave(k.wave);
		k.dcf.offset.value = k.dcof;
		if ( k.oscStopped ){
			k.oscStopped = false;
			k.osc.connect(k);
			k.osc.start(time);
		}
	}
	
	k.setTimer = function(timer){
		if ( timer == 0 ) k.reset = true;
		k.timer = timer;
	}
	
	k.setBuffer = function(wave,length){
		var pads = k.bins/length;
		k.freq = FREQ/length;
		k.updateBuffer = true;
		for(var z=0,x=0;z<length;z++)
			for(var y=0;y<pads;y++)
				k.real[x++] = wave[z]/k.norm;
	}
	
	k.refresh = function(time){
		if(k.updateBuffer){
			k.updateBuffer = false;
			var myFFT = FFT(k.real,k.imag);
			var real = myFFT[0].slice(0,k.half)
			var imag = myFFT[1].slice(0,k.half)
			for(var i=0,j=2**0.5;i<k.half;i++){
				real[i]*=j; imag[i]*=j;
			}
			k.dcof = ((real[0]/2) ** 2 +
				(imag[0]/2) ** 2 ) ** 0.5 - 0.5;
			k.wave = audio.createPeriodicWave(
				real,imag,{disableNormalization:true}
			)
		}
		
		if ( k.timer == 0 ) k.stopOsc(time); else k.runOsc(time);
		
		k.setGain(k.volume/255,time); k.timer -= k.timer > 0;
		k.pitch = Math.min(Math.max(k.pitch+k.pitchRamp,0),255);
		k.volume = Math.min(Math.max(k.volume+k.volumeRamp,0),255);
		
		if ( k.timer == 0 ) k.reset = true;
	}
	
	k.stop = function(){
		k.disconnect();
		k.dcf.stop();
		k.stopOsc();
	}

	// this thing keeps the DC offset from
	// the original wave for the oscillator
	k.dcf = audio.createConstantSource();  
	k.dcf.offset.value = 0;
	k.dcf.connect(k);
	k.dcf.start();
	
	return k;
}

var FREQ = 4000;
var TIMER_FREQ = 60;


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
	if (audio) {
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
		var k = audio.createGain();
		
		k.setTimer = _=>k.timer=_;
		k.setPitch = _=>k.pitch=_;
		k.setVolume = _=>k.volume=_;
		k.setPitchRamp = _=>k.pitchRamp=_-256*(_>127);
		k.setVolumeRamp = _=>k.volumeRamp=_-256*(_>127);
		
		k.timer = 0;
		k.pitch = 64;
		k.volume = 255;
		k.pitchRamp = 0;
		k.volumeRamp = 0;
		
		k.gain.value = 0;
		k.refresh = _=>_;
		k.setBuffer = _=>_;
		k.stop = _=>k.disconnect();
		k.setGain = function (gain,time=0) {
			k.gain.setValueAtTime(gain*VOLUME, audio.currentTime+time);
		}
		
		audioData.push(new Uint32Array(128));
		audioNode.push(audioOscillator(k));
		
		k.connect(audio.destination);
		
		return audioNode.length-1;
	}
	if (audio && audioNode) { return audioNode.length-1; }
	return -1;
}

function stopAudio() {
	if (!audio) { return; }
	while(audioNode.length>0) {
		var k = audioNode.pop();
		audioData.pop();
		k.stop();
	}
}

var VOLUME = 0.5;
	
function audioEngine(){
	this.id = audioSetup();
	this.audioData = audioData[this.id];
	this.audioNode = audioNode[this.id];
	this.waveData = new Float32Array(1024);
	this.waveMode = 0;
	
	this.setBuffer = (buffer,mode)=>{
		var al=this.waveData.length;
		var bl=buffer.length;
		var bits = 1 << mode;
		var samplesPerByte = 8 >> mode
		var norm = ( 255 << bits ) & 0xFF00;
		norm >>= bits; norm &= 255;
		for(var a=0,b=0;a<al;b++){
			var c = buffer[b%bl];
			this.audioData[b] = c;
			for(var d=samplesPerByte;d>0;d--){
				var k = ( c <<= bits ) & 0xFF00;
				k >>= bits; k &= 255;
				for(var z=0;z<1;z++)
					this.waveData[a++] = k / norm;
			}
		}
		this.waveMode = mode;
		this.audioNode.setBuffer(
			this.waveData,buffer.length*samplesPerByte
		);
	}
	this.setTimer = this.audioNode.setTimer
	this.setPitch = this.audioNode.setPitch
	this.setVolume  = this.audioNode.setVolume
	this.setPitchRamp = this.audioNode.setPitchRamp
	this.setVolumeRamp = this.audioNode.setVolumeRamp
	this.setGain = this.audioNode.setGain
	this.refresh = this.audioNode.refresh
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
