import java.util.*;
import java.io.*;
import java.awt.image.*;
import javax.imageio.*;

public class Smoothie {
	
	public static void main(String[] a) {
		// handle arguments
		List<String> args = new ArrayList<>(Arrays.asList(a));
		boolean toimage = args.contains("--toimage");
		args.remove("--toimage");
		boolean raw = args.contains("--raw");
		args.remove("--raw");
		boolean pad = args.contains("--pad");
		args.remove("--pad");

		if (args.size() != 1) {
			System.err.println("usage: smoothie [--toimage] [--raw] [--pad] <filename>");
			System.exit(1);
		}

		// load image data
		BufferedImage image = null;
		String basename = "";
		try {
			File target = new File(args.get(0));
			image = ImageIO.read(target);
			basename = target.getName().split("\\.")[0];
		}
		catch(IOException e) {
			System.err.println("unable to load image '"+args.get(0)+"'");
			System.exit(1);
		}

		// split image data into sprites
		List<int[]> sprites = new ArrayList<>();
		int height = Math.min(image.getHeight(), 16);
		int width  = (height == 16) ? 16 : 8;
		for(int n = 0; n < image.getWidth() / width; n++) {
			int[] s = new int[height * (width/8)];
			sprites.add(s);
			int index = 0;
			for(int y = 0; y < height; y++) {
				for(int x = 0; x < width; x++) {
					int solid = (((image.getRGB(x + (width*n), y) >> 24) & 0xFF) != 0) ? 1 : 0;
					s[index] = (s[index] << 1) | solid;
					if (x % 8 == 7) { index++; }
				}
			}
		}

		// generate masked sprites
		if (!raw) {
			List<int[]> masksprites = new ArrayList<>();
			masksprites.add(sprites.get(0));
			for(int n = 0; n < sprites.size(); n++) {
				int[] masked = new int[sprites.get(n).length];
				masksprites.add(masked);
				int[] prev = sprites.get((n+sprites.size()-1)%sprites.size());
				int[] here = sprites.get(n);
				for(int index = 0; index < masked.length; index++) {
					masked[index] = prev[index] ^ here[index];
				}
			}
			sprites = masksprites;
		}

		// format out sprite data
		if (!toimage) {
			for(int n = 0; n < sprites.size(); n++) {
				System.out.format(": %s-%d%n\t", basename, n);
				for(int index = 0; index < sprites.get(n).length; index++) {
					System.out.format((index % 8 == 7) ? "0x%02X%n\t" : "0x%02X ",
						sprites.get(n)[index]
					);
				}
				if (pad && (sprites.get(n).length%2 == 1)) {
					System.out.format("0x00");
				}
				System.out.println();
			}
		}

		// write out image data
		if (toimage) {
			BufferedImage out = new BufferedImage(
				sprites.size()*width,
				height,
				BufferedImage.TYPE_INT_ARGB
			);
			for(int n = 0; n < sprites.size(); n++) {
				int index = 0;
				int row = sprites.get(n)[index];
				for(int y = 0; y < height; y++) {
					for(int x = 0; x < width; x++) {
						int color = ((row & 0x80) != 0) ? 0xFF000000 : 0x00000000;
						row = row << 1;
						out.setRGB(x + (width*n), y, color);
						if (index+1 < sprites.get(n).length) {
							if (x % 8 == 7) { row = sprites.get(n)[++index]; }
						}
					}
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