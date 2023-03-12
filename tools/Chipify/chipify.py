__author__ = 'blastron'

sass_lines = [
    "Apologize to your audio software.",
    "I hope you realize that what you are doing is wrong.",
    "Prepare yourself for the consequences.",
    "Every bit you crush is a callous waste of sound.",
    "You are a 1-bit monster.",
    "Octo might forgive you, but I never will."
]

# Check for mandatory components that the user may not have
import imp
try:
    imp.find_module("numpy")
except ImportError:
    print("Chipify requires NumPy: http://www.scipy.org/scipylib/download.html/")
    exit()

import numpy
import sys
import wave
import random
import math

if len(sys.argv) is not 2:
    print("USAGE: python chipify.py FILENAME")
    exit()

filename = sys.argv[1]
try:
    input_file = wave.open(filename, "r")
except IOError:
    print("Unable to open file %s." % filename)
    exit()

# Ensure this is a valid format
if input_file.getnchannels() != 1:
    print("Unsupported number of channels (%i). Must be a mono file." % input_file.getnchannels())
    exit()

# Determine the number of input and output samples
input_framerate = input_file.getframerate()
input_frame_count = input_file.getnframes()

input_frame_width = input_file.getsampwidth()
input_max_value = int("ff" * input_frame_width, 16)

output_framerate = 4000
output_frame_count = int(input_frame_count * (output_framerate / float(input_framerate)))

print("Loading from file " + filename)
print("%i input samples at %i KHz, %i output samples at %i KHz" % (input_frame_count, input_framerate / 1000,
                                                                   output_frame_count, output_framerate / 1000))
print("Target output size: %i bytes." % (math.ceil(output_frame_count / 8.0)))

print("-----")
print(random.choice(sass_lines))
print("-----")


print("Reading input file into memory...")
target_data_type = "int%i" % (input_frame_width * 8)
raw_input_data = input_file.readframes(-1)
input_frames = numpy.fromstring(raw_input_data, target_data_type)

print("Building low-pass filter...")
relative_cutoff_frequency = output_framerate / float(input_framerate)
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
input_frames_per_output_frame = input_frame_count / float(output_frame_count)
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

    averaged_input = total_input / float(input_frames_per_output_frame)
    output_bits.append(1 if averaged_input < 0.5 else 0)

# Pad the output with zeroes if we don't have an even number of bits
if len(output_bits) % 8 != 0:
    output_bits += [0] * (8 - len(output_bits) % 8)

print("Writing crushed wave to disk...")
output_wave = wave.open(filename + ".out.wav", "w")
output_wave.setnchannels(1)
output_wave.setsampwidth(1)
output_wave.setframerate(output_framerate)
output_wave.writeframes("".join(chr(255) if i else chr(0) for i in output_bits))
output_wave.close()

print("Writing Octo-compatible text to disk...")

# Write bytes
output_bytes = []
for i in range(len(output_bits) / 8):
    byte = output_bits[i * 8]
    for j in range(7):
        byte = byte << 1
        byte += output_bits[i * 8 + j + 1]
    output_bytes.append(hex(byte))

output = open(filename + ".out.txt", "w")
output.write(" ".join(output_bytes))
output.close()
