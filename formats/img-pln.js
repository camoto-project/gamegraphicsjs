/*
 * Planet texture (.pln) image handler
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 * Copyright (C) 2021 Colin Bourassa
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

const FORMAT_ID = 'img-pln';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import {
	RecordBuffer,
	RecordType
} from '@camoto/record-io-buffer';
import ImageHandler from '../interface/imageHandler.js';
import { img_raw_linear_8bpp as rawHandler } from '../index.js';

const recordTypes = {
	lineWidth: {
		width: RecordType.int.u16le,
	},
};

const PLN_HEADER_SIZE_BYTES = 2;

export class img_pln extends ImageHandler {
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Planet texture image',
			options: {},
			glob: [
				'*.pln',
			],
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = undefined;
		md.limits.maximumSize.y = undefined;
		md.limits.depth = 8;
		return md;
	}

	static identify(content) {

		// Image data must have at least two byte, comprising the single
		// 16-bit word containing the width
		if (content.length < PLN_HEADER_SIZE_BYTES) {
			return {
				valid: false,
				reason: `File size is smaller than minimum possible for 0x0 texture.`,
			};
		}

		let buffer = new RecordBuffer(content);
		const textureWidth = buffer.read(RecordType.int.u16le);

		if (textureWidth == 0) {
			if (content.length > PLN_HEADER_SIZE_BYTES) {
				return {
					valid: false,
					reason: `File contains nonzero pixel data for zero-width image.`,
				};
			}
		} else if ((content.length - PLN_HEADER_SIZE_BYTES) % textureWidth !== 0) {
			// Image raster data must be evenly divisible by the width in pixels
			return {
				valid: false,
				reason: `Image pixel data is not evenly divisible by image width.`,
			};
		}

		return {
			valid: true,
			reason: `Valid PLN image.`,
		};
	}

	static read(content) {

		let buffer = new RecordBuffer(content.main);
		const textureWidth = buffer.read(RecordType.int.u16le);
		const textureHeight = (content.main.length - PLN_HEADER_SIZE_BYTES) / textureWidth;

		const rawImg = rawHandler.read(
			{main: content.main.slice(2)},
			{width: textureWidth, height: textureHeight});

		return rawImg;
	}

	static write(image, options) {

		if (image.frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}

		if ((options.width === 0) && (image.frames[0].pixels.length > 0)) {
			throw new Error(`Image width is given as 0 with non-zero pixel data.`);
		}

		if ((options.width > 0) && (image.frames[0].pixels.length % options.width !== 0)) {
			throw new Error(`Image pixel data length not evenly divisible by image width.`);
		}

		// Allocate the exact amount of space needed for the image plus header word
		let buffer = new RecordBuffer(PLN_HEADER_SIZE_BYTES + image.frames[0].pixels.length);
		buffer.writeRecord(recordTypes.lineWidth, {width: options.width});
		buffer.put(image.frames[0].pixels);

		return {
			content: {
				main: buffer.getU8(),
			},
			warnings: [],
		};
	}
}
