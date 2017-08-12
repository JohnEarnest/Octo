////////////////////////////////////
//
//   Doct
//
//   A lightweight, portable native
//   runtime for programs developed
//   with Octo.
//
////////////////////////////////////

#include <cstdint>      // uint8_t, uint16_t
#include <stdio.h>      // printf()
#include <cstring>      // memcpy(), memset()
#include <stdlib.h>     // abs(), rand()
#include <SDL2/SDL.h>
#include "rom.h"

#define QUIRKS_SHIFT  false
#define QUIRKS_MEMORY false
#define QUIRKS_ORDER  false
#define QUIRKS_JUMP   false
#define QUIRKS_CLIP   false

#define FULLSCREEN      true
#define WINDOW_TITLE    "Doct 0.0"
#define SCREEN_SCALE      3
#define CYCLES_PER_FRAME 30

static const uint32_t palette[] = {
	0xFF996600, // background
	0xFFFFCC00, // plane 1
	0xFFFF6600, // plane 2
	0xFF662200  // blended
};

////////////////////////////////////
//
//   Preamble
//
////////////////////////////////////

#define vx v[x & 0xF]
#define vy v[y & 0xF]

#define GRAPHICS_PLANES 2
#define layered(x)         for(uint8_t layer=1; layer<=GRAPHICS_PLANES; layer*=2){ if (gp & layer) { x } }
#define clipped()          if (QUIRKS_CLIP) { if ((x % rowSize) + b >= rowSize || (y % colSize) + a >= colSize) { continue; }}
#define setl(d,c,v)        p[d] = (p[d]&~layer) | (c ? (p[v]&layer) : 0);

void writeCarry(const uint8_t dest, const uint8_t value, const bool flag);
void math(const uint8_t x, const uint8_t y, const uint8_t op);
void misc(const uint8_t x, const uint8_t rest);
void call(const uint16_t a);
void ret();
void jump0(const uint16_t a);
void toggle(const bool source, const uint16_t target, const uint8_t layer);
void sprite(const uint8_t x, const uint8_t y, const uint8_t len);
void tick();
void keyevent(SDL_Event e);

////////////////////////////////////
//
//   Static Data
//
////////////////////////////////////

static const uint8_t font[] = {
	0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
	0x20, 0x60, 0x20, 0x20, 0x70, // 1
	0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
	0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
	0x90, 0x90, 0xF0, 0x10, 0x10, // 4
	0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
	0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
	0xF0, 0x10, 0x20, 0x40, 0x40, // 7
	0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
	0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
	0xF0, 0x90, 0xF0, 0x90, 0x90, // A
	0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
	0xF0, 0x80, 0x80, 0x80, 0xF0, // C
	0xE0, 0x90, 0x90, 0x90, 0xE0, // D
	0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
	0xF0, 0x80, 0xF0, 0x80, 0x80  // F
};

static const uint8_t bigfont[] = {
	0xFF, 0xFF, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, // 0
	0x18, 0x78, 0x78, 0x18, 0x18, 0x18, 0x18, 0x18, 0xFF, 0xFF, // 1
	0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, // 2
	0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 3
	0xC3, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, 0x03, 0x03, 0x03, 0x03, // 4
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 5
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, // 6
	0xFF, 0xFF, 0x03, 0x03, 0x06, 0x0C, 0x18, 0x18, 0x18, 0x18, // 7
	0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, // 8
	0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 9
	0x7E, 0xFF, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, 0xC3, 0xC3, 0xC3, // A
	0xFC, 0xFC, 0xC3, 0xC3, 0xFC, 0xFC, 0xC3, 0xC3, 0xFC, 0xFC, // B
	0x3C, 0xFF, 0xC3, 0xC0, 0xC0, 0xC0, 0xC0, 0xC3, 0xFF, 0x3C, // C
	0xFC, 0xFE, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xFE, 0xFC, // D
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, // E
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC0, 0xC0, 0xC0, 0xC0  // F
};

////////////////////////////////////
//
//   State
//
////////////////////////////////////

static uint8_t  p  [64 * 128];  // pixels
static uint8_t  m  [64 * 1024]; // memory
static uint8_t  v  [16];        // registers
static uint8_t  f  [ 8];        // flag registers
static uint16_t r  [16];        // return stack
static uint8_t  ap [16];        // audio pattern
static bool     k  [16];        // keys

static uint16_t i  =     0; // index register
static uint16_t pc = 0x200; // program counter
static uint8_t  rp =     0; // return stack pointer
static uint8_t  dt =     0; // delay timer
static uint8_t  st =     0; // sound timer
static uint8_t  gp =     1; // graphics plane
static bool     h  = false; // superchip hi res mode?

