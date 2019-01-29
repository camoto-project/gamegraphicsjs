/**
 * @file Raw VGA palette with 6-bit values [0..63].
 *
 * Copyright (C) 2018-2019 Adam Nielsen <malvineous@shikadi.net>
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

const Debug = require('../util/utl-debug.js');
const Image = require('../images/image.js');
const ImageHandler = require('../images/imageHandler.js');
const Palette = require('./palette.js');

const FORMAT_ID = 'pal-vga-6bit';

module.exports = class Palette_VGA_6bit extends ImageHandler
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'VGA palette (6-bit)',
			games: [
				'TODO',
			],
			limits: {
				minimumSize: {x: 0, y: 0},
				maximumSize: {x: 0, y: 0},
				depth: 8,
				hasPalette: true,
				paletteDepth: 6,
				transparentIndex: null,
			},
		};
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			if (content.length !== 768) {
				Debug.log(`File length ${content.length} is not 768 => false`);
				return false;
			}

			if (
				(content[0] != 0x00)
				|| (content[1] != 0x00)
				|| (content[2] != 0x00)
			) {
				Debug.log(`First colour isn't black => false`);
				return false;
			}

			for (let i = 0; i < content.length; i++) {
				// Strictly this should be > 63, but some files use 64 by mistake and
				// the VGA treats 64 the same as 63.
				if (content[i] > 64) {
					Debug.log(`Colour ${i / 3} has value > 64, not 6-bit palette`);
					return false;
				}
			}

			Debug.log(`Correct file size and starts with black => true`);
			return true;

		} finally {
			Debug.pop();
		}
	}

	static read(content, options) {
		let palette = new Palette(256);

		for (let i = 0, p = 0; i < 256; i++) {
			palette[i] = [0, 0, 0, 255];
			// Convert 6-bit number to 8-bit, but map >=63 to 255.
			for (let j = 0; j < 3; j++) {
				const c = Math.min((content.main[p] || 0), 63);
				palette[i][j] = (c << 2) | (c >> 4);
				p++;
			}
		};

		return new Image(
			{x: 0, y: 0},
			null,
			palette
		);
	}

	/**
	 * Options:
	 *   ignoreAlpha: if true, don't complain about alpha values that are != 255.
	 */
	static write(image, options = {})
	{
		const palette = image.palette;
		if (!palette) {
			throw new Error('Cannot write a palette file if the image has no palette!');
		}

		let content = new Uint8Array(256 * 3);
		for (let i = 0; i < 256; i++) {
			content[i * 3 + 0] = palette[i][0] >> 2;
			content[i * 3 + 1] = palette[i][1] >> 2;
			content[i * 3 + 2] = palette[i][2] >> 2;
			if ((options.ignoreAlpha !== true) && (palette[i][3] != 255)) {
				throw new Error(`Palette entry ${i} has an alpha value of `
					+ `${palette[i][3]}, but only a value of 255 is possible in this `
					+ `palette format.`);
			}
		}

		return {
			main: content,
		};
	}
};
