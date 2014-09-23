"use strict";

////////////////////////////////////
//
//   Prettyprinting:
//
////////////////////////////////////

function hexFormat(num) {
	var hex = num.toString(16).toUpperCase();
	return "0x" + ((hex.length > 1) ? hex : "0" + hex);
}

function display(rom) {
	return "[" + (rom.map(hexFormat).join(", ")) + "]";
}

////////////////////////////////////
//
//   UI Glue:
//
////////////////////////////////////

function compile() {
	var input  = document.getElementById("input");
	var output = document.getElementById("output");
	var status = document.getElementById("status");

	var MAX_ROM = 3584;

	var c = new Compiler(input.value);
	try {
		output.value = "";
		output.style.display = "none";
		c.go();
		if (c.rom.length > MAX_ROM) {
			throw "Rom is too large- " + (c.rom.length-MAX_ROM) + " bytes over!";
		}
		output.value = display(c.rom);
		output.style.display = "inline";
		status.innerHTML = ((c.rom.length) + " bytes, " + (MAX_ROM-c.rom.length) + " free.");
		status.style.backgroundColor = "black";
		if (c.schip) { status.innerHTML += " (SuperChip instructions used)"; }
	}
	catch(error) {
		status.style.backgroundColor = "darkred";
		status.innerHTML = error;
		if (c.pos != null) {
			input.focus();
			input.selectionStart = c.pos[1]-1;
			input.selectionEnd   = c.pos[2]-1;
		}
		return null;
	}

	return {
		rom        :c.rom,
		breakpoints:c.breakpoints,
		aliases    :c.aliases,
		labels     :c.dict
	};
}

var intervalHandle;

function run() {
	runRom(compile());
}

function runRom(rom) {
	if (rom === null) { return; }
	init(rom);
	document.getElementById("emulator").style.display = "inline";
	document.getElementById("emulator").style.backgroundColor = QUIET_COLOR;
	window.addEventListener("keydown", keyDown, false);
	window.addEventListener("keyup"  , keyUp  , false);
	intervalHandle = setInterval(render, 1000/60);
}

function reset() {
	document.getElementById("emulator").style.display = "none";
	window.removeEventListener("keydown", keyDown, false);
	window.removeEventListener("keyup"  , keyUp  , false);
	window.clearInterval(intervalHandle);
	clearBreakpoint();
}

function save() {
	var bytes = new Uint8Array(compile());
	var binaryString = "";
	for(var z = 0; z < bytes.byteLength; z++) {
		binaryString += String.fromCharCode(bytes[z]);
	}
	var dataUri = "data:application/octet-stream;base64," + btoa(binaryString);
	window.open(dataUri);
}

function share() {
	// cribbed from increpare/Puzzlescript/js/toolbar.js
	var xhr = new XMLHttpRequest();
	xhr.open('POST', 'https://api.github.com/gists');
	xhr.onreadystatechange = function() {
		if(xhr.readyState !== 4)
			return;
		var result = JSON.parse(xhr.responseText);
		if (xhr.status === 403) {
			alert(result.message);
		} else if (xhr.status !== 200 && xhr.status !== 201) {
			alert("HTTP Error "+ xhr.status + ' - ' + xhr.statusText);
		} else {
			window.location.href = window.location.href.replace(/(index.html|\?gist=.*)*$/, 'index.html?gist=' + result.id);
		}
	}
	var prog = document.getElementById("input").value;
	var options = JSON.stringify({
		"tickrate"        : TICKS_PER_FRAME,
		"backgroundColor" : BACK_COLOR,
		"fillColor"       : FILL_COLOR,
		"buzzColor"       : BUZZ_COLOR,
		"quietColor"      : QUIET_COLOR,
		"shiftQuirks"     : SHIFT_QUIRKS,
		"loadStoreQuirks" : LOAD_STORE_QUIRKS
	});
	xhr.send(JSON.stringify({
		"description" : "Octo Chip8 Program",
		"public" : true,
		"files": {
			"readme.txt" : {
				"content": "Play this game by pasting the program into http://johnearnest.github.io/Octo/"
			},
			"prog.ch8" : {"content": prog},
			"options.json": {"content": options}
		}
	}));
}

