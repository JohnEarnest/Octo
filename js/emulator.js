"use strict";

var keymap = [
	// chip8    // keyboard
	/* 0 */ 88, // x
	/* 1 */ 49, // 1
	/* 2 */ 50, // 2
	/* 3 */ 51, // 3
	/* 4 */ 81, // q
	/* 5 */ 87, // w
	/* 6 */ 69, // e
	/* 7 */ 65, // a
	/* 8 */ 83, // s
	/* 9 */ 68, // d
	/* A */ 90, // z
	/* B */ 67, // c
	/* C */ 52, // 4
	/* D */ 82, // r
	/* E */ 70, // f
	/* F */ 86  // v
];

var keymapInverse = [];
for (var i = 0, len = keymap.length; i < len; i++) {
	keymapInverse[keymap[i]] = i;
}

var font = [
	0x60, 0x90, 0x90, 0x90, 0x60, // 0
	0x60, 0x20, 0x20, 0x20, 0x70, // 1
	0xE0, 0x10, 0x60, 0x80, 0xF0, // 2
	0xE0, 0x10, 0x60, 0x10, 0xE0, // 3
	0x20, 0x60, 0xA0, 0xF0, 0x20, // 4
	0xF0, 0x80, 0xE0, 0x10, 0xE0, // 5
	0x70, 0x80, 0xE0, 0x90, 0x60, // 6
	0xF0, 0x10, 0x20, 0x40, 0x40, // 7
	0x60, 0x90, 0x60, 0x90, 0x60, // 8
	0x60, 0x90, 0x70, 0x10, 0xE0, // 9
	0x60, 0x90, 0xF0, 0x90, 0x90, // A
	0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
	0x70, 0x80, 0x80, 0x80, 0x70, // C
	0xE0, 0x90, 0x90, 0x90, 0xE0, // D
	0xF0, 0x80, 0xE0, 0x80, 0xF0, // E
	0xF0, 0x80, 0xE0, 0x80, 0x80  // F
];

var bigfont = [
	0x7E, 0xC7, 0xC7, 0xCB, 0xCB, 0xD3, 0xD3, 0xE3, 0xE3, 0x7E, // 0
	0x08, 0x18, 0x38, 0x58, 0x18, 0x18, 0x18, 0x18, 0x18, 0x7E, // 1
	0x7E, 0xC3, 0x03, 0x03, 0x0E, 0x18, 0x30, 0x60, 0xC0, 0xFF, // 2
	0x7E, 0xC3, 0x03, 0x03, 0x3E, 0x03, 0x03, 0x03, 0xC3, 0x7E, // 3
	0x0C, 0x1C, 0x2C, 0x4C, 0xCC, 0xCC, 0xCC, 0xFF, 0x0C, 0x0C, // 4
	0xFF, 0xC0, 0xC0, 0xC0, 0xFE, 0x03, 0x03, 0x03, 0xC3, 0x7E, // 5
	0x7E, 0xC3, 0xC0, 0xC0, 0xFE, 0xC3, 0xC3, 0xC3, 0xC3, 0x7E, // 6
	0xFF, 0x03, 0x03, 0x06, 0x0C, 0x18, 0x30, 0x30, 0x30, 0x30,  // 7
	0x7E, 0xC3, 0xC3, 0xC3, 0x7E, 0xC3, 0xC3, 0xC3, 0xC3, 0x7E, // 8
	0x7E, 0xC3, 0xC3, 0xC3, 0x7F, 0x03, 0x03, 0x03, 0xC3, 0x7E, // 9
	0x7E, 0xC3, 0xC3, 0xC3, 0xFF, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, // A
	0xFE, 0xC3, 0xC3, 0xC3, 0xFE, 0xC3, 0xC3, 0xC3, 0xC3, 0xFE, // B
	0x7E, 0xC3, 0xC0, 0xC0, 0xC0, 0xC0, 0xC0, 0xC0, 0xC3, 0x7E, // C
	0xFE, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xFE, // D
	0xFF, 0xC0, 0xC0, 0xC0, 0xFC, 0xC0, 0xC0, 0xC0, 0xC0, 0xFF, // E
	0xFF, 0xC0, 0xC0, 0xC0, 0xFC, 0xC0, 0xC0, 0xC0, 0xC0, 0xC0  // F
];