static bool running = true;
static bool waiting = false;
static bool waitReg = 0;

////////////////////////////////////
//
//   Interpreter
//
////////////////////////////////////

void writeCarry(const uint8_t x, const uint8_t value, const bool flag) {
	if (QUIRKS_ORDER) {
		v[0xF] = flag;
		vx     = value;
	}
	else {
		vx     = value;
		v[0xF] = flag;
	}
}

void math(const uint8_t x, const uint8_t y, const uint8_t op) {
	switch(op) {
		case 0x0: { vx  = vy; break; }
		case 0x1: { vx |= vy; break; }
		case 0x2: { vx &= vy; break; }
		case 0x3: { vx ^= vy; break; }
		case 0x4: {
			const int16_t t = vx + vy;
			writeCarry(x, static_cast<uint8_t>(t), t > 0xFF);
			break;
		}
		case 0x5: {
			writeCarry(x, vx - vy, vx >= vy);
			break;
		}
		case 0x7: {
			writeCarry(x, vy - vx, vy >= vx);
			break;
		}
		case 0x6: {
			const uint8_t z = QUIRKS_SHIFT ? vx : vy;
			writeCarry(x, z >> 1, z & 1);
			break;
		}
		case 0xE: {
			const uint8_t z = QUIRKS_SHIFT ? vx : vy;
			writeCarry(x, static_cast<uint8_t>(z << 1), (z >> 7) & 1);
			break;
		}
		default: {
			printf("unknown math opcode %X\n", op);
			running = false;
		}
	}
}

void misc(const uint8_t x, const uint8_t rest) {
	switch(rest) {
		case 0x01: { gp = x & 0x3;                       break; }
		case 0x02: { memcpy(ap, m+i, sizeof(ap));        break; }
		case 0x07: { vx = dt;                            break; }
		case 0x0A: { waiting = true; waitReg = x;        break; }
		case 0x15: { dt = vx;                            break; }
		case 0x18: { st = vx;                            break; }
		case 0x1E: { i = i + vx;                         break; }
		case 0x29: { i = (vx & 0xF) * 5;                 break; }
		case 0x30: { i = (vx & 0xF) * 10 + sizeof(font); break; }
		case 0x33: {
			m[i]   = (vx/100)%10;
			m[i+1] = (vx/10)%10;
			m[i+2] = vx%10;
			break;
		}
		case 0x55: {
			for(uint8_t z = 0; z <= x; z++) { m[i + z] = v[z]; }
			if (!QUIRKS_MEMORY) { i += x + 1; }
			break;
		}
		case 0x65: {
			for(uint8_t z = 0; z <= x; z++) { v[z] = m[i + z]; }
			if (!QUIRKS_MEMORY) { i += x + 1; }
			break;
		}
		case 0x75: { memcpy(f, v, x); break; }
		case 0x85: { memcpy(v, f, x); break; }
		default: {
			printf("unknown misc opcode %X\n", rest);
			running = false;
		}
	}
}

void call(const uint16_t a) {
	if (rp >= sizeof(r)) {
		printf("call stack overflow.\n");
		running = false;
	}
	r[rp++] = pc;
	pc = a;
}

void ret() {
	if (rp < 1) {
		printf("call stack underflow.\n");
		running = false;
	}
	pc = r[--rp];
}

void jump0(const uint16_t a) {
	pc = a + v[QUIRKS_JUMP ? (a>>8)*0xF : 0];
}

void toggle(const bool source, const uint16_t target, const uint8_t layer) {
	if (!source) { return; }
	v[0xF] |= (p[target] & layer) != 0;
	p[target] ^= layer;
}

void sprite(const uint8_t x, const uint8_t y, const uint8_t len) {
	v[0xF] = 0;
	const uint8_t rowSize = h ? 128 : 64;
	const uint8_t colSize = h ?  64 : 32;
	uint16_t ic = i;

	layered({
		if (len == 0) {
			// draw a SuperChip 16x16 sprite
			for(uint a = 0; a < 16; a++) {
				for(uint b = 0; b < 16; b++) {
					const uint16_t target = ((x+b) % rowSize) + ((y+a) % colSize) * rowSize;
					const bool source = (m[ic + (a * 2) + (b > 7)] >> (7 - (b % 8))) & 1;
					clipped();
					toggle(source, target, layer);
				}
			}
			ic += 32;
		}
		else {
			// draw a Chip8 8xN sprite
			for(uint a = 0; a < len; a++) {
				for(uint b = 0; b < 8; b++) {
					const uint16_t target = ((x+b) % rowSize) + ((y+a) % colSize) * rowSize;
					const bool source = (m[ic + a] >> (7 - b)) & 1;
					clipped();
					toggle(source, target, layer);
				}
			}
			ic += len;
		}
	});
}

