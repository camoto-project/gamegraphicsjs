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
import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import { pad_generic } from '@camoto/gamecomp';

const FIRST_TILE_WITH_DIMS = 53;

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

		return md;
	}

	static identify(content) {
		if (content.length < 4) {
			return {
				valid: false,
				reason: `File too short.`,
			};
		}

		let buffer = new RecordBuffer(content);
		const count = recordTypes.header.count.read(buffer);
		if (content.length < 4 + count * 4) {
			return {
				valid: false,
				reason: `FAT truncated.`,
			};
		}

		const bytesPerPixel = 0.5;
		const fixedTileSize = 16 * 16 * bytesPerPixel;

		let lastOffset = -1;
		let part2offsets = [];
		for (let i = 0; i < count; i++) {
			const thisOffset = recordTypes.fatEntry.offset.read(buffer);
			if (lastOffset === -1) continue;
			if (thisOffset < lastOffset) {
				return {
					valid: false,
					reason: `Negative tile length.`,
				};
			}

			// Keep track of the offsets for all the tiles that have a header, so
			// we can check the header next.
			if (i >= FIRST_TILE_WITH_DIMS) {
				part2offsets.push({
					offset: lastOffset,
					size: lastOffset - thisOffset,
				});
			}
			lastOffset = thisOffset;
		}

		// Remove the extra byte that's inserted every 65,535 bytes.
		let unpaddedBuffer = buffer;

		if (count > FIRST_TILE_WITH_DIMS) {
			part2offsets.push({
				offset: lastOffset,
				size: lastOffset - unpaddedBuffer.length,
			});
		}

		part2offsets.forEach(o => {
			buffer.seek(o.offset);
			const tileHeader = unpaddedBuffer.readRecord(recordTypes.tileHeader);

			// Round the width up to the next multiple of 8
			const width8 = tileHeader.width + 8 - (tileHeader.width % 8);

			const dataSize = width8 * tileHeader.height * bytesPerPixel;
			if (dataSize != o.size) {
				return {
					valid: false,
					reason: `Image dimensions in header don't match data length.`,
				};
			}
		});

		return {
			valid: true,
			reason: `All checks passed.`,
		};
	}

	static read(content, options = {}) {
		const debug = g_debug.extend('read');

		// Not using cmp_rle_id as that is considered part of the .exe and by the
		// time we get here RLE compression has been removed, matching the way the
		// external egadave.dav works.

		// Then remove the extra padding byte inserted every 65,535 bytes.
		let unpaddedBuffer = pad_generic.reveal(content.main, {
			pass: 0xFFFF,  // After this many bytes...
			pad: 1,        // ...drop this many bytes.
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

	static write(image, options = {}) {
		const debug = g_debug.extend('write');

		throw new Error('Not implemented yet.');
	}
};
