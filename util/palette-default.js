/*
 * Construct default CGA, EGA and VGA palettes.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import Palette from '../interface/palette.js';

// Take 2-bit pattern "ab" and convert to 8-bit pattern "abababab".
// 0 -> 0x00, 1 -> 0x55, 2 -> 0xAA, 3 -> 0xFF.
const pal2_to_8 = n => n | (n << 2) | (n << 4) | (n << 6);

// Take 6-bit number and expand to 8-bit.
// 0 -> 0x00, 0x3F -> 0xFF.
const pal6_to_8 = n => (n << 2) | (n >> 4);

export const CGAPaletteType = {
	GreenRed:          0x00,
	GreenRedBright:    0x80,
	CyanMagenta:       0x10,
	CyanMagentaBright: 0x90,
	CyanRed:           0x20,
	CyanRedBright:     0xA0,
};

/**
 * Create a new palette with default hardware colours depending on the given
 * colour depth.
 */
export function defaultPalette(depth)
{
	switch (depth) {
		case 1:
			return paletteMono();
		case 2:
			return paletteCGA4(CGAPaletteType.GreenRed, 0);
		case 4:
			return paletteCGA16();
		case 6:
			return paletteEGA64();
		case 8:
			return paletteVGA256();
		default:
			throw new Error(`Unimplemented colour depth ${depth} for default palette.`);
	}
}

/**
 * Create a monochrome palette with black and white only.
 *
 * @return {Palette} with 2 entries.
 */
export function paletteMono()
{
	return new Palette(
		[0x00, 0x00, 0x00, 0xFF],
		[0xFF, 0xFF, 0xFF, 0xFF],
	);
}

// These colour codes from the full palette are used in the 4-colour mode.
const cgaVariants = {
	[CGAPaletteType.GreenRed]:          [0,  2,  4,  6],
	[CGAPaletteType.GreenRedBright]:    [0, 10, 12, 14],
	[CGAPaletteType.CyanMagenta]:       [0,  3,  5,  7],
	[CGAPaletteType.CyanMagentaBright]: [0, 11, 13, 15],
	[CGAPaletteType.CyanRed]:           [0,  3,  4,  7],
	[CGAPaletteType.CyanRedBright]:     [0, 11, 12, 15],
};

/**
 * Create a CGA 4-colour graphics mode palette.
 *
 * @param {CGAPaletteType} variant
 *   Which CGA palette type to use.
 *
 * @param {Number} background
 *   Background color as standard 16-colour value (1=blue, 5=magenta, etc.)
 *
 * @return {Palette} with 4 entries.
 */
export function paletteCGA4(variant, background)
{
	let cga = cgaVariants[variant];
	const full = paletteCGA16();

	return new Palette(
		full[background ?? 0],
		full[cga[1]],
		full[cga[2]],
		full[cga[3]],
	);
}

/**
 * Create a CGA 16-colour text mode palette, also used as default palette for
 * all EGA colour modes.
 *
 * @return {Palette} with 16 entries.
 */
export function paletteCGA16()
{
	let pal = new Palette(16);

	for (let i = 0; i < 16; i++) {
		// 4 (100) -> 55:01 01 01 01, AA:10 10 10 10
		const int = (i & 8) >> 3; // on=0b1, off=0
		pal[i] = [
			pal2_to_8(int | ((i & 4) >> 1)),
			pal2_to_8(int | ((i & 2) << 0)),
			pal2_to_8(int | ((i & 1) << 1)),
			0xFF, // no transparency
		];
		if (i == 6) {
			// Adjust for brown.
			pal[i][1] = 0x55;
		}
	}

	return pal;
}

/**
 * Create an EGA 64-colour palette.
 *
 * No EGA modes could show all these colours at the same time, but the 16-colour
 * modes could show 16 of these entries at once.
 *
 * @return {Palette} with 64 entries.
 */
export function paletteEGA64()
{
	let pal = new Palette(16);

	for (let i = 0; i < 64; i++) {
		pal[i] = [
			pal2_to_8(((i & 0x20) >> 5) | ((i & 0x04) >> 1)),
			pal2_to_8(((i & 0x10) >> 4) | ((i & 0x02) << 0)),
			pal2_to_8(((i & 0x08) >> 3) | ((i & 0x01) << 1)),
			0xFF, // no transparency
		];
	}

	return pal;
}

/**
 * Create a VGA 256-colour palette.
 *
 * Almost all games changed the palette but for those that didn't, this is the
 * default palette for VGA 256-colour modes.
 *
 * @return {Palette} with 256 entries.
 */
