////////////////////////////////////
//
//   Decompiler:
//
//   A tracing decompiler and static
//   analyzer for Chip8 programs.
//
////////////////////////////////////

"use strict";

var LOAD_STORE_QUIRKS = false; // ignore i increment with loads
var SHIFT_QUIRKS      = false; // shift vx in place, ignore vy
var VF_ORDER_QUIRKS   = false; // arithmetic results write to vf after status flag

var regNames = [
	0x0,0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,0xB,0xC,0xD,0xE,0xF,
	'f0','f1','f2','f3','f4','f5','f6','f7','i','rets','plane'
];

// global state:
var program  = []; // chip8 memory
var reaching = {}; // map<address, map<register, set<int>>>
var fringe   = []; // addresses left to explore
var romsize  = 0;  // size of rom in bytes

// analysis:
var type        = {}; // map<address, {code | data | smc}>
var labels      = {}; // map<address, list<reference addrs>>
var subroutines = {}; // map<address, list<caller addrs>>
var natives     = {}; // map<address, list<native caller addrs>>
var lnames      = {}; // map<address, name>
var snames      = {}; // map<address, name>
var nnames      = {}; // map<address, name>

function formatInstruction(a, nn) {
	// convert a pair of bytes representing an instruction
	// into a string of the equivalent octo statement.
	var op  = (a <<  8) | nn;
	var o   = (a >>  4) & 0xF;
	var x   = (a      ) & 0xF;
	var y   = (nn >> 4) & 0xF;
	var n   = (nn     ) & 0xF;
	var nnn = op & 0xFFF;

	var vx = "v" + (x.toString(16).toUpperCase());
	var vy = "v" + (y.toString(16).toUpperCase());

	if (a  == 0x00 && y == 0xC) { return "scroll-down " + numericFormat(n); } // schip
	if (a  == 0x00 && y == 0xD) { return "scroll-up " + numericFormat(n); } // xo-chip
	if (op == 0x00E0)           { return "clear"; }
	if (op == 0x00EE)           { return "return"; }
	if (op == 0x00FB)           { return "scroll-right"; } // schip
	if (op == 0x00FC)           { return "scroll-left"; } // schip
	if (op == 0x00FD)           { return "exit"; } // schip
	if (op == 0x00FE)           { return "lores"; } // schip
	if (op == 0x00FF)           { return "hires"; } // schip
	if (o == 0x1)               { return "jump " + lnames[nnn]; }
	if (o == 0x2)               { return snames[nnn]; }
	if (o == 0x3)               { return "if " + vx + " != " + numericFormat(nn) + " then"; }
	if (o == 0x4)               { return "if " + vx + " == " + numericFormat(nn) + " then"; }
	if (o == 0x5 && n == 0x0)   { return "if " + vx + " != " + vy + " then"; }
	if (o == 0x5 && n == 0x2)   { return "save " + vx + " - " + vy; } // xo-chip
	if (o == 0x5 && n == 0x3)   { return "load " + vx + " - " + vy; } // xo-chip
	if (o == 0x6)               { return vx + " := " + numericFormat(nn); }
	if (o == 0x7)               { return vx + " += " + numericFormat(nn); }
	if (o == 0x8 && n == 0x0)   { return vx + " := " + vy; }
	if (o == 0x8 && n == 0x1)   { return vx + " |= " + vy; }
	if (o == 0x8 && n == 0x2)   { return vx + " &= " + vy; }
	if (o == 0x8 && n == 0x3)   { return vx + " ^= " + vy; }
	if (o == 0x8 && n == 0x4)   { return vx + " += " + vy; }
	if (o == 0x8 && n == 0x5)   { return vx + " -= " + vy; }
	if (o == 0x8 && n == 0x6)   { return vx + " >>= " + vy; }
	if (o == 0x8 && n == 0x7)   { return vx + " =- " + vy; }
	if (o == 0x8 && n == 0xE)   { return vx + " <<= " + vy; }
	if (o == 0x9 && n == 0x0)   { return "if " + vx + " == " + vy + " then"; }
	if (o == 0xA)               { return "i := " + lnames[nnn]; }
	if (o == 0xB)               { return "jump0 " + lnames[nnn]; }
	if (o == 0xC)               { return vx + " := random " + maskFormat(nn, 2); }
	if (o == 0xD)               { return "sprite " + vx + " " + vy + " " + numericFormat(n); }
	if (o == 0xE && nn == 0x9E) { return "if " + vx + " -key then"; }
	if (o == 0xE && nn == 0xA1) { return "if " + vx + " key then"; }
	if (op == 0xF000)           { return "i := long "; }
	if (op == 0xF001)           { return "plane 0"; }
	if (op == 0xF101)           { return "plane 1"; }
	if (op == 0xF201)           { return "plane 2"; }
	if (op == 0xF301)           { return "plane 3"; }
	if (op == 0xF002)           { return "audio"; }
	if (o == 0xF && nn == 0x07) { return vx + " := delay"; }
	if (o == 0xF && nn == 0x0A) { return vx + " := key"; }
	if (o == 0xF && nn == 0x15) { return "delay := " + vx; }
	if (o == 0xF && nn == 0x18) { return "buzzer := " + vx; }
	if (o == 0xF && nn == 0x1E) { return "i += " + vx; }
	if (o == 0xF && nn == 0x29) { return "i := hex " + vx; }
	if (o == 0xF && nn == 0x30) { return "i := bighex " + vx; } // schip
	if (o == 0xF && nn == 0x33) { return "bcd " + vx; }
	if (o == 0xF && nn == 0x55) { return "save " + vx; }
	if (o == 0xF && nn == 0x65) { return "load " + vx; }
	if (o == 0xF && nn == 0x75) { return "saveflags " + vx; } // schip
	if (o == 0xF && nn == 0x85) { return "loadflags " + vx; } // schip

	if (o == 0x0) {
		return "native " + ((nnn in nnames) ? nnames[nnn] : hexFormat(nnn));
	}
	return hexFormat(a) + " " + hexFormat(nn) + " # bad opcode?";
}