function runGist() {
	var xhr = new XMLHttpRequest();
	var gistId = location.search.match(/gist=(\w+)/);
	if (!gistId)
		return;
	xhr.open('GET', 'https://api.github.com/gists/' + gistId[1]);
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status !== 201)) {
			var result = JSON.parse(xhr.responseText);
			document.getElementById("input").value = result.files["prog.ch8"].content;
			var options = JSON.parse(result.files["options.json"].content);
			var framerateNum = options["tickrate"]|0;
			var framerateEl = document.getElementById("framerate");
			framerateEl.value = framerateNum;
			if (framerateEl.value == "") {
				TICKS_PER_FRAME = framerateNum;
			} else {
				TICKS_PER_FRAME = framerateEl.value;
			}
			if (options["backgroundColor"]) { BACK_COLOR  = options["backgroundColor"]; }
			if (options["fillColor"      ]) { FILL_COLOR  = options["fillColor"      ]; }
			if (options["buzzColor"      ]) { BUZZ_COLOR  = options["buzzColor"      ]; }
			if (options["quietColor"     ]) { QUIET_COLOR = options["quietColor"     ]; }
			if (options["shiftQuirks"    ]) { SHIFT_QUIRKS = options["shiftQuirks"   ]; }
			if (options["loadStoreQuirks"]) { LOAD_STORE_QUIRKS = options["loadStoreQuirks"]; }
			run();
		}
	}
	xhr.send();
}

function framerate() {
	TICKS_PER_FRAME = document.getElementById("framerate").value;
}

function renderDisplay() {
	var c = document.getElementById("target");
	var g = c.getContext("2d");

	g.setTransform(1, 0, 0, 1, 0, 0);
	g.fillStyle = BACK_COLOR;
	g.fillRect(0, 0, 640, 320);
	g.fillStyle = FILL_COLOR;

	if (hires) {
		for(var z = 0; z < 64*128; z++) {
			if (p[z]) { g.fillRect(Math.floor(z%128)*5, Math.floor(z/128)*5, 5, 5); }
		}
	}
	else {
		for(var z = 0; z < 32*64; z++) {
			if (p[z]) { g.fillRect(Math.floor(z%64)*10, Math.floor(z/64)*10, 10, 10); }
		}
	}
}

function render() {
	for(var z = 0; (z < TICKS_PER_FRAME) && (!waiting); z++) {
		if (breakpoint != true) {
			tick();
			if (pc in metadata.breakpoints) {
				haltBreakpoint(metadata.breakpoints[pc]);
			}
		}
	}
	if (breakpoint != true) {
		if (dt > 0) { dt--; }
		if (st > 0) { st--; }
	}

	renderDisplay();

	if (halted) { return; }
	document.getElementById("emulator").style.backgroundColor = (st > 0) ? BUZZ_COLOR : QUIET_COLOR;
}

function keyDown(event) {
	if (!(event.keyCode in keys)) { keys[event.keyCode] = true; }
}

function keyUp(event) {
	if (event.keyCode in keys) { delete keys[event.keyCode]; }
	if (event.keyCode == 27) { reset(); }
	if (event.keyCode == 73) { // i
		if (breakpoint) {
			clearBreakpoint();
		}
		else {
			haltBreakpoint("user interrupt");
		}
	}
	if (event.keyCode == 79) { // o
		if (breakpoint) {
			tick();
			renderDisplay();
			haltBreakpoint("single stepping");
		}
	}
	if (waiting) {
		for(var z = 0; z < 16; z++) {
			if (KEYMAP[z] == event.keyCode) {
				waiting = false;
				v[waitReg] = z;
				return;
			}
		}
	}
}

