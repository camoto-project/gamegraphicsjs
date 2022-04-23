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

export class pal_vga_8bit extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'VGA palette (8-bit)',
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = 0,
		md.limits.maximumSize.y = 0,
		md.limits.depth = 8;
		md.limits.hasPalette = true;
		md.limits.paletteDepth = 8;
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

	static read(content) {
		const count = Math.min(256, (content.main.length / 3) >>> 0);

		let palette = new Palette(count);

		for (let i = 0, p = 0; i < count; i++) {
			palette[i] = [
				content.main[p++],
				content.main[p++],
				content.main[p++],
				255,
			];
		}

		return new Image({
			width: 0,
			height: 0,
			frames: [],
			palette,
		});
	}

	static write(image)
	{
		const palette = image.palette;
		if (!palette) {
			throw new Error('Cannot write a palette file if the image has no palette!');
		}

		let warnings = [];
		if (image.frames.length > 0) {
			warnings.push(`All frames have been discarded as this is a palette-only `
				+ `format.`);
		}

		const count = Math.min(palette.length, 256);
		let content = new Uint8Array(count * 3);
		for (let i = 0; i < count; i++) {
			for (let c = 0; c < 3; c++) {
				content[i * 3 + c] = palette[i][c];
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
