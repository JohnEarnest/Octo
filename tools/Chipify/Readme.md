Chipify
=======

Chipify is a Python script that filters and encodes audio for Octo with the XO-Chip extended instruction set. It takes as input a mono-channel WAV file, and spits out both a preview WAV file (`*.out.wav`) as well as a text file with base 16-encoded bytes suitable for Octo (`*.out.txt`).

Chipify requires [NumPy](http://www.scipy.org/scipylib/download.html) to run, and was developed against Python 2.7.1.

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
Chipify was written by [blastron](https://github.com/blastron/).