document.getElementById("input").onkeydown = function(event) {
	if (event.keyCode == 9) {
		var text  = this.value;
		var start = this.selectionStart;
		var end   = this.selectionEnd;

		this.value = text.substring(0, start) + '\t' + text.substring(end);
		this.selectionStart = this.selectionEnd = start + 1;
		return false;
	}
};

////////////////////////////////////
//
//   Configuration options:
//
////////////////////////////////////

function editBack() {
	var val = document.getElementById("backEdit").value;
	document.getElementById("backSample").bgColor = val;
	BACK_COLOR = val;
	showPixels();
}

function editFore() {
	var val = document.getElementById("foreEdit").value;
	document.getElementById("foreSample").bgColor = val;
	FILL_COLOR = val;
	showPixels();
}

function editBuzz() {
	var val = document.getElementById("buzzEdit").value;
	document.getElementById("buzzSample").bgColor = val;
	BUZZ_COLOR = val;
}

function editSilent() {
	var val = document.getElementById("silentEdit").value;
	document.getElementById("silentSample").bgColor = val;
	QUIET_COLOR = val;
}

function toggleOptions() {
	var options = document.getElementById("options");
	if (options.style.display == "none") {
		options.style.display = "inline";
		document.getElementById("spriteEditor").style.display = "none";
		document.getElementById("backEdit").value   = BACK_COLOR;  editBack();
		document.getElementById("foreEdit").value   = FILL_COLOR;  editFore();
		document.getElementById("buzzEdit").value   = BUZZ_COLOR;  editBuzz();
		document.getElementById("silentEdit").value = QUIET_COLOR; editSilent();
		document.getElementById("shiftQuirks").checked = SHIFT_QUIRKS;
		document.getElementById("loadStoreQuirks").checked = LOAD_STORE_QUIRKS;
	}
	else {
		options.style.display = "none";
	}
}

function setShiftQuirks() {
	var check = document.getElementById("shiftQuirks");
	if (check.checked) { SHIFT_QUIRKS = true;  }
	else               { SHIFT_QUIRKS = false; }
}

function setLoadStoreQuirks() {
	var check = document.getElementById("loadStoreQuirks");
	if (check.checked) { LOAD_STORE_QUIRKS = true;  }
	else               { LOAD_STORE_QUIRKS = false; }
}

////////////////////////////////////
//
//   Sprite editor stuff:
//
////////////////////////////////////

function toggleSpriteEditor() {
	var editor = document.getElementById("spriteEditor");
	if (editor.style.display == "none") {
		editor.style.display = "inline";
		document.getElementById("options").style.display = "none";
		showPixels();
	}
	else {
		editor.style.display = "none";
	}
}

function setSpriteEditorSize() {
	var check = document.getElementById("spriteEditorSize");
	var canvas = document.getElementById("draw");
	if (check.checked) {
		largeSprite = true;
		canvas.width  = 25 * 16;
		canvas.height = 25 * 16;
		var newpixels = [];
		for(var z = 0; z < 32; z++) { newpixels[z] = 0; }
		for(var z = 0; z < pixel.length; z++) {
			newpixels[z * 2] = pixel[z];
		}
		pixel = newpixels;
	}
	else {
		largeSprite = false;
		canvas.width  = 25 * 8;
		canvas.height = 25 * 15;
		var newpixels = [];
		for(var z = 0; z < 15; z++) {
			newpixels[z] = pixel[z*2];
		}
		pixel = newpixels;
	}
	showPixels();
	showHex();
}

function showPixels() {
	var canvas = document.getElementById("draw");
	var render = canvas.getContext("2d");
	render.fillStyle = BACK_COLOR;
	render.fillRect(0, 0, canvas.width, canvas.height);
	render.fillStyle = FILL_COLOR;
	if (largeSprite) {
		for(var row = 0; row < 16; row++) {
			for(var col = 0; col < 16; col++) {
				if (pixel[row*2 + (col > 7 ? 1:0)] & (1 << (7-(col%8)))) {
					render.fillRect(col * 25, row * 25, 25, 25);
				}
			}
		}
	}
	else {
		for(var row = 0; row < 15; row++) {
			for(var col = 0; col < 8; col++) {
				if (pixel[row] & (1 << (7-col))) {
					render.fillRect(col * 25, row * 25, 25, 25);
				}
			}
		}
	}
}

