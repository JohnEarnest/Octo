"use strict";

////////////////////////////////////
//
//   .ch8 file export:
//
////////////////////////////////////

function saveBinaryFile() {

	// Compile given Octo source and check for error
	var prog = compile();
	if (prog === null) {
		return;
	}

	// ROM data must be saved as an array of unsigned 8-bit integers. Calling
	// saveAs on a Blob of a non-TypedArray object will only write text data to
	// the file.
	var rawData = new Uint8Array(prog.rom);
	var blob = new Blob([rawData], {type: "application/octet-stream"});
	saveAs(blob, document.getElementById("binarysave").value);
}

////////////////////////////////////
//
//   .8o source code export:
//
////////////////////////////////////

function saveSourceFile() {
	var input  = document.getElementById("input");
	var payload = {
		program: document.getElementById("input").value,
		options: {
			"tickrate"        : emulator.tickrate,
			"fillColor"       : emulator.fillColor,
			"fillColor2"      : emulator.fillColor2,
			"blendColor"      : emulator.blendColor,
			"backgroundColor" : emulator.backgroundColor,
			"buzzColor"       : emulator.buzzColor,
			"quietColor"      : emulator.quietColor,
			"shiftQuirks"     : emulator.shiftQuirks,
			"loadStoreQuirks" : emulator.loadStoreQuirks,
			"vfOrderQuirks"   : emulator.vfOrderQuirks,
			"clipQuirks"      : emulator.clipQuirks,
			"jumpQuirks"      : emulator.jumpQuirks,
			"enableXO"        : emulator.enableXO,
			"screenRotation"  : emulator.screenRotation,
		},
	};
	var blob = new Blob([JSON.stringify(payload)],{type: "text/plain;charset=utf-8"})
	//new Blob([input.value], {type: "text/plain;charset=utf-8"})
	saveAs(blob, document.getElementById("sourcesave").value)
}