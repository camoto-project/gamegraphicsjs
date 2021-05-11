/*
 * Papyrus VGA palette (6-bit values [0..63] and three-byte header).
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 * Copyright (C) 2021      Colin Bourassa
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

const FORMAT_ID = 'pal-vga-6bit-papyrus';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Palette from '../interface/palette.js';
import {
	pal6_to_8,
	pal8_to_6
} from '../util/palette-default.js';

export default class Palette_VGA_6bit_Papyrus extends ImageHandler {
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Papyrus VGA palette (6-bit)',
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = 0;
		md.limits.maximumSize.y = 0;
		md.limits.depth = 8;
		md.limits.hasPalette = true;
		md.limits.paletteDepth = 6;
		md.limits.transparentIndex = null;
		md.limits.frameCount.min = 0;
		md.limits.frameCount.max = 0;

		return md;
	}

	static identify(content) {
		if (content.length < 6) {
			return {
				valid: false,
				reason: `File length ${content.length} is smaller than minimum for this type (6).`,
			};
		}

		if (content[0] !== 0x00) {
			return {
				valid: false,
				reason: `First byte is nonzero.`,
			};
		}

		// Header uses the special value of 00h to indicate
		// a palette size of 256 colors
		const numEntries = (content[2] == 0) ? 256 : content[2];
		const expectedLength = (numEntries * 3) + 3;

		if (content.length !== expectedLength) {
			return {
				valid: false,
				reason: `File length ${content.length} does not match expected length of ${expectedLength} for ${numEntries} colours.`,
			};
		}

		// Colour count and starting index must describe an
		// overlay that fits within the 256 color VGA space
		if (content[1] + numEntries > 256) {
			return {
				valid: false,
				reason: `Colour count ${numEntries} and starting index of ${content[1]} overruns VGA palette size.`,
			};
		}

		for (let i = 3; i < content.length; i++) {
			// Strictly this should be > 63, but some files use 64 by mistake and
			// the VGA treats 64 the same as 63.
			if (content[i] > 64) {
				return {
					valid: false,
					reason: `Colour ${Math.trunc((i - 3) / 3)} has value > 64, not 6-bit palette.`,
				};
			}
		}

		return {
			valid: true,
			reason: `Valid file size, start byte, and colour indexing.`,
		};
	}

	static read(content) {
		let palette = new Palette(256);
		const numEntries = (content.main[2] == 0) ? 256 : content.main[2];
		const startIndex = content.main[1];

		// first initialize any leading palette entries to black if they
		// fall before the index range used by this pal file
		let i = 0;
		while (i < startIndex) {
			palette[i] = [0, 0, 0, 255];
			i++;
		}

		// populate only the subset of the palette entries specified
		// by the input file
		let p = 3;
		while (i < (startIndex + numEntries)) {
			palette[i] = [0, 0, 0, 255];
			// process each of the three bytes for this entry
			for (let j = 0; j < 3; j++) {
				const c = Math.min((content.main[p] || 0), 63);
				palette[i][j] = pal6_to_8(c);
				p++; // advance the input file position
			}
			i++; // advance the palette index
		}

		// finally, populate any remaining palette colors with black
		while (i < 256) {
			palette[i] = [0, 0, 0, 255];
			i++;
		}

		return new Image({
			width: 0,
			height: 0,
			frames: [],
			palette,
		});
	}

	static write(image) {
		const palette = image.palette;
		if (!palette) {
			throw new Error('Cannot write a palette file if the image has no palette!');
		}

		if (palette.length != 256) {
			throw new Error('Writing Papyrus-format palettes with fewer than 256 colors is not supported.');
		}

		let warnings = [];
		if (image.frames.length > 0) {
			warnings.push(`All frames have been discarded as this is a palette-only ` +
				`format.`);
		}

		let content = new Uint8Array(3 + (256 * 3));
		content[0] = 0; // always 0 by format definition
		content[1] = 0; // start index of 0 in VGA palette
		content[2] = 0; // number of palette entries (0 means 256)

		for (let i = 0; i < 256; i++) {
			for (let c = 0; c < 3; c++) {
				content[3 + (i * 3 + c)] = pal8_to_6(palette[i][c]);
			}
			if (palette[i][3] != 255) {
				warnings.push(`Palette entry ${i} has an alpha value of ` +
					`${palette[i][3]}, but only a value of 255 is possible in this ` +
					`palette format.`);
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
