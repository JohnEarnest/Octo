/**
* Sharing/Loading externally-hosted programs
**/

const placeholderProgram = `# Chip8 is a virtual machine designed in 1977 for programming video games.
# Octo is a high level assembler, disassembler and simulator for Chip8.
# Click 'Run' and then press ASWD to move the sprite around the screen.
# Click the Octo logo for source, documentation and examples.

:alias px v1
:alias py v2

: main
  px := random 0b0011111
  py := random 0b0001111
  i  := person
  sprite px py 8

  loop
    # erase the player, update its position and then redraw:
    sprite px py 8
    v0 := OCTO_KEY_W if v0 key then py += -1
    v0 := OCTO_KEY_S if v0 key then py +=  1
    v0 := OCTO_KEY_A if v0 key then px += -1
    v0 := OCTO_KEY_D if v0 key then px +=  1
    sprite px py 8

    # lock the framerate of this program via the delay timer:
    loop
      vf := delay
      if vf != 0 then
    again
    vf := 3
    delay := vf
  again

: person
  0x70 0x70 0x20 0x70 0xA8 0x20 0x50 0x50`

var lastLoadedKey = null
const sharingBaseUrl = 'https://vectorland.nfshost.com/storage/octo/'

function share() {
	var payload = {
		key:     lastLoadedKey,
		program: editor.getValue(),
		options: packOptions(emulator),
	}
	ajax('POST', sharingBaseUrl, payload, (r, s) => {
		if (r.error) { setStatusMessage(r.error, false); return }
		var l = window.location.href.replace(/(index\.html|\?key=.*)*$/, 'index.html?key=' + r.key)
		window.location.href = l
	})
}

function runPayload(options, program) {
	editor.setValue(program)
	speedMenu.setValue(options.tickrate)
	unpackOptions(emulator, options)
	document.getElementById('main-run').click()
}
function runShared(key) {
	ajax('GET', sharingBaseUrl + key, null, (result, s) => {
		lastLoadedKey = key
		runPayload(result.options, result.program)
	})
}
function runGist(id) {
	ajax('GET', 'https://api.github.com/gists/' + id, null, (result, s) => {
		runPayload(JSON.parse(result.files['options.json'].content), result.files['prog.ch8'].content)
	})
}

function saveLocalOptions() { localStorage.setItem('octoOptions', JSON.stringify(packOptions(emulator))) }
function saveLocalProgram() { localStorage.setItem('octoProgram', JSON.stringify(editor.getValue())) }

window.onload = _ => {
	// load examples
	ajax('GET', 'https://api.github.com/repos/JohnEarnest/Octo/contents/examples', null, result => {
		const target = document.querySelector('#main-examples ul')
		target.innerHTML = ''
		result.forEach(x => {
			var r = document.createElement('li')
			r.innerHTML = x.name
			r.onclick = _ => ajax('GET', x.url, null, result => {
				editor.setValue(window.atob(result.content.replace(/(?:\r\n|\r|\n)/g, '')))
				setStatusMessage('loaded example program <tt>'+x.name+'</tt>', true)
			})
			target.appendChild(r)
		})
	})

	// load a shared program, if specified
	const key = location.search.match(/key=([a-zA-Z0-9-_]+)/)
	if (key) { runShared(key[1]); return }
	const gistId = location.search.match(/gist=(\w+)/)
	if (gistId) { runGist(gistId[1]); return }

	// restore the local data, if available
	try {
		const options = JSON.parse(localStorage.getItem('octoOptions'))
		const program = JSON.parse(localStorage.getItem('octoProgram'))
		if (options) unpackOptions(emulator, options)
		if (program && program.trim().length) {
			editor.setValue(program)
			setStatusMessage('Restored local working copy.', true)
			return
		}
	}
	catch (error) {
		console.log('restoring workspace failed!')
		console.log(error)
	}

	// fall back to the demo program
	editor.setValue(placeholderProgram)
}
