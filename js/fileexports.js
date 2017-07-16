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
	saveAs(blob, "output.ch8");

}

////////////////////////////////////
//
//   .8o source code export:
//
////////////////////////////////////

function saveSourceFile() {
	var input  = document.getElementById("input");
	var blob = new Blob([input.value], {type: "text/plain;charset=utf-8"})
	saveAs(blob, "source.8o")
}
