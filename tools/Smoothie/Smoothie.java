import java.util.*;
import java.io.*;
import java.awt.image.*;
import javax.imageio.*;

public class Smoothie {
	
	public static void main(String[] a) {
		// handle arguments
		List<String> args = new ArrayList<String>(Arrays.asList(a));
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

		// extract a palette.
		List<Integer> palette = new ArrayList<Integer>();
		{
			Set<Integer> colors = new TreeSet<Integer>();
			for(int x = 0; x < image.getWidth(); x++) {
				for(int y = 0; y < image.getHeight(); y++) {
					colors.add(image.getRGB(x, y));
				}
			}
			final int TRANSPARENT = 0x00FFFFFF;
			if (colors.contains(TRANSPARENT)) {
				colors.remove(TRANSPARENT);
				palette.add(TRANSPARENT);
			}
			final int BLACK = 0xFF000000;
			boolean foundBlack = false;
			if (colors.contains(BLACK)) {
				colors.remove(BLACK);
				foundBlack = true;
			}
			for(int c : colors) {
				palette.add(c);
			}
			if (foundBlack) {
				palette.add(BLACK);
			}
			for(int z = 0; z < palette.size(); z++) {
				System.out.format("# color %d: 0x%08X%n", z, palette.get(z));
			}
			if (palette.size() > 4) {
				System.err.format("This image uses %d colors, but only 4 can be represented!", palette.size());
				System.exit(1);
			}
		}

		List<HashSet<Integer>> planes = new ArrayList<HashSet<Integer>>();
		if (palette.size() > 2) {
			planes.add(new HashSet<Integer>(Arrays.asList(palette.get(1), palette.get(3))));
			planes.add(new HashSet<Integer>(Arrays.asList(palette.get(2), palette.get(3))));
		}
		else {
			planes.add(new HashSet<Integer>(Arrays.asList(palette.get(1))));
		}

		// split image data into sprites
		List<int[]> sprites = new ArrayList<int[]>();
		int height = Math.min(image.getHeight(), 16);
		int width  = (height == 16) ? 16 : 8;
		for(int n = 0; n < image.getWidth() / width; n++) {
			int[] s = new int[height * (width/8) * (palette.size() > 2 ? 2 : 1)];
			sprites.add(s);
			int index = 0;
			for(Set<Integer> plane : planes) {
				for(int y = 0; y < height; y++) {
					for(int x = 0; x < width; x++) {
						int color = image.getRGB(x + (width*n), y);
						int solid = plane.contains(color) ? 1 : 0;
						s[index] = (s[index] << 1) | solid;
						if (x % 8 == 7) { index++; }
					}
				}
			}
		}

		// generate masked sprites
		if (!raw) {
			List<int[]> masksprites = new ArrayList<int[]>();
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
				int[] sprite = sprites.get(n);
				for(int y = 0; y < height; y++) {
					for(int x = 0; x < width; x++) {
						int index = (width / 8) * y;
						int row1 = sprite[index];
						int row2 = (palette.size() > 2) ? sprite[index + sprite.length/2] : 0;
						int color = palette.get(
							(((row1 >> (7-x)) & 1) != 0 ? 1 : 0) +
							(((row2 >> (7-x)) & 1) != 0 ? 2 : 0)
						);
						out.setRGB(x + (width*n), y, color);
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