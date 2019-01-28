/**
 * @file Raw VGA palette with 8-bit values [0..255].
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
const ImageHandler = require('../images/imageHandler.js');
const Palette = require('./palette.js');

const FORMAT_ID = 'pal-vga-8bit';

module.exports = class Palette_VGA_8bit extends ImageHandler
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'VGA palette (8-bit)',
			games: [
				'TODO',
			],
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

			let is8bit = false;
			for (let i = 0; i < content.length; i++) {
				// Strictly this should be > 63, but some files use 64 by mistake and
				// the VGA treats 64 the same as 63.
				if (content[i] > 64) {
					is8bit = true;
					break;
				}
			}

			if (!is8bit) {
				Debug.log(`No colour values are > 64, unlikely to be an 8-bit palette`);
				return false;
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
			palette[i] = [
				content.main[p++],
				content.main[p++],
				content.main[p++],
				255,
			];
		};

		return palette;
	}

	static write(palette)
	{
		let content = new Uint8Array(256 * 3);
		for (let i = 0; i < 256; i++) {
			content[i * 3 + 0] = palette[i][0];
			content[i * 3 + 1] = palette[i][1];
			content[i * 3 + 2] = palette[i][2];
		}

		return {
			main: content,
		};
	}
};