function formatNative(addr, prefix) {
	var r = "";
	var start = addr;

	while(true) {
		if (addr in natives) {
			r += ": " + nnames[addr] + "\n";
		}
		if (typeof program[addr] == "undefined") { break; }
		if (typeof    type[addr] != "undefined") { break; }
		r += prefix;

		var op = program[addr];
		var o  = (op >> 4) & 0xF;
		var x  = op & 0xF;
		var a  = program[addr+1] | 0;
		var b  = program[addr+2] | 0;

		var end = hexFormat(addr) + " : ";
		var h1 = hexFormat(op) + "           # " + end;
		var h2 = hexFormat(op) + " " + hexFormat(a) + "      # " + end;
		var h3 = hexFormat(op) + " " + hexFormat(a) + " " + hexFormat(b) + " # " + end;
		var hr = x.toString(16).toUpperCase();
		var ha = hexFormat(a);
		var hb = hexFormat((a << 8) | b);
		var or = x - 1;
		var ir = x - 7;

		if (o == 0x0 && x == 0)     { addr += 1; r += h1 + "IDL"       ; } // idle
		if (o == 0x0 && x != 0)     { addr += 1; r += h1 + "LDN  " + hr; } // load via r
		if (o == 0x1)               { addr += 1; r += h1 + "INC  " + hr; } // increment r
		if (o == 0x2)               { addr += 1; r += h1 + "DEC  " + hr; } // decrement r
		if (op == 0x30)             { addr += 2; r += h2 + "BR   " + ha; } // branch always
		if (op == 0x31)             { addr += 2; r += h2 + "BQ   " + ha; } // branch if q
		if (op == 0x32)             { addr += 2; r += h2 + "BZ   " + ha; } // branch if zero
		if (op == 0x33)             { addr += 2; r += h2 + "BDF  " + ha; } // branch if df
		if (op == 0x34)             { addr += 2; r += h2 + "B1   " + ha; } // branch if flag 1
		if (op == 0x35)             { addr += 2; r += h2 + "B2   " + ha; } // branch if flag 2
		if (op == 0x36)             { addr += 2; r += h2 + "B3   " + ha; } // branch if flag 3
		if (op == 0x37)             { addr += 2; r += h2 + "B4   " + ha; } // branch if flag 4
		if (op == 0x38)             { addr += 1; r += h1 + "SKP"       ; } // skip 1 byte
		if (op == 0x39)             { addr += 2; r += h2 + "BNQ  " + ha; } // branch if not q
		if (op == 0x3A)             { addr += 2; r += h2 + "BNZ  " + ha; } // branch if not zero
		if (op == 0x3B)             { addr += 2; r += h2 + "BNF  " + ha; } // branch if not df
		if (op == 0x3C)             { addr += 2; r += h2 + "BN1  " + ha; } // branch if not flag 1
		if (op == 0x3D)             { addr += 2; r += h2 + "BN2  " + ha; } // branch if not flag 2
		if (op == 0x3E)             { addr += 2; r += h2 + "BN3  " + ha; } // branch if not flag 3
		if (op == 0x3F)             { addr += 2; r += h2 + "BN4  " + ha; } // branch if not flag 4
		if (o == 0x4)               { addr += 1; r += h1 + "LDA  " + hr; } // load and advance
		if (o == 0x5)               { addr += 1; r += h1 + "STR  " + hr; } // store through r
		if (op == 0x60)             { addr += 1; r += h1 + "IRX"       ; } // increment r(x)
		if (o == 0x6 && x>0 && x<8) { addr += 1; r += h1 + "OUT  " + or; } // output r
		if (o == 0x6 && x>7)        { addr += 1; r += h1 + "INP  " + ir; } // input r
		if (op == 0x70)             { addr += 1; r += h1 + "RET"       ; } // return
		if (op == 0x71)             { addr += 1; r += h1 + "DIS"       ; } // disable interrupts
		if (op == 0x72)             { addr += 1; r += h1 + "LDXA"      ; } // load via r(x)++
		if (op == 0x73)             { addr += 1; r += h1 + "STXD"      ; } // store via r(x)--
		if (op == 0x74)             { addr += 1; r += h1 + "ADC"       ; } // add with carry
		if (op == 0x75)             { addr += 1; r += h1 + "SDB"       ; } // sub from m with borrow
		if (op == 0x76)             { addr += 1; r += h1 + "SHRC"      ; } // shift right with carry
		if (op == 0x77)             { addr += 1; r += h1 + "SMB"       ; } // sub m with borrow
		if (op == 0x78)             { addr += 1; r += h1 + "SAV"       ; } // save t
		if (op == 0x79)             { addr += 1; r += h1 + "MARK"      ; } // save x/p in t
		if (op == 0x7A)             { addr += 1; r += h1 + "REQ"       ; } // reset q
		if (op == 0x7B)             { addr += 1; r += h1 + "SEQ"       ; } // set q
		if (op == 0x7C)             { addr += 2; r += h2 + "ADCI " + ha; } // add with carry imm
		if (op == 0x7D)             { addr += 2; r += h2 + "SDBI " + ha; } // sub with borrow imm
		if (op == 0x7E)             { addr += 1; r += h1 + "SHLC"      ; } // shift left with carry
		if (op == 0x7F)             { addr += 2; r += h2 + "SMBI " + ha; } // sub m with borrow imm
		if (o == 0x8)               { addr += 1; r += h1 + "GLO  " + hr; } // get low byte of r
		if (o == 0x9)               { addr += 1; r += h1 + "GHI  " + hr; } // get high byte of r
		if (o == 0xA)               { addr += 1; r += h1 + "PLO  " + hr; } // put in low byte of r
		if (o == 0xB)               { addr += 1; r += h1 + "PHI  " + hr; } // put in high byte of r
		if (op == 0xC0)             { addr += 3; r += h3 + "LBR  " + hb; } // lbranch always
		if (op == 0xC1)             { addr += 3; r += h3 + "LBQ  " + hb; } // lbranch if q
		if (op == 0xC2)             { addr += 3; r += h3 + "LBZ  " + hb; } // lbranch if zero
		if (op == 0xC3)             { addr += 3; r += h3 + "LBDF " + hb; } // lbranch if df
		if (op == 0xC4)             { addr += 1; r += h1 + "NOP"       ; } // noop
		if (op == 0xC5)             { addr += 1; r += h1 + "LSNQ"      ; } // lskip if not q
		if (op == 0xC6)             { addr += 1; r += h1 + "LSNZ"      ; } // lskip if not zero
		if (op == 0xC7)             { addr += 1; r += h1 + "LSNF"      ; } // lskip if not df
		if (op == 0xC8)             { addr += 1; r += h1 + "LSKP"      ; } // lskip always
		if (op == 0xC9)             { addr += 3; r += h3 + "LBNQ " + hb; } // lbranch if not q
		if (op == 0xCA)             { addr += 3; r += h3 + "LBNZ " + hb; } // lbranch if not zero
		if (op == 0xCB)             { addr += 3; r += h3 + "LBNF " + hb; } // lbranch if not df
		if (op == 0xCC)             { addr += 1; r += h1 + "LSIE"      ; } // lskip if interrupts
		if (op == 0xCD)             { addr += 1; r += h1 + "LSQ"       ; } // lskip if q
		if (op == 0xCE)             { addr += 1; r += h1 + "LSZ"       ; } // lskip if zero
		if (op == 0xCF)             { addr += 1; r += h1 + "LSDF"      ; } // lskip if df
		if (o == 0xD)               { addr += 1; r += h1 + "SEP  " + hr; } // set p
		if (o == 0xE)               { addr += 1; r += h1 + "SEX  " + hr; } // set x
		if (op == 0xF0)             { addr += 1; r += h1 + "LDX"       ; } // load via r(x)
		if (op == 0xF1)             { addr += 1; r += h1 + "OR"        ; } // or
		if (op == 0xF2)             { addr += 1; r += h1 + "AND"       ; } // and
		if (op == 0xF3)             { addr += 1; r += h1 + "XOR"       ; } // xor
		if (op == 0xF4)             { addr += 1; r += h1 + "ADD"       ; } // add
		if (op == 0xF5)             { addr += 1; r += h1 + "SD"        ; } // sub from m
		if (op == 0xF6)             { addr += 1; r += h1 + "SHR"       ; } // shift right
		if (op == 0xF7)             { addr += 1; r += h1 + "SM"        ; } // sub m
		if (op == 0xF8)             { addr += 2; r += h2 + "LDI  " + ha; } // load imm
		if (op == 0xF9)             { addr += 2; r += h2 + "ORI  " + ha; } // or imm
		if (op == 0xFA)             { addr += 2; r += h2 + "ANI  " + ha; } // and imm
		if (op == 0xFB)             { addr += 2; r += h2 + "XRI  " + ha; } // xor imm
		if (op == 0xFC)             { addr += 2; r += h2 + "ADI  " + ha; } // add imm
		if (op == 0xFD)             { addr += 2; r += h2 + "SDI  " + ha; } // sub from m imm
		if (op == 0xFE)             { addr += 1; r += h1 + "SHL"       ; } // shift left
		if (op == 0xFF)             { addr += 2; r += h2 + "SMI  " + ha; } // sub m imm

		r += "\n";

		if (o == 0xD) { break; } // SEP is a context switch, effectively a return
	}
	return [(addr - start), r + "\n"];
}

