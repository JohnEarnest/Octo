"""
A 1-bit bit-crushing tool for XO-CHIP.

Requires the following to run:

* NumPy
* Python 3.6+

Original by blastron, upgraded by pushfoo.
"""
__authors__ = [
    'blastron',  # The original author
    'pushfoo'    # Refinements and updates for Python 3
]

# Optional sass lines; silence them with --quiet-sass
sass_lines = [
    "Apologize to your audio software.",
    "I hope you realize that what you are doing is wrong.",
    "Prepare yourself for the consequences.",
    "Every bit you crush is a callous waste of sound.",
    "You are a 1-bit monster.",
    "Octo might forgive you, but I never will."
]

# Check for mandatory components that the user may not have
try:
    import numpy
except ImportError:
    print("Chipify requires NumPy: http://www.scipy.org/scipylib/download.html/")
    exit(1)

import sys
import wave
import random
import math
import argparse

from pathlib import Path
from textwrap import dedent
from contextlib import contextmanager

from typing import Union


parser = argparse.ArgumentParser(
    prog="python3 chipify.py", description=__doc__,
    formatter_class=argparse.RawTextHelpFormatter
)
parser.add_argument(
    '--quiet-sass', '-q', action='store_true', default=False,
    help="Pass this flag to turn off sass lines; useful in build scripts.")
parser.add_argument(
    'infile', type=Path,
    help=dedent("""
        The WAV file to bit crush."""))
parser.add_argument(
    'outfile', nargs='?',
    help=dedent(
        """
           (Optional) Override the default write target.

           If absent, the input filename will be used as the base for
           output filenames

           In both cases, the following rules apply:

           1. The suffix will be stripped from this path if present
           2. Bit-crushed sound will be written to stem.out.wav
           3. Octo-compatible bytes will be written to stem.out.txt
        """))


# Show full help if run with 0 argumnents
if len(sys.argv) == 1:
    parser.print_help(sys.stderr)
    parser.exit(1)

# Otherwise, begin running
args = parser.parse_args()


PathLike = Union[bytes, str, Path]

def expand_and_resolve(path: PathLike) -> Path:
    return Path(path).expanduser().resolve()


@contextmanager
def load_and_validate_mono_wav(path: PathLike) -> GeneratorExit:
    """
    Load a wave and yield it as an input file.

    This function can be used as a context manager in with statements::

        with load_and_validate_mono_wav("file.wav") as input_file:

    :param path: A path on disk to read from.
    """
    expanded_path = expand_and_resolve(path)
    # The WAV library was never updated with pathlib support
    path_as_str = str(expanded_path)
    try:
        with wave.open(path_as_str, "rb") as input_file:
            n_channels = input_file.getnchannels()
            if n_channels != 1:
                parser.exit(1,
                    f"Unsupported number of channels ({n_channels})."
                    f"Must be a mono file")
            yield input_file

    except IOError:
        parser.exit(1, f"Unable to open file {path_as_str!r}")


# if input_file.getnchannels() != 1:
input_file_name = expand_and_resolve(args.infile)


# Determine the number of input and output samples
with load_and_validate_mono_wav(input_file_name) as input_file:

    input_framerate = input_file.getframerate()
    input_frame_count = input_file.getnframes()

    input_frame_width = input_file.getsampwidth()
    input_max_value = int("ff" * input_frame_width, 16)

    output_framerate = 4000
    output_frame_count = int(input_frame_count * (output_framerate / input_framerate))

    print(f"Loading from file {str(input_file_name)!r}")
    print(f"{input_frame_count} input samples at {input_framerate / 1000} KHz, "
          f"{output_frame_count} output samples at {output_framerate / 1000} KHz")
    print(f"Target output size: {math.ceil(output_frame_count / 8)} bytes.")

    if not args.quiet_sass:
        print("-----")
        print(random.choice(sass_lines))
        print("-----")

    print("Reading input file into memory...")
    target_data_type = f"int{input_frame_width * 8}"
    raw_input_data = input_file.readframes(-1)

input_frames = numpy.frombuffer(raw_input_data, target_data_type)


print("Building low-pass filter...")
relative_cutoff_frequency = output_framerate / input_framerate
transition_band = 0.05

# Determine number of samples in our filter.
N = int(math.ceil(4 / transition_band))
if not N % 2: N += 1
n = numpy.arange(N)

# Compute sinC filter
h = numpy.sinc(2 * relative_cutoff_frequency * (n - (N - 1) / 2.))

# Compute Blackman window
w = 0.42 - 0.5 * numpy.cos(2 * numpy.pi * n / (N - 1)) + 0.08 * numpy.cos(4 * numpy.pi * n / (N - 1))

# Multiply sinC filter with the window, then normalize to get unity gain
lowpass_filter = (h * w) / numpy.sum(h)

print("Applying low-pass filter...")
filtered_input_frames = numpy.convolve(input_frames, lowpass_filter).astype(input_frames.dtype)

print("Crushing signal, mercilessly...")
input_frames_per_output_frame = input_frame_count / output_frame_count
input_frames_consumed = 0

current_frame = 0
current_frame_index = 0
leftover_frame_weight = 0

output_bits = []

while input_frames_consumed < input_frame_count:
    input_frames_to_consume = input_frames_per_output_frame

    total_input = 0
    if leftover_frame_weight > 0:
        input_frames_to_consume -= leftover_frame_weight
        total_input += current_frame * leftover_frame_weight
        leftover_frame_weight = 0

    while input_frames_to_consume > 0:
        current_frame = filtered_input_frames[current_frame_index]
        current_frame_index += 1

        current_frame_weight = min(1, input_frames_to_consume)
        total_input += current_frame * current_frame_weight
        leftover_frame_weight = 1 - current_frame_weight

        input_frames_consumed += 1
        input_frames_to_consume -= 1

    averaged_input = total_input / input_frames_per_output_frame
    output_bits.append(1 if averaged_input < 0.5 else 0)

# Pad the output with zeroes if we don't have an even number of bits
if len(output_bits) % 8 != 0:
    output_bits += [0] * (8 - len(output_bits) % 8)


# Get the base filename by removing extensions
outfile_raw = getattr(args, 'outfile') or input_file_name
filename_stem = Path(outfile_raw).stem
suffixes = input_file_name.suffixes
outfile_base = Path.cwd() / (''.join([filename_stem, *suffixes[:-1]]))


# Use an f-string since the wave writer isn't updated to use pathlib
out_wav = f"{outfile_base}.out.wav"
print(f"Writing crushed wave to disk at {out_wav!r}...")
with wave.open(out_wav, "w") as output_wave:
    output_wave.setnchannels(1)
    output_wave.setsampwidth(1)
    output_wave.setframerate(output_framerate)
    output_wave.writeframes(bytes(255 if i else 0 for i in output_bits))


outfile_txt = outfile_base.with_suffix(".out.txt")
print(f"Writing Octo-compatible text to disk at {str(outfile_txt)!r}...")

# Write bytes
output_bytes = []
for i in range(len(output_bits) // 8):
    byte = output_bits[i * 8]
    for j in range(7):
        byte = byte << 1
        byte += output_bits[i * 8 + j + 1]
    output_bytes.append(hex(byte))

with open(outfile_txt, "w") as output:
    output.write(" ".join(output_bytes))
