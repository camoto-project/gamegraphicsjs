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

const FORMAT_ID = 'tls-ddave';

import Debug from '../util/debug.js';
const g_debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Frame from '../interface/frame.js';
import { fromPlanar, toPlanar } from '../util/frame-planar.js';
import { fromPacked, toPacked } from '../util/frame-linear_packed.js';
import {
	CGAPaletteType,
	paletteCGA16,
	paletteCGA4,
} from '../util/palette-default.js';

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

function roundMultiple(value, multiple)
{
	return value + ((multiple - (value % multiple)) % multiple);
}

class Tileset_DDave_Common extends ImageHandler
{
	static metadata() {
		let md = super.metadata();

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = undefined;
		md.limits.maximumSize.y = undefined;
		md.limits.depth = 8;
		md.limits.hasPalette = false;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = 158;

		return md;
	}

	static checkLimits(image) {
		let issues = super.checkLimits(image);

		for (let f = 0; f < Math.min(53, image.frames.length); f++) {
			const frame = image.frames[f];
			if ((frame.width !== 16) || (frame.height !== 16)) {
				issues.push(`The first 53 images can only be 16x16 pixels in size `
					+ `(frame #${f} is ${frame.width}x${frame.height}).`);
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

		let buffer = new RecordBuffer(content);
		const header = buffer.readRecord(recordTypes.header);
		if (content.length < 4 + header.count * 4) {
			return {
				valid: false,
				reason: `FAT truncated.`,
			};
		}

		if (header.count < this.metadata().limits.frameCount.min) {
			return {
				valid: false,
				reason: `Too few tiles.`,
			};
		}

		let endOfLastTile = 0;
		let tileSize = 16 * 16 * this.imageBitDepth() / 8;
		for (let i = 0; i < header.count; i++) {
			const fatEntry = buffer.readRecord(recordTypes.fatEntry);
			const thisOffset = fatEntry.offset;
			if (thisOffset + 4 > buffer.length) {
				return {
					valid: false,
					reason: `Tile ${i} starts at EOF.`,
				};
			}

			if (i >= FIRST_TILE_WITH_DIMS) {
				const origPos = buffer.getPos();
				buffer.seekAbs(thisOffset);
				const tileHeader = buffer.readRecord(recordTypes.tileHeader);
				buffer.seekAbs(origPos);
				tileSize = 4 + roundMultiple(tileHeader.width, 8) * tileHeader.height * this.imageBitDepth() / 8;
			}
			endOfLastTile = thisOffset + tileSize;
			if (endOfLastTile > buffer.length) {
				return {
					valid: false,
					reason: `Tile ${i} runs past EOF.`,
				};
			}
		}

		// The original CGA data has two trailing bytes, EGA has four, and VGA has
		// none.  Let's just complain if there are more than eight trailing bytes.
		const lenTrailing = buffer.length - endOfLastTile;
		if (lenTrailing > 8) {
			return {
				valid: false,
				reason: `${lenTrailing} bytes of trailing data after tiles.`,
			};
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

		let buffer = new RecordBuffer(content.main);
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

		let frames = [];
		let thisOffset = firstOffset;
		let frameWidth = 16, frameHeight = 16;
		for (let i = 0; i < header.count; i++) {
			buffer.seekAbs(thisOffset);
			let lenHeader = 0;
			if (i >= FIRST_TILE_WITH_DIMS) {
				const tileHeader = buffer.readRecord(recordTypes.tileHeader);
				frameWidth = tileHeader.width;
				frameHeight = tileHeader.height;
				lenHeader = 4;
			}
			const offStart = thisOffset + lenHeader;
			const lenTile = sizes[i] - lenHeader;
			const offEnd = offStart + lenTile;
			if (offEnd > buffer.length) {
				debug(`Truncated output at tile ${i+1} of ${header.count}, tile ends `
					+ `at ${offEnd} but file is only ${buffer.length} bytes long.`);
				break;
			}
			let img = this.createFrame(
				frameWidth,
				frameHeight,
				buffer.getU8(offStart, lenTile)
			);
			frames.push(img);
			thisOffset += sizes[i];
		}

		return new Image({
			frames,
			palette: this.getPalette(),
		});
	}

	static write(image) {
		const debug = g_debug.extend('write');

		// Calculate the size up front so we don't have to keep reallocating the
		// buffer, improving performance.
		const offEndFAT = 4 /* header */ + 4 * image.frames.length /* FAT */;
		const finalSize = image.frames.reduce(
			(a, b) => a + (b.width * b.height),
			offEndFAT,
		);
		let buffer = new RecordBuffer(finalSize);

		// Write the file header.
		buffer.writeRecord(recordTypes.header, {
			count: image.frames.length,
		});

		// Write the pixel data.
		let bufferMain = new RecordBuffer(finalSize);
		for (let f = 0; f < image.frames.length; f++) {
			// Write the next FAT entry.
			buffer.writeRecord(recordTypes.fatEntry, {
				offset: offEndFAT + bufferMain.getPos(),
			});
			if (f >= FIRST_TILE_WITH_DIMS) {
				bufferMain.writeRecord(recordTypes.tileHeader, {
					width: image.frames[f].width,
					height: image.frames[f].height,
				});
			}
			const pixelData = this.getPixelData(image.frames[f]);
			bufferMain.put(pixelData);
		}

		if (buffer.getPos() !== offEndFAT) {
			throw new Error('BUG: Miscalculated FAT length.');
		}

		// Write out all the pixel data after the FAT.
		buffer.put(bufferMain);

		return {
			content: {
				main: buffer.getU8(),
			},
			warnings: [],
		};
	}
}

export class tls_ddave_vga extends Tileset_DDave_Common
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-vga',
			title: 'Dangerous Dave VGA tileset',
			options: {},
		};
	}