function copyReachingSet(source) {
	var ret = {};
	for(var z = 0; z < regNames.length; z++) {
		var register = regNames[z];
		ret[register] = {};
		var values = Object.keys(source[register]);
		for(var vindex = 0; vindex < values.length; vindex++) {
			ret[register][values[vindex]] = true;
		}
	}
	return ret;
}

function apply(address) {
	// apply this instruction to the reaching set
	// producing a successor reaching set.

	// flag this address as executable
	function setType(address, desired) {
		var t = type[address];
		if (desired == "code" && t == "smc" ) { return; }
		if (desired == "data" && t == "smc" ) { return; }
		if (desired == "code" && t == "data") { desired = "smc"; }
		if (desired == "data" && t == "code") { desired = "smc"; }
		type[address] = desired;
	}
	setType(address,     "code");
	setType(address + 1, "code");

	// start with a deep copy of the source reaching set:
	var ret = copyReachingSet(reaching[address]);

	// decode the instruction:
	var a   = program[address];
	var nn  = program[address+1];
	var op  = (a <<  8) | nn;
	var o   = (a >>  4) & 0xF;
	var x   = (a      ) & 0xF;
	var y   = (nn >> 4) & 0xF;
	var n   = (nn     ) & 0xF;
	var nnn = op & 0xFFF;

	// log label and subroutine references:
	if (op == 0xF000) {
		var nnnn = ((program[address+2] << 8) | (program[address+3])) & 0xFFFF;
		ret['i'] = isingle(nnnn);
		setType(address + 2, "code");
		setType(address + 3, "code");
		if (typeof labels[nnnn] == "undefined") { labels[nnnn] = []; }
		if (labels[nnnn].indexOf(address) == -1) { labels[nnnn].push(address); }
	}
	if (o == 0x1 || o == 0xA || o == 0xB) {
		if (typeof labels[nnn] == "undefined") { labels[nnn] = []; }
		if (labels[nnn].indexOf(address) == -1) { labels[nnn].push(address); }
	}
	if (o == 0x2) {
		if (typeof subroutines[nnn] == "undefined") { subroutines[nnn] = []; }
		if (subroutines[nnn].indexOf(address) == -1) { subroutines[nnn].push(address); }
	}
	if (o == 0x0 && x != 0x0) {
		if (typeof natives[nnn] == "undefined") { natives[nnn] = []; }
		if (natives[nnn].indexOf(address) == -1) { natives[nnn].push(address); }
	}

	// helper routines:
	function iota(max) {
		var i = {};
		for(var z = 0; z <= max; z++) { i[z] = true; }
		return i;
	}
	function maskedrand() {
		var i = {};
		for(var z = 0; z <= 0xFF; z++) { i[z & nn] = true; }
		return i;
	}
	function single(value) {
		var s = {};
		s[value] = true;
		return s;
	}
	function unary(unop) {
		var r = {};
		for(var a in ret[x]) {
			r[unop(parseInt(a)) & 0xFF] = true
		}
		return r;
	}
	function binary(binop) {
		var r = {};
		if (x == y) {
			for(var a in ret[x]) {
				var tmp = parseInt(a);
				r[(binop(tmp, tmp) & 0xFF)] = true;
			}
		}
		else {
			for(var a in ret[x]) {
				for(var b in ret[y]) {
					r[(binop(parseInt(a), parseInt(b)) & 0xFF)] = true;
				}
			}
		}
		ret[x] = r;
	}
	function capi(i) {
		return Math.min(i, romsize+1+0x200);
	}
	function ioffset(delta) {
		if (LOAD_STORE_QUIRKS) { return; }
		var s = {};
		for(var a in ret['i']) {
			s[capi(parseInt(a) + delta)] = true;
		}
		ret['i'] = s;
	}
	function isingle(value) {
		value = capi(value);
		var s = {}; s[value] = true;
		return s;
	}
	function ioffsets() {
		var s = {};
		for(var a in ret['i']) {
			for(var b in ret[x]) {
				s[capi(parseInt(a) + parseInt(b))] = true;
			}
		}
		return s;
	}
	function bincarry(binop) {
		var r = {};
		var c = {};
		if (x == y) {
			for(var a in ret[x]) {
				var tmp = parseInt(a);
				var v = binop(tmp, tmp);
				r[(v[0] & 0xFF) ] = true;
				c[(v[1] ? 1 : 0)] = true;
			}
		}
		else {
			for(var a in ret[x]) {
				for(var b in ret[y]) {
					var v = binop(parseInt(a), parseInt(b));
					r[(v[0] & 0xFF) ] = true;
					c[(v[1] ? 1 : 0)] = true;
				}
			}
		}
		if (VF_ORDER_QUIRKS) {
			ret[0xF] = c;
			ret[x]   = r;
		}
		else {
			ret[x]   = r;
			ret[0xF] = c;
		}
	}
	function chaseReturns() {
		var destinations = {};
		for(var rsource in ret['rets']) {
			for(var rdest in reaching[parseInt(rsource)-2]['rets']) {
				destinations[rdest] = true;
			}
		}
		return destinations;
	}
	function markRead(size, offset) {
		if (!offset) { offset = 0; }
		for(var w in ret['i']) {
			var addr = parseInt(w) + offset;
			for(var z = 0; z <= size; z++) {
				setType(addr + z, "data");
			}
		}
	}
	function markWrite(size, offset) {
		// todo: distinguish read-only/read-write data?
		markRead(size, offset);
	}

	// simulate postconditions:
	if (SHIFT_QUIRKS && o == 0x8 && (n == 0x6 || n == 0xE)) { y = x; }

	if (op == 0x00EE)           { ret['rets'] = chaseReturns();                  } // return
	if (o == 0x2)               { ret['rets'] = single(address + 2);             } // call
	if (o == 0x6)               { ret[x] = single(nn);                           } // vx := nn
	if (o == 0x7)               { ret[x] = unary(function(a) { return a + nn;}); } // vx += nn
	if (o == 0x8 && n == 0x0)   { binary  (function(a, b) { return     b; });    } // vx := vy
	if (o == 0x8 && n == 0x1)   { binary  (function(a, b) { return a | b; });    } // vx |= vy
	if (o == 0x8 && n == 0x2)   { binary  (function(a, b) { return a & b; });    } // vx &= vy
	if (o == 0x8 && n == 0x3)   { binary  (function(a, b) { return a ^ b; });    } // vx ^= vy
	if (o == 0x8 && n == 0x4)   { bincarry(function(a, b) { return [a +  b, a + b > 0xFF]; }); }
	if (o == 0x8 && n == 0x5)   { bincarry(function(a, b) { return [a -  b, a >= b];       }); }
	if (o == 0x8 && n == 0x6)   { bincarry(function(a, b) { return [b >> 1, b & 1];        }); }
	if (o == 0x8 && n == 0x7)   { bincarry(function(a, b) { return [b -  a, b >= a];       }); }
	if (o == 0x8 && n == 0xE)   { bincarry(function(a, b) { return [b << 1, b & 128];      }); }
	if (o == 0xA)               { ret['i'] = isingle(nnn);       } // i := nnn
	if (o == 0xC)               { ret[x]   = maskedrand();       } // vx := random nn
	if (o == 0xF && nn == 0x01) { ret['plane'] = single(x);      } // plane n
	if (o == 0xF && nn == 0x07) { ret[x]   = iota(0xFF);         } // vx := delay
	if (o == 0xF && nn == 0x0A) { ret[x]   = iota(0xF);          } // vx := key
	if (o == 0xF && nn == 0x1E) { ret['i'] = ioffsets();         } // i += vx
	if (o == 0xF && nn == 0x29) { ret['i'] = unary(function(a) { return 5*a; });         }
	if (o == 0xF && nn == 0x30) { ret['i'] = unary(function(a) { return 10*a + 16*5; }); }
	if (o == 0xF && nn == 0x75) { for(var z = 0; z <= x; z++) { ret['f'+z] = ret[z]; } }
	if (o == 0xF && nn == 0x85) { for(var z = 0; z <= x; z++) { ret[z] = ret['f'+z]; } }

	// memory operations:
	if (o == 0xD) {
		// sprite vx vy n
		ret[0xF] = { 1:true, 0:true };
		var color = (3 in ret['plane']);
		if (n == 0) { markRead(color ? 63      : 31 ); }
		else        { markRead(color ? (n-1)*2 : n-1); }
	}
	if (o == 0xF && nn == 0x33) {
		// bcd
		markWrite(2);
	}
	if (o == 0xF && nn == 0x55) {
		// save vx
		markWrite(x);
		ioffset(x);
	}
	if (o == 0xF && nn == 0x65) {
		// load vx
		// todo: model written sets so that
		// load results can be more precise?
		var all = iota(0xFF);
		for(var z = 0; z <= x; z++) { ret[z] = all; }
		markRead(x);
		ioffset(x);
	}
	if (op == 0xF002) {
		// audio
		markRead(15);
	}
	if (o == 0x5 && n == 0x2) {
		// save vx - vy
		markWrite(Math.abs(x - y), Math.min(x, y));
	}
	if (o == 0x5 && n == 0x3) {
		// load vx - vy
		var all = iota(0xFF);
		var dist = Math.abs(x - y);
		if (x < y) { for(var z = 0; z <= dist; z++) { ret[x+z] = all; }}
		else       { for(var z = 0; z <= dist; z++) { ret[x-z] = all; }}
		markRead(Math.abs(x - y), Math.min(x, y));
	}

	return ret;
}

