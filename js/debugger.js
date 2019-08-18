/**
* Debugger and Profiler
**/

const runContinue = document.getElementById('run-continue')
const debugPanel  = document.getElementById('debugger')

const regNumFormat = {}
function cycleNumFormat(r) {
	const f = ['hex','bin','dec','hex']
	regNumFormat[r] = f[f.indexOf(regNumFormat[r] || 'hex')+1]
	haltBreakpoint()
}

function getLabel(addr,reg,raw) {
	var n = 'hex-font', x = 0
	for (var k in emulator.metadata.labels) {
		var v = emulator.metadata.labels[k]
		if (v > x && v <= addr) { n = k; x = v }
	}
	if (raw) return n
	return '('+n+(x == addr ? '' : ' + '+(addr-x))+')'
}

function dumpRegisters(showV, name) {
	const line = (text, click) => '<span' + (click ? ' onClick="'+click+'"' : '')+'>' + text + '</span><br>'
	const register = (n, v, f) => line(n + ' := ' + numericFormat(v, regNumFormat[n || 'hex']) + ' ' + f(v,n), 'cycleNumFormat(\''+n+'\')')
	const aliases = (addr,reg) => {
		var a = emulator.metadata.aliases
		var r = +('0x'+reg.slice(1))
		var n = Object.keys(a).filter(k => a[k] == r).join(', ')
		return n.length ? '('+n+')' : ''
	}
	return (
		line('tick count: ' + emulator.tickCounter) +
		line('breakpoint: ' + name) +
		register('pc', emulator.pc, getLabel) +
		register('i', emulator.i, getLabel) +
		(showV ? range(16).map(x => register('v'+(x.toString(16).toUpperCase()), emulator.v[x], aliases)).join('') : '') +
		'<br>'
	)
}
function dumpStack() {
	return 'inferred stack trace:<br>' + emulator.r.map(x => hexFormat(x) + getLabel(x) + '<br>').join('') + '<br>'
}
function dumpContext() {
	const dbg = emulator.metadata.dbginfo
	const pcline = dbg.getLine(emulator.pc)
	var memlo = emulator.pc, memhi = emulator.pc
	while (dbg.getLine(memlo - 1) > pcline - 8) memlo--
	while (dbg.getLine(memhi + 1) < pcline + 8) memhi++
	var ind = memlo
	const lines = []
	for (var x = dbg.getLine(memlo); x <= dbg.getLine(memhi); x++) lines.push(x)
	const row = (c,a,d,s) => '<tr'+(c?' class=\'current\'':'')+'><td>'+a+'</td><td>'+d+'</td><td><pre>'+escapeHtml(s)+'</pre></td></tr>'
	const linebytes = x => { var r = ''; while(dbg.getLine(ind) == x) r += hexFormat(emulator.m[ind++]).slice(2) + ' '; return r }
	return (
		'context:<br><table class=\'debug-context\'>' +
			row(false, 'addr', 'data', 'source') +
			lines.filter(x => !dbg.lines[x].match(/^\s*$/)).map(x => {
				const here = dbg.getLine(ind)
				return row(
					here == pcline,
					here != x ? '' : hexFormat(ind).slice(2),
					here != x ? '' : linebytes(x),
					dbg.lines[x]
				)
			}).join('') +
		'</table>'
	)
}
function dumpProfile() {
	const profile = []
	for (var addr = 0; addr < 65536; ) {
		while (emulator.profile_data[addr] == undefined && addr < 65536) addr++
		if (addr > 65535) break

		const head = addr, label = getLabel(addr, 0, true)
		var ticks = 0
		while (emulator.profile_data[addr] != undefined && getLabel(addr, 0, true) == label) {
			ticks += emulator.profile_data[addr]
			addr += 2
		}
		if (addr > 65535) break

		profile.push({
			ticks:   ticks,
			percent: 100.0 * (ticks / emulator.tickCounter),
			calls:   emulator.profile_data[head],
			source:  getLabel(head) + ' + ' + ((addr - 2) - head),
		})
	}
	return (
		'<table class=\'debug-profile\'><tr> <th>ticks</th> <th>time</th> <th>calls</th> <th>source</th> </tr>'+
			profile.sort((a,b) => b.percent - a.percent).slice(0, 20).map(
				x => '<tr><td>'+x.ticks+'</td> <td>'+x.percent.toFixed(2)+'%</td> <td>'+x.calls+'</td> <td>'+x.source+'</td></tr>'
			).join('') +
		'</table>' +
		'<div class=\'debug-profile-results\'>' +
			'<div>Full results:<div>' +
			'<div class=\'debug-profile-full\'>' + JSON.stringify(profile) + '</div>' +
		'</div>'
	)
}

function clearBreakpoint() {
	setVisible(runContinue, false)
	setVisible(debugPanel,  false)
	emulator.breakpoint = false
}

function haltBreakpoint(name) {
	setVisible(runContinue, true, 'inline')
	setVisible(debugPanel,  true)
	emulator.breakpoint = true
	debugPanel.innerHTML = dumpRegisters(true, name) + dumpStack() + dumpContext()
}

function haltProfiler(name) {
	setVisible(runContinue, true, 'inline')
	setVisible(debugPanel,  true)
	emulator.breakpoint = true
	debugPanel.innerHTML = dumpRegisters(false, name) + dumpProfile()
}
