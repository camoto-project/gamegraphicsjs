/*
 * Dangerous Dave VGA tileset handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   http://www.shikadi.net/moddingwiki/Dangerous_Dave_Tileset_Format
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

const FORMAT_ID = 'tls-ddave-vga';

import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { pad_generic } from '@camoto/gamecomp';
import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';

const FIRST_TILE_WITH_DIMS = 53;
const DDAVE_BLOCK_SIZE = 0xFF00;

const recordTypes = {
	header: {
		count: RecordType.int.u32le,
	},
	fatEntry: {
		offset: RecordType.int.u32le,
	},
	tileHeader: {
		width: RecordType.int.u16le,
		height: RecordType.int.u16le,
	},
};

export default class Tileset_DDave extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Dangerous Dave Tileset',
			options: {},
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = undefined,
		md.limits.maximumSize.y = undefined,
		md.limits.depth = 8;
		md.limits.hasPalette = false;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = 158;

		return md;
	}

	static checkLimits(frames) {
		let issues = super.checkLimits(frames);

		for (let i = 0; i < Math.min(53, frames.length); i++) {
			if ((frames[i].dims.x !== 16) || (frames[i].dims.y !== 16)) {
				issues.push(`The first 53 images can only be 16x16 pixels in size `
					+ `(frame #${i} is ${frames[i].dims.x}x${frames[i].dims.y}).`);
			}
		}

		return issues;
	}

	static identify(content) {
		if (content.length < 4) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		// Then remove the extra padding byte inserted every RLE block.
		let unpaddedBuffer = pad_generic.reveal(content, {
			pass: DDAVE_BLOCK_SIZE,  // After this many bytes...
			pad: 1,                  // ...drop this many bytes.
		});

		let buffer = new RecordBuffer(unpaddedBuffer);
		const count = recordTypes.header.count.read(buffer);
		if (content.length < 4 + count * 4) {
			return {
				valid: false,
				reason: `FAT truncated.`,
			};
		}

		for (let i = 0; i < count; i++) {
			const thisOffset = recordTypes.fatEntry.offset.read(buffer);
			if (thisOffset + 4 > buffer.length) {
				return {
					valid: false,
					reason: `Tile ${i} starts at EOF.`,
				};
			}

			let tileSize;
			if (i >= FIRST_TILE_WITH_DIMS) {
				const origPos = buffer.getPos();
				buffer.seekAbs(thisOffset);
				const tileHeader = buffer.readRecord(recordTypes.tileHeader);
				buffer.seekAbs(origPos);
				tileSize = 4 + tileHeader.width * tileHeader.height;
			} else {
				tileSize = 16 * 16;
			}
			if (thisOffset + tileSize > buffer.length) {
				return {
					valid: false,
					reason: `Tile ${i} runs past EOF.`,
				};
			}
		}

		return {
			valid: true,
			reason: `All checks passed.`,
		};
	}

	static read(content) {
		const debug = g_debug.extend('read');

		// Not using cmp_rle_id as that is considered part of the .exe and by the
		// time we get here RLE compression has been removed, matching the way the
		// external egadave.dav works.

		// Then remove the extra padding byte inserted every RLE block.
		let unpaddedBuffer = pad_generic.reveal(content.main, {
			pass: DDAVE_BLOCK_SIZE,  // After this many bytes...
			pad: 1,                  // ...drop this many bytes.
		});

		let buffer = new RecordBuffer(unpaddedBuffer);
		const header = buffer.readRecord(recordTypes.header);

		let lastOffset = -1, firstOffset = -1;
		let sizes = [];
		for (let i = 0; i < header.count; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			const thisOffset = fatEntry.offset;
			if (lastOffset === -1) {
				firstOffset = thisOffset;
				lastOffset = thisOffset;
				continue;
			}
			sizes.push(thisOffset - lastOffset);
			lastOffset = thisOffset;
		}
		sizes.push(buffer.length - lastOffset);

		let images = [];
		let thisOffset = firstOffset;
		for (let i = 0; i < header.count; i++) {
			buffer.seekAbs(thisOffset);
			let dims = {x: 16, y: 16};
			let lenHeader = 0;
			if (i >= FIRST_TILE_WITH_DIMS) {
				const tileHeader = buffer.readRecord(recordTypes.tileHeader);
				dims = {x: tileHeader.width, y: tileHeader.height};
				lenHeader = 4;
			}
			let img = new Image(
				dims,
				buffer.getU8(thisOffset + lenHeader, sizes[i] - lenHeader),
			);
			images.push(img);
			thisOffset += sizes[i];
		}

		return images;
	}

	static write(frames) {
		const debug = g_debug.extend('write');

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const offEndFAT = 4 /* header */ + 4 * frames.length /* FAT */;
		const finalSize = frames.reduce(
			(a, b) => a + (b.dims.x * b.dims.y),
			offEndFAT,
		);
		let buffer = new RecordBuffer(finalSize);

		// Write the file header.
		buffer.writeRecord(recordTypes.header, {
			count: frames.length,
		});

		// Write the FAT.
		let nextOffset = offEndFAT;
		for (let i = 0; i < frames.length; i++) {
			buffer.writeRecord(recordTypes.fatEntry, {
				offset: nextOffset,
			});
			nextOffset += frames[i].dims.x * frames[i].dims.y;
			if (i >= FIRST_TILE_WITH_DIMS) {
				nextOffset += 4;
			}
		}

		// Write the pixel data.
		for (let i = 0; i < frames.length; i++) {
			if (i >= FIRST_TILE_WITH_DIMS) {
				buffer.writeRecord(recordTypes.tileHeader, {
					width: frames[i].dims.x,
					height: frames[i].dims.y,
				});
			}
			buffer.put(frames[i].pixels);
		}

		// Add the extra padding byte inserted every RLE block.
		let bufPadded = pad_generic.obscure(buffer.getU8(), {
			pass: DDAVE_BLOCK_SIZE,  // After this many bytes...
			pad: 1,                  // ...add this many bytes.
		});

		return {
			content: {
				main: bufPadded,
			},
			warnings: [],
		};
	}
}