function successors(address, prevret) {
	// produce a list of all possible successor addresses
	// of this one, honoring branches and dispatchers.

	var a   = program[address];
	var nn  = program[address+1];
	var op  = (a <<  8) | nn;
	var o   = (a >>  4) & 0xF;
	var x   = (a      ) & 0xF;
	var y   = (nn >> 4) & 0xF;
	var nnn = op & 0xFFF;

	function preciseSkip(address, predicate) {
		// decide which skip paths are possible based
		// on the reaching set to an address.
		var pass = false;
		var skip = false;
		for(var vx in reaching[address][x]) {
			if (pass && skip) { break; }
			for(var vy in reaching[address][y]) {
				if (predicate(parseInt(vx), parseInt(vy), nn)) { skip = true; }
				else                                           { pass = true; }
			}
		}
		var ret = [];
		if (pass) { ret.push(address + 2); }
		if (skip) { ret.push(address + 4); }
		return ret;
	}

	if (op == 0xF000) { return [address+4]; } // xochip wide load
	if (op == 0x0000) { return [];          } // octo implied halt
	if (op == 0x00FD) { return [];          } // superchip halt
	if (o  == 0x1)    { return [nnn];       } // simple jump
	if (o  == 0x2)    { return [nnn];       } // simple call

	// simple skips
	if (o == 0x3) {
		return preciseSkip(address, function(x, y, nn) { return x == nn; });
	}
	if (o == 0x4) {
		return preciseSkip(address, function(x, y, nn) { return x != nn; });
	}
	if (o == 0x5) {
		return preciseSkip(address, function(x, y, nn) { return x == y; });
	}
	if (o == 0x9) {
		return preciseSkip(address, function(x, y, nn) { return x != y; });
	}

	if ((a & 0xF0) == 0xE0 && (nn == 0x9E || nn == 0xA1)) {
		// key input skips - take both branches.
		return [address + 2, address + 4];
	}
	if (op == 0x00EE) {
		// return - follow all valid source addrs.
		var ret = [];
		for(var v in prevret) {
			ret.push(parseInt(v));
		}
		return ret;
	}
	if (o == 0xB) {
		// jump0 - follow all possible targets.
		var ret = [];
		for(var v in reaching[address][0]) {
			ret.push(nnn + parseInt(v));
		}
		return ret;
	}

	// default to next instruction in program.
	return [address + 2];
}

