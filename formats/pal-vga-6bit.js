/*
 * Raw VGA palette with 6-bit values [0..63].
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

const FORMAT_ID = 'pal-vga-6bit';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Palette from '../interface/palette.js';
import { pal6_to_8, pal8_to_6 } from '../util/palette-default.js';

export default class Palette_VGA_6bit extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'VGA palette (6-bit)',
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = 0,
		md.limits.maximumSize.y = 0,
		md.limits.depth = 8;
		md.limits.hasPalette = true;
		md.limits.paletteDepth = 6;
		md.limits.transparentIndex = null;
		md.limits.frameCount.min = 0;
		md.limits.frameCount.max = 0;

		return md;
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

		for (let i = 0; i < content.length; i++) {
			// Strictly this should be > 63, but some files use 64 by mistake and
			// the VGA treats 64 the same as 63.
			if (content[i] > 64) {
				return {
					valid: false,
					reason: `Colour ${i / 3} has value > 64, not 6-bit palette.`,
				};
			}
		}

		return {
			valid: true,
			reason: `Correct file size and starts with black.`,
		};
	}

	static read(content) {
		let palette = new Palette(256);

		for (let i = 0, p = 0; i < 256; i++) {
			palette[i] = [0, 0, 0, 255];
			// Convert 6-bit number to 8-bit, but map >=63 to 255.
			for (let j = 0; j < 3; j++) {
				const c = Math.min((content.main[p] || 0), 63);
				palette[i][j] = pal6_to_8(c);
				p++;
			}
		}

		return [
			new Image(
				{x: 0, y: 0},
				null,
				palette
			),
		];
	}

	static write(frames)
	{
		if (frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}
		const image = frames[0];

		const palette = image.palette;
		if (!palette) {
			throw new Error('Cannot write a palette file if the image has no palette!');
		}

		let warnings = [];
		let content = new Uint8Array(256 * 3);
		for (let i = 0; i < Math.min(palette.length, 256); i++) {
			for (let c = 0; c < 3; c++) {
				content[i * 3 + c] = pal8_to_6(palette[i][c]);
			}
			if (palette[i][3] != 255) {
				warnings.push(`Palette entry ${i} has an alpha value of `
					+ `${palette[i][3]}, but only a value of 255 is possible in this `
					+ `palette format.`);
			}
		}

		return {
			content: {
				main: content,
			},
			warnings,
		};
	}
}