	static imageBitDepth() {
		return 8;
	}

	static getPalette() {
		return undefined;
	}

	static createFrame(width, height, pixelData) {
		return new Frame({
			width,
			height,
			pixels: pixelData,
		});
	}

	static getPixelData(frame) {
		// Pixel data is already in 8bpp format.
		return frame.pixels;
	}
}

export class tls_ddave_ega extends Tileset_DDave_Common
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-ega',
			title: 'Dangerous Dave EGA tileset',
			options: {},
		};
	}

	static imageBitDepth() {
		return 4;
	}

	static getPalette() {
		return paletteCGA16();
	}

	static createFrame(width, height, pixelData) {
		return new Frame({
			width,
			height,
			pixels: fromPlanar({
				content: pixelData,
				planeCount: 4,
				planeWidth: Math.ceil(width / 8) * 8,
				lineWidth: width,
				planeValues: [8, 4, 2, 1],
				byteOrderMSB: true,
			}),
		});
	}

	static getPixelData(frame) {
		return toPlanar({
			content: frame.pixels,
			planeCount: 4,
			planeWidth: Math.ceil(frame.width / 8) * 8,
			lineWidth: frame.width,
			planeValues: [8, 4, 2, 1],
			byteOrderMSB: true,
		});
	}
}

export class tls_ddave_cga extends Tileset_DDave_Common
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-cga',
			title: 'Dangerous Dave CGA tileset',
			options: {},
		};
	}

	static imageBitDepth() {
		return 2;
	}

	static getPalette() {
		return paletteCGA4(CGAPaletteType.CyanMagentaBright, 0);
	}

	static createFrame(width, height, pixelData) {
		return new Frame({
			width,
			height,
			pixels: fromPacked({
				content: pixelData,
				bitDepth: this.imageBitDepth(),
				width,
				height,
				widthBits: Math.ceil(width * this.imageBitDepth() / 8) * 8,
				byteOrderMSB: true,
			}),
		});
	}

	static getPixelData(frame) {
		return toPacked({
			content: frame.pixels,
			bitDepth: this.imageBitDepth(),
			width: frame.width,
			height: frame.height,
			widthBits: Math.ceil(frame.width * this.imageBitDepth() / 8) * 8,
			byteOrderMSB: true,
		});
	}
}
