/**
* Codemirror mode for Octo Assembler
**/

CodeMirror.defineMode('octo', function(config, options) {

	const TOKEN = /[^\s]+/
	
	const CONTROL = {
		return:1, if:1, then:1, begin:1, else:1, end:1,
		loop:1, again:1, while:1, jump:1, jump0:1, ';':1,
	}
	const STATEMENTS = {
		clear:1, bcd:1, save:1, load:1, sprite:1, hex:1, random:1,
		delay:1, key:1, '-key':1, buzzer:1, native:1, hires:1, lores:1,
		'scroll-down':1, 'scroll-left':1, 'scroll-right':1, bighex:1,
		exit:1, saveflags:1, loadflags:1, long:1, plane:1, audio:1, 'scroll-up':1,
	}
	const DIRECTIVES = {
		':alias':1, ':const':1, ':unpack':1, ':next':1, ':org':1,
		':byte':1, ':breakpoint':1, ':macro':1, ':calc':1, ':call':1, ':monitor':1,
	}

	function token(stream, state) {
		stream.eatSpace()

		// comments are a special case
		if (stream.peek() == '#') {
			stream.skipToEnd()
			return 'comment'
		}

		// otherwise, octo tokens are whitespace-separated
		const t = stream.match(TOKEN)

		if (/^([vV][0-9a-fA-F]|i)$/.test(t)) {
			return 'def' // registers
		}
		if (/^(\:=|\+=|\-=|=\-|\|=|&=|\^=|<<=|>>=)$/.test(t)) {
			return 'keyword' // assignment
		}
		if (/^(==|!=|<=|>=|<|>)$/.test(t)) {
			return 'keyword' // relationals
		}
		if (/^(([+\-]?0b[01]+)|([+\-]?0x[0-9a-fA-F]+)|([+\-]?\d+))$/.test(t)) {
			return 'number' // numeric literals
		}
		if (CONTROL[t]) {
			return 'keyword' // control flow
		}
		if (STATEMENTS[t]) {
			return 'keyword' // statements
		}
		if (DIRECTIVES[t]) {
			return 'variable-2' // compiler directives
		}
		if (t == ':') { // labels
			stream.eatSpace()
			stream.match(TOKEN)
			return 'attribute'
		}
		return null
	}

	return {
		startState:  _ => ({}),
		copyState:   x => ({}),
		token:       token,
		lineComment: '# ',
	}
})
