Chipify
=======

Chipify is a Python script that filters and encodes audio for Octo with the XO-Chip extended instruction set. It takes as input a mono-channel WAV file, and spits out both a preview WAV file (`*.out.wav`) as well as a text file with base 16-encoded bytes suitable for Octo (`*.out.txt`).

### Requirements:

Chipify requires the following to run:

* [Python 3.8](https://python.org) or higher
* [NumPy](https://numpy.org/), which must be installed separately

### Installing:

[venvs]: https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/#creating-a-virtual-environment
[pipx]: https://pypa.github.io/pipx/

1. Make sure you've [created & activated](venvs) a virtual environment
2. Run `pip install -r requirements.txt` to gather and install the requirements

You can also try [pipx](pipx) to install to your user account instead of a single venv.

### Usage:
```
python chipify.py FILENAME
```

### Try it out:
Here is a simple Octo program that will play all data encoded after the `data` label. Copy the data from your output file into the data block and listen!
```
: main
	v0 := 16
	v1 := 2
	i := data
	loop
		audio
		buzzer := v0
		delay := v1
		wait
		i += v0
	again

: wait
	loop
		vf := delay
		if vf != 0 then
	again
;

# Replace this with your audio
: data 0xFF 0x00 0xFF 0x00 0xFF 0x00 0xFF 0x00 0xFF 0x00 0xFF 0x00
```

Chipify was written by [blastron](https://github.com/blastron/) and updated for Python 3 by [pushfoo](https://github.com/pushfoo/).