function analyzeInit(rom, quirks) {
	program     = [];
	reaching    = {};
	type        = {};
	labels      = {};
	subroutines = {};
	natives     = {};
	lnames      = {};
	snames      = {};
	nnames      = {};
	romsize     = rom.length;

	SHIFT_QUIRKS      = quirks['shiftQuirks']     | false;
	LOAD_STORE_QUIRKS = quirks['loadStoreQuirks'] | false;
	VF_ORDER_QUIRKS   = quirks['vfOrderQuirks']   | false;
	
	reaching[0x200] = {};
	for(var z = 0; z < regNames.length; z++) {
		reaching[0x200][regNames[z]] = { 0:true };
	}
	reaching[0x200]['rets'] = {};
	reaching[0x200]['plane'] = { 1:true };
	fringe = [0x200];

	for(var x = 0; x < 4096 * 2; x++)   { program[x] = 0x00; }
	for(var x = 0; x < rom.length; x++) { program[x+0x200] = rom[x]; }
}

function analyzeWork() {
	function reachingMerge(a, b) {
		// take the union of two reaching sets.
		// if we altered b, it was a subset of a.
		var changed = false;
		for(var z = 0; z < regNames.length; z++) {
			var register = regNames[z];
			var values = Object.keys(a[register]);
			for(var vindex = 0; vindex < values.length; vindex++) {
				var value = values[vindex];
				if(!(value in b[register])) {
					changed = true;
					b[register][value] = true;
				}
			}
		}
		return changed;
	}

	if (fringe.length < 1) { return true; }

	var here = fringe.pop();

	// compute successor reaching set
	var prevret = reaching[here]['rets']; // apply blows this away (!)
	var output = apply(here);

	// apply successor set to children and enlist them
	var children = successors(here, prevret);

	for(var x = 0; x < children.length; x++) {
		var child = children[x];
		var isReturn = (program[child] == 0x00 && program[child+1] == 0xEE);

		if ((typeof reaching[child]) == "undefined") {
			// always explore fresh nodes:
			reaching[child] = copyReachingSet(output);
			if (fringe.lastIndexOf(child) == -1) {
				fringe.push(child);
			}
		}
		else if (reachingMerge(output, reaching[child]) || isReturn) {
			// if merging expanded the child reaching set,
			// explore it again:
			if (fringe.lastIndexOf(child) == -1) {
				fringe.push(child);
			}
		}
	}
	return false;
}