function showHex() {
	var output = document.getElementById("spriteData");
	var hex = "";
	for(var z = 0; z < pixel.length; z++) {
		var digits = pixel[z].toString(16).toUpperCase();
		hex += "0x" + (digits.length == 1 ? "0"+digits : digits) + " ";
	}
	output.value = hex;
}

function editHex() {
	var output = document.getElementById("spriteData");
	var bytes = output.value.trim().split(new RegExp("\\s+"));
	var maxBytes = largeSprite ? 32 : 15;
	for(var z = 0; z < maxBytes; z++) {
		if (z < bytes.length) {
			var tok = bytes[z].trim();
			var num = (tok.slice(0, 2) == "0b") ? parseInt(tok.slice(2),2) : parseInt(tok);
			pixel[z] = isNaN(num) ? 0 : num;
		}
		else {
			pixel[z] = 0;
		}
	}
	showPixels();
}

function drag(event) {
	if (mode == 0) { return; }
	var rect = document.getElementById("draw").getBoundingClientRect();
	var mx   = Math.floor((event.clientX - rect.left)/25);
	var my   = Math.floor((event.clientY - rect.top )/25);
	var dest = largeSprite ? (my*2 + (mx > 7 ? 1:0)) : my;
	var src  = (128 >> (mx % 8));
	if (mode == 1) { pixel[dest] |=  src; } // draw
	else           { pixel[dest] &= ~src; } // erase
	showHex();
	showPixels();
}

function release(event)    { mode = 0; drag(event); }
function pressDraw(event)  { if (event.button == 2) {mode = 2;} else {mode = 1;} drag(event); }

var largeSprite = false;
var mode = 0;
var pixel = [];
for(var z = 0; z < 15; z++) { pixel[z] = 0; }

var spriteCanvas = document.getElementById("draw");
spriteCanvas.addEventListener("mousemove", drag, false);
spriteCanvas.addEventListener("mousedown", pressDraw, false);
spriteCanvas.addEventListener("mouseup"  , release, false);
spriteCanvas.oncontextmenu = function(event) { drag(event); return false; };
spriteCanvas.addEventListener("mouseout", release, false);

////////////////////////////////////
//
//   Virtual keypad stuff:
//
////////////////////////////////////

function buttonDn(key) {
	keyDown({ keyCode: KEYMAP[key]});
}
function buttonUp(key) {
	if (KEYMAP[key] in keys) {
		keyUp({ keyCode: KEYMAP[key]});
	}
}

for(var k = 0; k <= 0xF; k++) {
	var hex = k.toString(16).toUpperCase();
	var button = document.getElementById("0x" + hex);
	button.onmousedown = buttonDn.bind(undefined, k);
	button.onmouseup   = buttonUp.bind(undefined, k);
	button.onmouseout  = buttonUp.bind(undefined, k);

	button.ontouchstart = buttonDn.bind(undefined, k);
	button.ontouchenter = buttonDn.bind(undefined, k);
	button.ontouchleave = buttonUp.bind(undefined, k);
}

function toggleKeypad() {
	var keypad = document.getElementById("keypad");
	if (keypad.style.display == "none") {
		keypad.style.display = "inline";
	}
	else {
		keypad.style.display = "none";
	}
}

////////////////////////////////////
//
//   Debugger:
//
////////////////////////////////////

function getLabel(address) {
	var bestname = "hex-font";
	var besta = 0;
	for(var key in metadata.labels) {
		var v = metadata.labels[key];
		if ((v > besta) && (v <= address)) {
			bestname = key;
			besta = v;
		}
	}
	if (besta == address) { return " (" + bestname + ")"; }
	return " (" + bestname + " + " + (address - besta) + ")";
}

