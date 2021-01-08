/*
 * Raw VGA palette with 8-bit values [0..255].
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

const FORMAT_ID = 'pal-vga-8bit';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Palette from '../interface/palette.js';

export default class Palette_VGA_8bit extends ImageHandler
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'VGA palette (8-bit)',
			games: [
				'TODO',
			],
			limits: {
				minimumSize: {x: 0, y: 0},
				maximumSize: {x: 0, y: 0},
				depth: 8,
				hasPalette: true,
				paletteDepth: 8,
				transparentIndex: null,
			},
		};
	}

	static identify(content) {
		if (content.length !== 768) {
			return {
				valid: false,
				reason: `File length ${content.length} is not 768.`,
			};
		}

		if (
			(content[0] != 0x00)
				|| (content[1] != 0x00)
				|| (content[2] != 0x00)
		) {
			return {
				valid: false,
				reason: `First colour isn't black.`,
			};
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
			return {
				valid: false,
				reason: `No colour values are > 64, unlikely to be an 8-bit palette.`,
			};
		}

		return {
			valid: true,
			reason: `Correct file size and starts with black.`,
		};
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
			content[i * 3 + 0] = palette[i][0];
			content[i * 3 + 1] = palette[i][1];
			content[i * 3 + 2] = palette[i][2];
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
}