export function paletteVGA256()
{
	let pal = new Palette(256);
	let cga16 = paletteCGA16();
	for (let i = 0; i < cga16.length; i++) {
		pal[i] = cga16[i];
	}

	// Greyscale
	pal[16] = [0x00, 0x00, 0x00, 0xFF];
	pal[17] = [0x05, 0x05, 0x05, 0xFF];
	pal[18] = [0x08, 0x08, 0x08, 0xFF];
	pal[19] = [0x0B, 0x0B, 0x0B, 0xFF];
	pal[20] = [0x0E, 0x0E, 0x0E, 0xFF];
	pal[21] = [0x11, 0x11, 0x11, 0xFF];
	pal[22] = [0x14, 0x14, 0x14, 0xFF];
	pal[23] = [0x18, 0x18, 0x18, 0xFF];
	pal[24] = [0x1C, 0x1C, 0x1C, 0xFF];
	pal[25] = [0x20, 0x20, 0x20, 0xFF];
	pal[26] = [0x24, 0x24, 0x24, 0xFF];
	pal[27] = [0x28, 0x28, 0x28, 0xFF];
	pal[28] = [0x2D, 0x2D, 0x2D, 0xFF];
	pal[29] = [0x32, 0x32, 0x32, 0xFF];
	pal[30] = [0x38, 0x38, 0x38, 0xFF];
	pal[31] = [0x3F, 0x3F, 0x3F, 0xFF];

	// Next lot of 72 colours is repeated three times at different intensities
	// Doesn't seem to be any way to calculate these either
	const block = [
		// 32, 104, 176
		[0x00, 0x00, 0x3F],
		[0x10, 0x00, 0x3F],
		[0x1F, 0x00, 0x3F],
		[0x2F, 0x00, 0x3F],
		[0x3F, 0x00, 0x3F],
		[0x3F, 0x00, 0x2F],
		[0x3F, 0x00, 0x1F],
		[0x3F, 0x00, 0x10],
		[0x3F, 0x00, 0x00],
		[0x3F, 0x10, 0x00],
		[0x3F, 0x1F, 0x00],
		[0x3F, 0x2F, 0x00],
		[0x3F, 0x3F, 0x00],
		[0x2F, 0x3F, 0x00],
		[0x1F, 0x3F, 0x00],
		[0x10, 0x3F, 0x00],
		// 48 120 192
		[0x00, 0x3F, 0x00],
		[0x00, 0x3F, 0x10],
		[0x00, 0x3F, 0x1F],
		[0x00, 0x3F, 0x2F],
		[0x00, 0x3F, 0x3F],
		[0x00, 0x2F, 0x3F],
		[0x00, 0x1F, 0x3F],
		[0x00, 0x10, 0x3F],
		[0x1F, 0x1F, 0x3F],
		[0x27, 0x1F, 0x3F],
		[0x2F, 0x1F, 0x3F],
		[0x37, 0x1F, 0x3F],
		[0x3F, 0x1F, 0x3F],
		[0x3F, 0x1F, 0x37],
		[0x3F, 0x1F, 0x2F],
		[0x3F, 0x1F, 0x27],
		// 64 136 208
		[0x3F, 0x1F, 0x1F],
		[0x3F, 0x27, 0x1F],
		[0x3F, 0x2F, 0x1F],
		[0x3F, 0x37, 0x1F],
		[0x3F, 0x3F, 0x1F],
		[0x37, 0x3F, 0x1F],
		[0x2F, 0x3F, 0x1F],
		[0x27, 0x3F, 0x1F],
		[0x1F, 0x3F, 0x1F],
		[0x1F, 0x3F, 0x27],
		[0x1F, 0x3F, 0x2F],
		[0x1F, 0x3F, 0x37],
		[0x1F, 0x3F, 0x3F],
		[0x1F, 0x37, 0x3F],
		[0x1F, 0x2F, 0x3F],
		[0x1F, 0x27, 0x3F],
		// 80 152 224
		[0x2D, 0x2D, 0x3F],
		[0x31, 0x2D, 0x3F],
		[0x36, 0x2D, 0x3F],
		[0x3A, 0x2D, 0x3F],
		[0x3F, 0x2D, 0x3F],
		[0x3F, 0x2D, 0x3A],
		[0x3F, 0x2D, 0x36],
		[0x3F, 0x2D, 0x31],
		[0x3F, 0x2D, 0x2D],
		[0x3F, 0x31, 0x2D],
		[0x3F, 0x36, 0x2D],
		[0x3F, 0x3A, 0x2D],
		[0x3F, 0x3F, 0x2D],
		[0x3A, 0x3F, 0x2D],
		[0x36, 0x3F, 0x2D],
		[0x31, 0x3F, 0x2D],
		// 96 168 240
		[0x2D, 0x3F, 0x2D],
		[0x2D, 0x3F, 0x31],
		[0x2D, 0x3F, 0x36],
		[0x2D, 0x3F, 0x3A],
		[0x2D, 0x3F, 0x3F],
		[0x2D, 0x3A, 0x3F],
		[0x2D, 0x36, 0x3F],
		[0x2D, 0x31, 0x3F],
	];

	const multipliers = [
		1.0,   // normal
		0.453, // dim
		0.259, // really dim
	];
	let palIndex = 32;
	for (const multiplier of multipliers) {
		for (let base = 0; base < 72; base++) {
			pal[palIndex++] = [
				(block[base][0] * multiplier) >>> 0,
				(block[base][1] * multiplier) >>> 0,
				(block[base][2] * multiplier) >>> 0,
				0xFF, // no transparency
			];
		}
	}

	// Expand the above 6-bit values to 8-bit.
	for (let i = 16; i < 248; i++) {
		for (let c = 0; c < 3; c++) {
			pal[i][c] = pal6_to_8(pal[i][c]);
		}
	}

	// Final entries are undefined, we'll use black as that seems common.
	while (palIndex < 256) {
		pal[palIndex++] = [0, 0, 0, 0xFF];
	}

	return pal;
}