function formatAliases(id) {
	var names = [];
	for(var key in metadata.aliases) {
		if (metadata.aliases[key] == id) { names.push(key); }
	}
	if (names.length == 0) { return ""; }
	var ret = " (" + names[0];
	for(var x = 1; x < names.length; x++) {
		ret += ", " + names[x];
	}
	return ret + ")";
}

function haltBreakpoint(breakName) {
	var button = document.getElementById("continueButton");
	var regs   = document.getElementById("registerView");
	button.style.display = "inline";
	regs.style.display = "inline";

	var regdump =
		"tick count: " + tickCounter + "<br>" +
		"breakpoint: " + breakName + "<br>" +
		"pc := " + hexFormat(pc) + getLabel(pc) + "<br>" +
		"i := " + hexFormat(i) + getLabel(i) + "<br>";
	for(var k = 0; k <= 0xF; k++) {
		var hex = k.toString(16).toUpperCase();
		regdump += "v" + hex + " := " + hexFormat(v[k]) + formatAliases(k) +"<br>";
	}

	regdump += "<br>inferred stack trace:<br>";
	for(var x = 0; x < r.length; x++) {
		regdump += hexFormat(r[x]) + getLabel(r[x]) + "<br>";
	}

	regs.innerHTML = regdump;
	breakpoint = true;
}

function clearBreakpoint() {
	var button = document.getElementById("continueButton");
	var regs   = document.getElementById("registerView");
	button.style.display = "none";
	regs.style.display = "none";
	breakpoint = false;
}

////////////////////////////////////
//
//   Decompiler:
//
////////////////////////////////////

function decompileShowModal() {
	document.getElementById("decompileModal").style.display = "inline";
}

function decompileClose() {
	document.getElementById("decompileModal").style.display = "none";
}

function decompileFile() {
	document.getElementById("fileinput").click();
}

function decompileRequestLoad() {
	var file = document.getElementById("fileinput").files[0];
	var reader = new FileReader();

	function actuallyLoad() {
		var buff = reader.result;
		var bytes = new Uint8Array(buff);
		var disp = "";
		if (bytes.length > 0) {
			disp = hexFormat(bytes[0]);
		}
		for(var z = 1; z < bytes.length; z++) {
			disp += ", " + hexFormat(bytes[z]);
		}
		document.getElementById("decompileInput").value = "[" + disp + "]";
	}

	reader.onload = actuallyLoad;
	reader.readAsArrayBuffer(file);
}

function getDecompileData() {
	var inData = document.getElementById("decompileInput").value;
	inData = inData.replace("[", "");
	inData = inData.replace("]", "");
	inData = inData.split(",");
	var buffer = [];
	for(var z = 0; z < inData.length; z++) {
		buffer[z] = parse(inData[z]);
	}
	return buffer;
}

function decompileRun() {
	var buffer = getDecompileData();
	document.getElementById("decompileModal").style.display = "none";
	runRom({ rom:buffer, breakpoints:{}, aliases:{}, labels:{} });
}

var decompileProgramLength = 0;

function decompileStart() {
	document.getElementById("decompileModal").style.display = "none";
	document.getElementById("decompileWork").style.display = "inline";

	var buffer = getDecompileData();

	var quirks = {};
	quirks['shiftQuirks'    ] = SHIFT_QUIRKS;
	quirks['loadStoreQuirks'] = LOAD_STORE_QUIRKS;
	analyzeInit(buffer, quirks);
	decompileProgramLength = buffer.length;
	window.setTimeout(decompileProcess, 0);
}

function decompileProcess() {
	var finished = false;
	for(var z = 0; z < 100; z++) {
		finished |= analyzeWork();
		if (finished) { break; }
	}
	if (finished) {
		analyzeFinish();
		document.getElementById("input").value = "# decompiled program:\n" + formatProgram(decompileProgramLength);
		document.getElementById("decompileWork").style.display = "none";
	}
	else {
		window.setTimeout(decompileProcess, 0);
	}
}
