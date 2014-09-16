import java.util.*;
import java.io.*;
import java.awt.image.*;
import javax.imageio.*;

public class TextPack {
	
	public static void main(String[] argArray) {
		// handle arguments
		List<String> args = new ArrayList<>(Arrays.asList(argArray));
		boolean toimage = args.contains("--toimage");
		args.remove("--toimage");
		boolean strip = args.contains("--strip");
		args.remove("--strip");
		if (args.size() != 3) {
			System.err.println("usage: textpack [--toimage] [--strip] <font> <alphabet> <text>");
			System.exit(1);
		}
		String alphabet = args.get(1);
		String text = args.get(2);

		// load font data
		BufferedImage font = null;
		String basename = "";
		try {
			File target = new File(args.get(0));
			font = ImageIO.read(target);
			basename = target.getName().split("\\.")[0];
		}
		catch(IOException e) {
			System.err.println("unable to load image '"+args.get(0)+"'");
			System.exit(1);
		}

		// split font data into characters
		List<Chunk> chunks = new ArrayList<>();
		{
			int charHeight = font.getHeight() / alphabet.length();
			int offset = 0;
			for(char c : alphabet.toCharArray()) {
				Chunk chunk = new Chunk();
				chunks.add(chunk);
				for(int y = 0; y < charHeight; y++) {
					byte row = 0;
					for(int x = 0; x < 8; x++) {
						int pixel = font.getRGB(x, y+offset);
						row = (byte)((row << 1) | (((pixel & 0xFF000000) != 0) ? 1 : 0));
					}
					chunk.data.add(row);
				}
				chunk.offsets.put(c, 0);
				offset += charHeight;
			}
		}

		// strip unused characters from font data
		if (strip) {
			for(char c : alphabet.toCharArray()) {
				if (text.indexOf(c) >= 0) { continue; }
				for(int index = 0; index < chunks.size(); index++) {
					if (chunks.get(index).offsets.containsKey(c)) {
						chunks.remove(index);
						break;
					}
				}
			}
		}

		// compress font data
		// by greedily overlapping pairs of chunks
		// until only one chunk remains.
		while(chunks.size() > 1) {
			Chunk bestA = null;
			Chunk bestB = null;
			Chunk bestC = null;
			int bestSize = Integer.MAX_VALUE;

			for(Chunk a : chunks) {
				for(Chunk b : chunks) {
					if (a == b) { continue; }
					Chunk c = a.overlap(b);
					if (c.size() >= bestSize) { continue; }
					bestA = a;
					bestB = b;
					bestC = c;
					bestSize = c.size();
				}
			}

			chunks.remove(bestA);
			chunks.remove(bestB);
			chunks.add(bestC);
		}
		List<Byte> data = chunks.get(0).data;

		// format out font data
		if (data.size() > 256) {
			System.out.println("warning- packed font data exceeds 256 bytes!");
		}
		System.out.format(": %s # (%d bytes)%n\t", basename, data.size());
		for(int index = 0; index < data.size(); index++) {
			System.out.format((index % 8 == 7) ? "0x%02X%n\t" : "0x%02X ",
				data.get(index)
			);
		}
		System.out.println();

		// format out encoded string
		for(int index = 0; index < text.length(); index++) {
			if (!chunks.get(0).offsets.containsKey(text.charAt(index))) {
				System.err.format("error- The alphabet does not contain the character '%c'!%n",
					text.charAt(index)
				);
				System.exit(0);
			}
		}
		System.out.format(": text # (%d bytes)%n\t", text.length());
		for(int index = 0; index < text.length(); index++) {
			System.out.format((index % 8 == 7) ? "0x%02X%n\t" : "0x%02X ",
				chunks.get(0).offsets.get(text.charAt(index))
			);
		}
		System.out.println();

		// write out image data
		if (toimage) {
			BufferedImage out = new BufferedImage(
				8,
				data.size(),
				BufferedImage.TYPE_BYTE_BINARY
			);
			for(int y = 0; y < data.size(); y++) {
				byte v = data.get(y);
				for(int x = 0; x < 8; x++) {
					out.setRGB(x, y,
						((v >> (7-x))&1) != 0 ? 0xFF000000 : 0xFFFFFFFF
					);
				}
			}
			try {
				ImageIO.write(out, "png", new File(basename + "-output.png"));
			}
			catch(IOException e) {
				System.err.println("unable to write image '"+basename+"-output.png'");
				System.exit(1);
			}
		}

		System.exit(0);
	}
}

class Chunk {
	List<Byte> data = new ArrayList<>();
	Map<Character, Integer> offsets = new HashMap<>();

	int size() {
		return data.size();
	}

	private Chunk overlap(Chunk next, int index) {
		Chunk ret = new Chunk();
		ret.data.addAll(data);
		ret.offsets.putAll(offsets);

		for(int z = index; z < next.data.size(); z++) {
			ret.data.add(next.data.get(z));
		}
		for(Map.Entry<Character, Integer> e : next.offsets.entrySet()) {
			ret.offsets.put(e.getKey(), e.getValue() + data.size() - index);
		}
		return ret;
	}

	private boolean canOverlap(Chunk next, int index) {
		if (index > size()) { return false; }
		for(int z = 0; z < index; z++) {
			byte a = data.get(data.size() - index + z);
			byte b = next.data.get(z);
			if (a != b) { return false; }
		}
		return true;
	}

	Chunk overlap(Chunk next) {
		for(int index = next.size(); index > 0; index--) {
			if (canOverlap(next, index)) {
				return overlap(next, index);
			}
		}
		return overlap(next, 0);
	}
}