void tick() {
	// decode fields
	const uint16_t op  = static_cast<uint16_t>(m[pc] << 8) | m[pc + 1];
	const uint8_t  o   = (op >> 12) & 0xF;
	const uint8_t  x   = (op >>  8) & 0xF;
	const uint8_t  y   = (op >>  4) & 0xF;
	const uint8_t  n   = op & 0xF;
	const uint8_t  nn  = op & 0xFF;
	const uint16_t nnn = op & 0xFFF;
	const uint8_t rowSize = h ? 128 : 64;
	pc += 2;

	// simple opcodes
	if (op == 0x0000)            { running = false;                 } // halt
	if (op == 0x00E0)            { memset(p, 0, sizeof(p)); return; } // clear
	if (op == 0x00EE)            { ret();                   return; } // return
	if ((op & 0xF0FF) == 0xE09E) { pc += 2 *  k[vx & 0xF];  return; } // if -key
	if ((op & 0xF0FF) == 0xE0A1) { pc += 2 * !k[vx & 0xF];  return; } // if key
	if (op == 0x00FD)            { running = false;                 } // exit 
	if (op == 0x00FE) { h = false; memset(p, 0, sizeof(p)); return; } // lores
	if (op == 0x00FF) { h = true;  memset(p, 0, sizeof(p)); return; } // hires
	if (op == 0xF000) {
		// long memory reference
		i = static_cast<uint16_t>(m[pc] << 8) | m[pc + 1];
		pc += 2;
		return;
	}

	// scrolling
	if ((op & 0xFFF0) == 0x00C0) {
		// scroll down n pixels
		layered({
			uint8_t rows = rowSize * n;
			for(uint16_t z = sizeof(p); z >= 0; z--) {
				setl(z, z >= rows, z - rows);
			}
		});
		return;
	}
	if ((op & 0xFFF0) == 0x00D0) {
		// scroll up n pixels
		layered({
			uint8_t rows = rowSize * n;
			for(uint16_t z = 0; z < sizeof(p); z++) {
				setl(z, z < sizeof(p) - rows, z + rows);
			}
		});
		return;
	}
	if (op == 0x00FB) {
		// scroll right 4 pixels
		layered({
			for(uint16_t a = 0; a < sizeof(p); a += rowSize) {
				for(uint16_t b = rowSize-1; b >= 0; b--) {
					setl(a + b, b > 3, a + b - 4);
				}
			}
		});
		return;
	}
	if (op == 0x00FC) {
		// scroll left 4 pixels
		layered({
			for(uint16_t a = 0; a < sizeof(p); a += rowSize) {
				for(uint16_t b = 0; b < rowSize; b++) {
					setl(a + b, b < rowSize - 4, a + b + 4);
				}
			}
		});
		return;
	}

	// extended memory
	if (o == 0x5 && n != 0) {
		const uint8_t dist = static_cast<uint8_t>(abs(x - y));
		if (n == 2) {
			// save range
			if (x < y) { for(uint8_t z = 0; z <= dist; z++) { m[i + z] = v[x + z]; }}
			else       { for(uint8_t z = 0; z <= dist; z++) { m[i + z] = v[x - z]; }}
			return;
		}
		else if (n == 3) {
			// load range
			if (x < y) { for(uint8_t z = 0; z <= dist; z++) { v[x + z] = m[i + z]; }}
			else       { for(uint8_t z = 0; z <= dist; z++) { v[x - z] = m[i + z]; }}
			return;
		}
		else {
			printf("unknown opcode %X\n", op);
		}
	}
	if (o == 0x9 && n != 0) {
		printf("unknown opcode %X\n", op);
	}

	// basic opcode templates
	switch(o) {
		case 0x1: pc = nnn;                  break;
		case 0x2: call(nnn);                 break;
		case 0x3: if (vx == nn) { pc += 2; } break;
		case 0x4: if (vx != nn) { pc += 2; } break;
		case 0x5: if (vx == vy) { pc += 2; } break;
		case 0x6: vx = nn;                   break;
		case 0x7: vx += nn;                  break;
		case 0x8: math(x, y, n);             break;
		case 0x9: if (vx != vy) { pc += 2; } break;
		case 0xA: i = nnn;                   break;
		case 0xB: jump0(nnn);                break;
		case 0xC: vx = rand() & nn;          break;
		case 0xD: sprite(vx, vy, n);         break;
		case 0xF: misc(x, nn);               break;
		default: printf("unknown opcode %X\n", o);
	}
}

