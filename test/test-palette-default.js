/*
 * Tests for palette-default.js.
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

import assert from 'assert';
import * as DP from '../util/palette-default.js';

const palComponent = ['red', 'green', 'blue', 'alpha'];

function palEquals(pal, index, target)
{
	for (let c = 0; c < 4; c++) {
		const actual = pal[index][c];
		const expected = target[c];
		assert.equal(
			actual,
			expected,
			`Palette entry ${index} component ${palComponent[c]} does not match `
				+ `(expected 0x${expected.toString(16)}, got `
				+ `0x${actual.toString(16)})`
		);
	}
}

describe(`defaultPalette tests`, function() {

	it('generates a monochrome palette correctly', function() {
		const pal = DP.paletteMono();

		palEquals(pal, 0, [0x00, 0x00, 0x00, 0xFF]);
		palEquals(pal, 1, [0xFF, 0xFF, 0xFF, 0xFF]);
	});

	it('generates a CGA 16-colour palette correctly', function() {
		const pal = DP.paletteCGA16();

		assert.equal(pal.length, 16, 'Palette is wrong length');

		palEquals(pal,  0, [0x00, 0x00, 0x00, 0xFF]);
		palEquals(pal,  1, [0x00, 0x00, 0xAA, 0xFF]);
		palEquals(pal,  2, [0x00, 0xAA, 0x00, 0xFF]);
		palEquals(pal,  3, [0x00, 0xAA, 0xAA, 0xFF]);
		palEquals(pal,  4, [0xAA, 0x00, 0x00, 0xFF]);
		palEquals(pal,  5, [0xAA, 0x00, 0xAA, 0xFF]);
		palEquals(pal,  6, [0xAA, 0x55, 0x00, 0xFF]);
		palEquals(pal,  7, [0xAA, 0xAA, 0xAA, 0xFF]);
		palEquals(pal,  8, [0x55, 0x55, 0x55, 0xFF]);
		palEquals(pal,  9, [0x55, 0x55, 0xFF, 0xFF]);
		palEquals(pal, 10, [0x55, 0xFF, 0x55, 0xFF]);
		palEquals(pal, 11, [0x55, 0xFF, 0xFF, 0xFF]);
		palEquals(pal, 12, [0xFF, 0x55, 0x55, 0xFF]);
		palEquals(pal, 13, [0xFF, 0x55, 0xFF, 0xFF]);
		palEquals(pal, 14, [0xFF, 0xFF, 0x55, 0xFF]);
		palEquals(pal, 15, [0xFF, 0xFF, 0xFF, 0xFF]);
	});

	it('generates an EGA 64-colour palette correctly', function() {
		const pal = DP.paletteEGA64();

		assert.equal(pal.length, 64, 'Palette is wrong length');

		palEquals(pal,  0, [0x00, 0x00, 0x00, 0xFF]);
		palEquals(pal,  1, [0x00, 0x00, 0xAA, 0xFF]);
		palEquals(pal,  6, [0xAA, 0xAA, 0x00, 0xFF]); // "wrong" CGA brown
		palEquals(pal, 20, [0xAA, 0x55, 0x00, 0xFF]); // "right" CGA brown
		palEquals(pal,  8, [0x00, 0x00, 0x55, 0xFF]);
		palEquals(pal, 58, [0x55, 0xFF, 0x55, 0xFF]);
		palEquals(pal, 62, [0xFF, 0xFF, 0x55, 0xFF]);
		palEquals(pal, 63, [0xFF, 0xFF, 0xFF, 0xFF]);
	});

	it('generates a VGA 256-colour palette correctly', function() {
		const pal = DP.paletteVGA256();

		assert.equal(pal.length, 256, 'Palette is wrong length');

		palEquals(pal,  0, [0x00, 0x00, 0x00, 0xFF]);
		palEquals(pal,  1, [0x00, 0x00, 0xAA, 0xFF]);
		palEquals(pal,  6, [0xAA, 0x55, 0x00, 0xFF]);
		palEquals(pal, 10, [0x55, 0xFF, 0x55, 0xFF]);
		palEquals(pal, 14, [0xFF, 0xFF, 0x55, 0xFF]);
		palEquals(pal, 15, [0xFF, 0xFF, 0xFF, 0xFF]);

		palEquals(pal, 16, [0x00, 0x00, 0x00, 0xFF]);
		palEquals(pal, 31, [0xFF, 0xFF, 0xFF, 0xFF]);

		palEquals(pal,  32, [0x00, 0x00, 0xFF, 0xFF]);
		palEquals(pal, 104, [0x00, 0x00, 0x71, 0xFF]);
		palEquals(pal, 176, [0x00, 0x00, 0x41, 0xFF]);
	});

	it('clones a palette correctly', function() {
		let palOrig = DP.paletteVGA256();
		let pal = palOrig.clone();

		// Change the original to confirm the copy doesn't get modified.
		palOrig[0] = [1, 2, 3, 4];
		palOrig[32] = [5, 6, 7, 8];

		assert.equal(pal.length, 256, 'Palette is wrong length');

		palEquals(pal,  0, [0x00, 0x00, 0x00, 0xFF]);
		palEquals(pal,  1, [0x00, 0x00, 0xAA, 0xFF]);
		palEquals(pal,  6, [0xAA, 0x55, 0x00, 0xFF]);
		palEquals(pal, 10, [0x55, 0xFF, 0x55, 0xFF]);
		palEquals(pal, 14, [0xFF, 0xFF, 0x55, 0xFF]);
		palEquals(pal, 15, [0xFF, 0xFF, 0xFF, 0xFF]);

		palEquals(pal, 16, [0x00, 0x00, 0x00, 0xFF]);
		palEquals(pal, 31, [0xFF, 0xFF, 0xFF, 0xFF]);

		palEquals(pal,  32, [0x00, 0x00, 0xFF, 0xFF]);
		palEquals(pal, 104, [0x00, 0x00, 0x71, 0xFF]);
		palEquals(pal, 176, [0x00, 0x00, 0x41, 0xFF]);
	});
});
