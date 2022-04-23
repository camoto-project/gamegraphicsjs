/*
 * Quarantine Sprite Package (.spr) image handler
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 * Copyright (C) 2022 Colin Bourassa
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

const FORMAT_ID = 'tls-quarantine-spr';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import {
	RecordBuffer,
	RecordType
} from '@camoto/record-io-buffer';
import ImageHandler from '../interface/imageHandler.js';
import {
	img_raw_linear_8bpp as rawHandler
} from '../index.js';

const WIDTH_HEIGHT_PAIR_SIZE = 2;

/**
 * The Quarantine sprite package is a simple concatenation of raw VGA images,
 * with basic header information to enumerate them.
 */
export class tls_quarantine_spr extends ImageHandler {
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Quarantine Texture Tiles',
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = 255;
		md.limits.maximumSize.y = 255;
		md.limits.sizePerFrame = true;
		md.limits.depth = 8;
		md.limits.hasPalette = false;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = 255;
		return md;
	}

	static identify(content) {

		// Require at least a single 0x0 tile
		if (content.length < 3) {
			return {
				valid: false,
				reason: `File size is smaller than minimum possible size for one 0x0 tile.`,
			};
		}

		let buffer = new RecordBuffer(content);
		const tileCount = buffer.read(RecordType.int.u8);

		if (tileCount == 0) {
			return {
				valid: false,
				reason: `SPR files with no tiles are not supported.`,
			};
		}

		const headerSize = 1 + (tileCount * WIDTH_HEIGHT_PAIR_SIZE);

		if (content.length < headerSize) {
			return {
				valid: false,
				reason: `Content too short to cover header size for ${tileCount} tiles.`,
			};
		}

		let pixelCount = 0;
		for (let i = 0; i < tileCount; i++) {
			const width = buffer.read(RecordType.int.u8);
			const height = buffer.read(RecordType.int.u8);
			pixelCount += width * height;
		}

		if (content.length !== (headerSize + pixelCount)) {
			return {
				valid: false,
				reason: `Content length of ${content.length} does not exactly match expected size of ${headerSize + pixelCount}.`,
			};
		}

		return {
			valid: true,
			reason: `Valid SPR image.`,
		};
	}

	static read(content) {

		let buffer = new RecordBuffer(content.main);
		const tileCount = buffer.read(RecordType.int.u8);

		let sprTiles = [];
		let tileSizes = [];

		// Read and store the width/height data for each contained tile
		for (let i = 0; i < tileCount; i++) {
			const tileWidth = buffer.read(RecordType.int.u8);
			const tileHeight = buffer.read(RecordType.int.u8);
			tileSizes[i] = {
				width: tileWidth,
				height: tileHeight,
			};
		}

		// The first tile's data begins immediately after the header
		let startOffsetCurrent = 1 + (tileCount * WIDTH_HEIGHT_PAIR_SIZE);

		for (let i = 0; i < tileCount; i++) {

			const length = tileSizes[i].width * tileSizes[i].height;
			const rawData = content.main.slice(startOffsetCurrent, startOffsetCurrent + length);
			const rawImg = rawHandler.read({
				main: rawData
			}, {
				width: tileSizes[i].width,
				height: tileSizes[i].height
			});

			sprTiles.push(rawImg);

			startOffsetCurrent += tileSizes[i].width * tileSizes[i].height;
		}

		// Don't return an array if there's only one image.
		if (sprTiles.length === 1) {
			return sprTiles[0];
		}

		return sprTiles;
	}

	static write(images) {

		// Create an array if we didn't get one.
		if (images.length === undefined) {
			images = [images];
		}

		// header contains a 2-byte entry for each frame
		const headerSize = 1 + (images.length * WIDTH_HEIGHT_PAIR_SIZE);

		// Allocate the minimum space required (if every frame were 0x0)
		let buffer = new RecordBuffer(headerSize);

		// Write the single byte containing tile count
		buffer.write(RecordType.int.u8, images.length);

		// Write the width/height header data (one w/h pair per tile)
		for (let i = 0; i < images.length; i++) {

			const singleByteWidth = ((images[i].frames[0].width === undefined) ?
				images[i].width : images[i].frames[0].width) & 0xff;
			const singleByteHeight = ((images[i].frames[0].height === undefined) ?
				images[i].height : images[i].frames[0].height) & 0xff;

			buffer.write(RecordType.int.u8, singleByteWidth);
			buffer.write(RecordType.int.u8, singleByteHeight);
		}

		// Write the raw image data
		for (let i = 0; i < images.length; i++) {
			if ((images[i].frames[0].width > 0) && (images[i].frames[0].pixels.length % images[i].frames[0].width !== 0)) {
				throw new Error(`Length of pixel data for image ${i} not evenly divisible by image width of ${images[i].frames[0].width}.`);
			}
			buffer.put(images[i].frames[0].pixels);
		}

		return {
			content: {
				main: buffer.getU8(),
			},
			warnings: [],
		};
	}
}