function analyzeFinish() {
	// name all labels and subroutines by order of appearance:
	var lsize = 0;
	var ssize = 0;
	var nsize = 0;
	if (typeof labels[0x200] == "undefined") { labels[0x200] = [4097]; }
	lnames[0x200] = "main";
	snames[0x200] = "main";
	for(var x = 0; x < program.length; x++) {
		if (x == 0x200)       { continue; }
		if (x in labels)      { lnames[x] = "label-"   + (lsize++); }
		if (x in subroutines) { snames[x] = "sub-"     + (ssize++); }
		if (x in natives)     { nnames[x] = "machine-" + (nsize++); }
	}
}

function analyze(rom, quirks) {
	analyzeInit(rom, quirks);
	while(!analyzeWork()) {}
	analyzeFinish();
}

function formatProgram(programSize) {
	var ret = "";
	if (SHIFT_QUIRKS) {
		ret += "# analyzed with shifts that modify vx in place and ignore vy.\n";
	}
	if (LOAD_STORE_QUIRKS) {
		ret += "# analyzed with load and store operations that don't modify i.\n";
	}
	if (VF_ORDER_QUIRKS) {
		ret += "# analyzed with arithmetic results written to vf after the status flag.\n";
	}
	ret += "\n";

	// labels beyond rom boundaries
	// are converted into constants to avoid
	// introducing additional padding bytes
	// or lost label declarations.
	function findOutside(source, dest, names) {
		for(var a in source) {
			var addr = parseInt(a);
			if (addr < 0x200 || addr >= 0x200 + programSize) {
				dest[addr] = true;
				ret += (":const " + names[addr] + " " + numericFormat(addr) + "\n");
			}
		}
	}
	var outside = {};
	findOutside(labels,      outside, lnames);
	findOutside(subroutines, outside, snames);
	findOutside(natives,     outside, nnames);

	// emit code/data
	function tabs(n) {
		var r = "";
		while(n --> 0) { r += "\t"; }
		return r;
	}
	var pendingAgain = [];
	for(var x = 0; x < programSize; x++) {
		var a = (x + 0x200);

		// process native code, if applicable:
		if (a in natives && a != 0x200) {
			var nat = formatNative(a, "\t");
			ret += nat[1];
			if (nat[0] > 0) {
				x += nat[0] - 1;
				continue;
			}
		}

		// emit labels and find loop heads
		if (a in subroutines) {
			ret += ("\n: " + snames[a] + "\n");
		}
		if (a in labels) {
			if (lnames[a] == "main" && !(a in subroutines)) { ret += (": main\n"); }

			for(var z = 0; z < labels[a].length; z++) {
				var u = labels[a][z];
				// must be a backref
				if (u < a) { continue; }
				// must be an unconditional jump
				if ((program[u] & 0x10) != 0x10) { continue; }
				// must be in a contiguous forward block
				var foundBreak = false;
				for(var scan = a; scan <= u; scan += 2) {
					if (scan in subroutines && scan != a) {
						// a contiguous block can't contain subroutine entrypoints
						foundBreak = true;
						break;
					}
					if (type[scan] != "code" && type[scan] != "smc") {
						// a contiguous block can't contain non-code
						foundBreak = true;
						break;
					}
					if((program[scan] & 0xF0) == 0x10) {
						// a contiguous block can't contain a jump to before the loop head
						var target = ((program[scan] & 0xF) << 8) | (program[scan+1] & 0xFF);
						if (target < a) {
							foundBreak = true;
							break;
						}
					}
				}
				if (foundBreak) { continue; }

				// loop head identified:
				labels[a].splice(z--, 1);
				pendingAgain.push(u);
				ret += (tabs(pendingAgain.length) + "loop\n");
			}

			if (labels[a].length > 0 && lnames[a] != "main") {
				ret += (": " + lnames[a] + "\n");
			}
		}

		// emit half-labels
		if (type[a] == "code" || type[a] == "smc") {
			if      ((a + 1) in labels     ) { ret += (":next " + lnames[a+1] + "\n"); }
			else if ((a + 1) in subroutines) { ret += (":next " + snames[a+1] + "\n"); }
		}

		// emit instruction/data
		var indent = tabs(pendingAgain.length + 1);
		if (pendingAgain.indexOf(a) != -1) {
			var index = pendingAgain.indexOf(a);
			pendingAgain.splice(index, 1);
			ret += (tabs(pendingAgain.length + 1) + "again\n");
			x++;
		}
		else if (type[a] == "code") {
			if (program[a] == 0xF0 && program[a+1] == 0x00) {
				var nnnn = (program[a+2] << 8) | (program[a+3]);
				ret += (indent + "i := long "+lnames[nnnn] + "\n");
				x+=3;
			}
			else {
				ret += (indent + formatInstruction(program[a], program[a+1]) + "\n");
				x++;
			}
		}
		else if (type[a] == "data") {
			ret += (indent + hexFormat(program[a]) + "\n");
		}
		else if (type[a] == "smc" && (type[a+1] == "smc" || type[a+1] == "code")) {
			ret += indent;
			ret += hexFormat(program[a]) + " " + hexFormat(program[a+1])
			ret += " # smc? " + formatInstruction(program[a], program[a+1]) + "\n";
			x++;
		}
		else {
			ret += (indent + hexFormat(program[a]) + " # unused?\n");
		}

		// space apart regions of differing types:
		if (type[a] != type[x+0x201]) {
			ret += "\n";
		}
	}

	return ret;
}

this.analyze       = analyze;
this.analyzeInit   = analyzeInit;
this.analyzeWork   = analyzeWork;
this.analyzeFinish = analyzeFinish;
this.formatProgram = formatProgram;