////////////////////////////////////
//
//   Main Program
//
////////////////////////////////////

void keyevent(SDL_Event event) {
	uint8_t val = 0;
	switch(event.key.keysym.sym) {
		case SDLK_ESCAPE: running = false; break;

		// Chip8 Key   Keyboard
		// ---------   ---------
		// 1 2 3 C     1 2 3 4
		// 4 5 6 D     q w e r
		// 7 8 9 E     a s d f
		// A 0 B F     z x c v

		#define key(c,v) case c: k[v] = event.type == SDL_KEYDOWN; val = v; break;
		key(SDLK_x, 0x0);
		key(SDLK_1, 0x1);
		key(SDLK_2, 0x2);
		key(SDLK_3, 0x3);
		key(SDLK_q, 0x4);
		key(SDLK_w, 0x5);
		key(SDLK_e, 0x6);
		key(SDLK_a, 0x7);
		key(SDLK_s, 0x8);
		key(SDLK_d, 0x9);
		key(SDLK_z, 0xA);
		key(SDLK_c, 0xB);
		key(SDLK_4, 0xC);
		key(SDLK_r, 0xD);
		key(SDLK_f, 0xE);
		key(SDLK_v, 0xF);
	}
	if (waiting && event.type == SDL_KEYDOWN) {
		v[waitReg] = val;
		waiting = false;
	}
}

int main(int, char**) {

	// TODO: serialize/load flag registers?
	// TODO: play audio?

	// emulator initialization
	memcpy(m,                font,    sizeof(font));
	memcpy(m + sizeof(font), bigfont, sizeof(bigfont));
	memcpy(m + 0x200,        rom,     sizeof(rom));

	// SDL initialization
	SDL_Init(SDL_INIT_VIDEO);
	SDL_SetHint(SDL_HINT_RENDER_SCALE_QUALITY, 0); // nearest-neighbor upscaling

	SDL_Window *window = SDL_CreateWindow(
		WINDOW_TITLE,
		SDL_WINDOWPOS_UNDEFINED,
		SDL_WINDOWPOS_UNDEFINED,
		128 * SCREEN_SCALE,
		64 * SCREEN_SCALE,
		FULLSCREEN ? SDL_WINDOW_FULLSCREEN_DESKTOP : SDL_WINDOW_SHOWN
	);
	SDL_Renderer *renderer = SDL_CreateRenderer(
		window,
		-1, // first driver available
		SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC
	);
	SDL_Texture *texture = SDL_CreateTexture(
		renderer,
		SDL_PIXELFORMAT_BGRA32,
		SDL_TEXTUREACCESS_STREAMING,
		128,
		64
	);

	uint32_t *pixels = static_cast<uint32_t*>(malloc(128 * 64 * sizeof(uint32_t)));
	int pitch = 0; // why the h*ck should I need to pass this in by ref?

	// main loop
	while (running) {
		// process input events
		SDL_Event event;
		while (SDL_PollEvent(&event)) {
			if (event.type == SDL_QUIT) {
				running = false;
			}
			if (event.type == SDL_KEYDOWN || event.type == SDL_KEYUP) {
				keyevent(event);
			}
		}

		// run emulator
		for(uint32_t x = 0; x < CYCLES_PER_FRAME; x++) {
			if ((!running) || waiting) { break; }
			tick();
		}
		if (!waiting) {
			if (dt > 0) { dt--; }
			if (st > 0) { st--; }
		}

		// update framebuffer
		SDL_UnlockTexture(texture);
		if (h) {
			for (uint16_t x = 0; x < 128 * 64; x++) {
				pixels[x] = palette[p[x]];
			}
		}
		else {
			for (uint16_t x = 0; x < 64 * 32; x++) {
				const uint16_t t = (2 * x) + ((x / 64) * 128);
				const uint32_t c = palette[p[x]];
				pixels[t      ] = c;
				pixels[t +   1] = c;
				pixels[t + 128] = c;
				pixels[t + 129] = c;
			}
		}
		SDL_LockTexture(texture, NULL, reinterpret_cast<void**>(&pixels), &pitch);

		// flush the framebuffer
		SDL_RenderClear(renderer);
		SDL_RenderCopy(renderer, texture, NULL, NULL);
		SDL_RenderPresent(renderer);
	}

	SDL_DestroyRenderer(renderer);
	SDL_DestroyWindow(window);
	SDL_Quit();
	return 0;
}
