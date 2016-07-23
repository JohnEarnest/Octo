"use strict";

////////////////////////////////////
//
//   SVG export:
//
////////////////////////////////////

function saveScreenshot() {
	var text = screenToSVG(emulator, 320, 160);
	var blob = new Blob([text], {type: "image/svg+xml"});
	saveAs(blob, "screenshot.svg");
}

function getSVGColor(id) {
	switch(id) {
		case 0: return emulator.backgroundColor;
		case 1: return emulator.fillColor;
		case 2: return emulator.fillColor2;
		case 3: return emulator.blendColor;
	}
	throw "invalid color: " + id;
}

function screenToSVG(emulator, width, height) {
	var max    = emulator.hires ? 128*64 : 64*32;
	var stride = emulator.hires ? 128    : 64;
	var xsize = width  / stride;
	var ysize = height / (stride/2);

	// do this in the most dumb, straightforward way possible:
	var r = "";
	r += '<svg xmlns="http://www.w3.org/2000/svg" version="1.0">\n'
	for(var z = 0; z < max; z++) {
		r += '<rect';
		r += ' x="' + (Math.floor(z%stride)*xsize) + '"';
		r += ' y="' + (Math.floor(z/stride)*ysize) + '"';
		r += ' width="' + (xsize) + '"';
		r += ' height="' + (ysize) + '"';
		r += ' fill="' + (getSVGColor(emulator.p[0][z] + (emulator.p[1][z] * 2))) + '"';
		r += ' stroke="none"';
		r += '/>\n';
	}
	r += '</svg>';
	return r;
}