function hexFormat(num) {
	var hex  = num.toString(16).toUpperCase();
	var pad0 = zeroPad(hex.length, 2);
	return "0x" + pad0 + hex;
}

////////////////////////////////////
//
//   The Chip8 Interpreter:
//
////////////////////////////////////

function Emulator() {

	// persistent configuration settings
	this.tickrate           = 20;
	this.fillColor          = "#FFCC00";
	this.fillColor2         = "#FF6600";
	this.blendColor         = "#662200";
	this.backgroundColor    = "#996600";
	this.buzzColor          = "#FFAA00";
	this.quietColor         = "#000000";
	this.shiftQuirks        = false;
	this.loadStoreQuirks    = false;
	this.vfOrderQuirks      = false;
	this.clipQuirks         = false;
	this.jumpQuirks         = false;
	this.enableXO           = false;
	this.screenRotation     = 0;
	this.maskFormatOverride = true;
	this.numericFormatStr   = "default";

	// interpreter state
	this.p  = [[],[],[],[]];  // pixels, 0: chip8, 1: xochip, 2: last, 3: pixel refresh flag.
	this.m  = [];       // memory (bytes)
	this.r  = [];       // return stack
	this.v  = [];       // registers
	this.g  = [2,0];    // partial pixel refresh list, 0 state, 1 num of lists, 2... pixel indexes
	this.pc = 0;        // program counter
	this.i  = 0;        // index register
	this.dt = 0;        // delay timer
	this.st = 0;        // sound timer
	this.rexp = 0;      // resolution exponent by power 2
	this.flags = [];    // semi-persistent hp48 flag vars
	this.pattern = [];  // audio pattern buffer
	this.plane = 1;     // graphics plane
	this.profile_data = {};
	this.opc = 0;
	this.interrupt
	this.mlsr = [-1,-1]

	// control/debug state
	this.keys = {};       // track keys which are pressed
	this.waiting = false; // are we waiting for a keypress?
	this.waitReg = -1;    // destination register of an awaited key
	this.halted = false;
	this.breakpoint = false;
	this.metadata = {};
	this.tickCounter = 0;

	// external interface stubs
	this.exitVector  = function() {}                                   // fired by 'exit'
	this.importFlags = function() { return [0, 0, 0, 0, 0, 0, 0, 0]; } // load persistent flags
	this.exportFlags = function(flags) {}                              // save persistent flags
	this.buzzTrigger = function(ticks, remainingTicks) {}                              // fired when buzzer played

	this.init = function(rom) {
		if (rom != null){  // Overwrite existing memory if need to be loaded
			this.metadata = rom;
			// initialise memory with a new array to ensure that it is of the right size and is initiliased to 0
			this.m = this.enableXO ? new Uint8Array(0x10000) : new Uint8Array(0x1000);
	
			// initialize memory
			for(var z = 0; z < font.length;    z++) { this.m[z] = font[z]; }
			for(var z = 0; z < bigfont.length; z++) { this.m[z + font.length] = bigfont[z]; }
			for(var z = 0; z < rom.rom.length; z++) { this.m[0x200+z] = rom.rom[z]; }
			for(var z = 0; z < 16;             z++) { this.v[z] = 0; }
		}
		// initialize display and sound
		for(var z = 0; z < 32*64;          z++) {
			this.p[0][z] = 0 ; this.p[1][z] = 0 ;
			this.p[2][z] =null; this.p[3][z] = 0 }
		for(var z = 0; z < 16;             z++) { this.pattern[z] = 0; }

		// initialize interpreter state
		this.r = [];
		this.g = [2,0];
		this.rexp = 0;
		this.pc = 0x200;
		this.i  = 0;
		this.dt = 0;
		this.st = 0;
		this.plane = 1;
		this.opc = 0;

		// initialize control/debug state
		this.keys = {};
		this.waiting = false;
		this.waitReg = -1;
		this.halted = false;
		this.breakpoint = false;
		this.stack_breakpoint = -1;
		this.tickCounter = 0;
		this.profile_data = {};
	}

	this.writeCarry = function(dest, value, flag) {
		this.v[dest] = (value & 0xFF);
		this.v[0xF] = flag ? 1 : 0;
		if (this.vfOrderQuirks) {
			this.v[dest] = (value & 0xFF);
		}
	}

	this.misc = function(x, rest) {
		// miscellaneous opcodes
		switch(rest) {
			case 0x00:
			// long memory reference
				this.i = ((this.m[this.pc] << 8) | (this.m[this.pc+1])) & 0xFFFF;
				this.pc += 2; break;
			case 0x01:
				this.plane = (x & 0x3);
				break;
			case 0x02:
				for(var z = 0; z < 16; z++) {
					this.pattern[z] = this.m[this.i+z];
				}
				break;
			case 0x07: this.v[x] = this.dt; if(this.dt>0){this.interrupt=true} break;
			case 0x0A: this.waiting = true; this.waitReg = x; break;
			case 0x15: this.dt = this.v[x]; break;
			case 0x18: this.buzzTrigger(this.v[x], this.st); this.st = this.v[x]; break;
			case 0x1E: this.i = (this.i + this.v[x])&0xFFFF; break;
			case 0x29: this.i = ((this.v[x] & 0xF) * 5); break;
			case 0x30: this.i = ((this.v[x] & 0xF) * 10 + font.length); break;
			case 0x33:
				this.m[this.i]   = Math.floor(this.v[x]/100)%10;
				this.m[this.i+1] = Math.floor(this.v[x]/10)%10;
				this.m[this.i+2] = this.v[x]%10;
				break;
			case 0x55:
				for(var z = 0; z <= x; z++) { this.m[this.i+z] = this.v[z]; }
				this.mlsr = [0,this.i,this.i+x];
				if (!this.loadStoreQuirks) { this.i = (this.i+x+1)&0xFFFF; }
				break;
			case 0x65:
				for(var z = 0; z <= x; z++) { this.v[z] = this.m[this.i+z]; }
				this.mlsr = [1,this.i,this.i+x];
				if (!this.loadStoreQuirks) { this.i = (this.i+x+1)&0xFFFF; }
				break;
			case 0x75:
				for(var z = 0; z <= x; z++) { this.flags[z] = this.v[z]; }
				this.exportFlags(this.flags);
				break;
			case 0x85:
				this.flags = this.importFlags();
				if (typeof this.flags == "undefined" || this.flags == null) {
					this.flags = [0, 0, 0, 0, 0, 0, 0, 0];
				}
				for(var z = 0; z <= x; z++) { this.v[z] = this.flags[z]; }
				break;
			default:
				haltBreakpoint("unknown misc opcode "+rest);
		}
	}

	this.sprite = function sprite(x,y,h){
		var rows = 64<<this.rexp;  var cols = 32<<this.rexp;
		var sres = rows*cols; var wide = h==0?16:h; var carry=0;
		var indx = this.i; if(this.g[0]==0){this.g[0]=1}
		for(var layr=0;layr<2;layr++){if(((this.plane&(layr+1))==0)){continue}
			var yplt=(y*rows)%(sres);for(var slic=0;slic<wide;slic++){
				for(var part=0;part<1+(h==0);part++){var vbyt=this.m[indx++];
					for(var plot=part*8;vbyt!=0;plot++){var pixl=vbyt&128;
						if(pixl!=0){var hng=((x+plot)%rows)+yplt;
							pixl=this.p[layr][hng];this.p[layr][hng]=1-pixl
							if(this.p[3][hng]==0){this.p[3][hng]=1;
								this.g[2+(this.g[1]++)]=hng}
						if(pixl!=0){carry=1}}
					vbyt=(vbyt<<1)&255}
				}
			yplt=(yplt+rows)%(sres)}
		}
	this.v[15]=carry}
	
	this.halt = function() {haltBreakpoint("halted");}
	
	this.opmath = [
		/*8xy0*/(()=>{this.v[(this.opc>>8)&0xF]  = this.v[(this.opc>>4)&0xF]}),
		/*8xy1*/(()=>{this.v[(this.opc>>8)&0xF] |= this.v[(this.opc>>4)&0xF]}),
		/*8xy2*/(()=>{this.v[(this.opc>>8)&0xF] &= this.v[(this.opc>>4)&0xF]}),
		/*8xy3*/(()=>{this.v[(this.opc>>8)&0xF] ^= this.v[(this.opc>>4)&0xF]}),
		/*8xy4*/(()=>{var t=this.v[(this.opc>>8)&0xF]+this.v[(this.opc>>4)&0xF];
			this.writeCarry((this.opc>>8)&0xF,t,(t>0xFF))}),
		/*8xy5*/(()=>{var t=this.v[(this.opc>>8)&0xF]-this.v[(this.opc>>4)&0xF];
			this.writeCarry((this.opc>>8)&0xF,t,(this.v[(this.opc>>8)&0xF]>=this.v[(this.opc>>4)&0xF]))}),
		/*8xy6*/(()=>{var a=8;if(this.shiftQuirks){a-=4}var t=this.v[(this.opc>>4)&0xF]>>1;
			this.writeCarry((this.opc>>a)&0xF,t,(this.v[(this.opc>>4)&0xF]&0x1))}),
		/*8xy7*/(()=>{var t=this.v[(this.opc>>4)&0xF]-this.v[(this.opc>>8)&0xF];
			this.writeCarry((this.opc>>8)&0xF,t,(this.v[(this.opc>>4)&0xF]>=this.v[(this.opc>>8)&0xF]))}),
			this.halt,this.halt,this.halt,this.halt,this.halt,this.halt,
		/*8xyE*/(()=>{var a=8;if(this.shiftQuirks){a-=4}var t=this.v[(this.opc>>4)&0xF]<<1;
			this.writeCarry((this.opc>>a)&0xF,t,((this.v[(this.opc>>4)&0xF]>>7)&0x1))}),this.halt];
			
	this.opmachine = [
		this.halt,this.halt,this.halt,this.halt,this.halt,this.halt,
		this.halt,this.halt,this.halt,this.halt,this.halt,this.halt,
		/*00Cn*/(()=>{var rowSize=64<<this.rexp;var n=this.opc&0xF;
			for(var layer=0;layer<2;layer++){if ((this.plane&(layer+1))==0){continue}
			this.g[0]=2;for(var z=this.p[layer].length;z>=0;z--){
			this.p[layer][z]=(z>=rowSize*n)?this.p[layer][z-(rowSize*n)]:0}}}),
		/*00Dn*/(()=>{var rowSize=64<<this.rexp;var n=this.opc&0xF;
			for(var layer=0;layer<2;layer++){if((this.plane&(layer+1))== 0){continue}
			this.g[0]=2;for(var z=0;z<this.p[layer].length;z++){
			this.p[layer][z]=(z<(this.p[layer].length-rowSize*n))?this.p[layer][z+(rowSize*n)]:0}}}),
		/*00En*/(()=>{var n=this.opc&0xF;
			/*00EE*/if(n==14){this.pc=this.r.pop()}
			/*00E0*/else if(n==0){for(var layer=0;layer<2;layer++){if((this.plane&(layer+1))==0){continue}
			this.g[0]=2;for(var z=0;z<this.p[layer].length;z++){this.p[layer][z]=0}}}else{this.halt}}),
		/*00Fn*/(()=>{if(this.opc&0xF<10){this.halt}[
			/*00FA*/(()=>{this.rexp=2;this.p=[[],[],[],[]];this.g[0]=2;for(var z=0;z<256*128;z++){
				this.p[0][z]=0;this.p[1][z]=0,this.p[2][z]=null,this.p[3][z]=0}}),
			/*00FB*/(()=>{var rowSize=64<<this.rexp;this.g[0]=2;for(var layer=0;layer<2;layer++){
				if((this.plane&(layer+1))==0){continue}for(var a=0;a<this.p[layer].length;a+=rowSize){
					for(var b=rowSize-1;b>=0;b--){this.p[layer][a+b]=(b>3)?this.p[layer][a+b-4]:0}}}}),
			/*00FC*/(()=>{var rowSize=64<<this.rexp;this.g[0]=2;for(var layer=0;layer<2;layer++){
				if((this.plane&(layer+1))==0){continue}for(var a=0;a<this.p[layer].length;a+=rowSize){
					for(var b=0;b<rowSize;b++){this.p[layer][a+b]=(b<rowSize-4)?this.p[layer][a+b+4]:0}}}}),
			/*00FD*/(()=>{this.halted=true;this.exitVector()}),
			/*00FE*/(()=>{this.rexp=0;this.p=[[],[],[],[]];this.g[0]=2;for(var z=0;z<32*64;z++){
				this.p[0][z]=0;this.p[1][z]=0,this.p[2][z]=null,this.p[3][z]=0}}),
			/*00FF*/(()=>{this.rexp=1;this.p=[[],[],[],[]];this.g[0]=2;for(var z=0;z<64*128;z++){
				this.p[0][z]=0;this.p[1][z]=0,this.p[2][z]=null,this.p[3][z]=0}})
			][(this.opc&0xF)-10]()})
		];
	
	this.exec = [
		/*0xnn*/(()=>{if(((this.opc>>8)&0xF)>0){haltBreakpoint("machine code unsupported!")}
			this.opmachine[(this.opc>>4)&0xF]()}),
		/*1nnn*/(()=>{if((this.pc-2)==(this.opc&0xFFF)){this.interrupt=true}this.pc=this.opc&0xFFF}),
		/*2nnn*/(()=>{if(this.r.length>=16){this.halt()};this.r.push(this.pc);this.pc=this.opc&0xFFF}),
		/*3xnn*/(()=>{if(this.v[(this.opc>>8)&0xF]==(this.opc&0xFF)){this.pc+=2}}),
		/*4xnn*/(()=>{if(this.v[(this.opc>>8)&0xF]!=(this.opc&0xFF)){this.pc+=2}}),
		/*5xyn*/(()=>{var n=this.opc&0xf;
			/*5xy0*/if(n==0){if(this.v[(this.opc>>8)&0xF]==this.v[(this.opc>>4)&0xF]){this.pc+=2}}
			/*5xy2*/else{var x=(this.opc>>8)&0xF; var y=(this.opc>>4)&0xF; var dist=Math.abs(x-y);
						if(n==2){if(x<y){for(var z=0;z<=dist;z++){this.m[this.i+z]=this.v[x+z]}}
							else{for(var z=0;z<=dist;z++){this.m[this.i+z]=this.v[x-z]}}}
			/*5xy3*/else{if(n==3){if(x<y){for(var z=0;z<=dist;z++){this.v[x+z]=this.m[this.i+z]}}
						else{for(var z=0;z<=dist;z++){this.v[x-z]=this.m[this.i+z]}}}
					else{haltBreakpoint("unknown opcode: "+hexFormat(this.opc))}}}}),
		/*6xnn*/(()=>{this.v[(this.opc>>8)&0xF]=this.opc&0xFF}),
		/*7xnn*/(()=>{this.v[(this.opc>>8)&0xF]=(this.v[(this.opc>>8)&0xF]+this.opc&0xFF)&0xFF}),
		/*8xyn*/(()=>{this.opmath[this.opc&0xF]()}),
		/*9xy0*/(()=>{if(this.v[(this.opc>>8)&0xF]!=this.v[(this.opc>>4)&0xF]){this.pc+=2}}),
		/*Annn*/(()=>{this.i=this.opc&0xFFF}),
		/*Bnnn*/(()=>{var nnn=this.opc&0xFFF;if(this.jumpQuirks){
			this.pc=nnn+this.v[(nnn>>8)&0xF]}else{this.pc=nnn+this.v[0]}}),
		/*Cxnn*/(()=>{this.v[(this.opc>>8)&0xF]=(Math.random()*256)&this.opc&0xFF}),
		/*Dxyn*/(()=>{this.sprite(this.v[(this.opc>>8)&0xF],this.v[(this.opc>>4)&0xF],this.opc&0xF)}),
		/*Exnn*/(()=>{if(this.opc&0xF00!=0){this.halt};var a=this.opc&0xFF;
			/*Ex9E*/if(a==0x9E){if(keymap[this.v[(this.opc>>8)&0xF]] in this.keys){this.pc+=2}}else
			/*ExA1*/if(a==0xA1){if(!(keymap[this.v[(this.opc>>8)&0xF]] in this.keys)){this.pc+=2}}else{this.halt}}),
		/*Fxnn*/(()=>{this.misc((this.opc>>8)&0xF,this.opc&0xFF)})];
	
	this.opcode = function() {
		// Increment profilining data
		this.profile_data[this.pc] = (this.profile_data[this.pc] || 0) + 1;
		
		// start opcode executing through table dispatches
		this.opc=(this.m[this.pc++]<<8)|this.m[this.pc++];
		//console.log(hexFormat(this.opc));
		this.mlsr = [0,-1,-1];this.exec[(this.opc>>12)&0xF]()
	}


	this.tick = function() {
		if (this.halted) { return; }
		this.tickCounter++;
		this.opcode()
		/*try {
			this.opcode();
		}
		catch(err) {
			console.log("halted: " + err);
			this.halted = true;
		}*/
	}
}