/*
 * Captain Comic tileset handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/Captain_Comic_Tileset_Format
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

const FORMAT_ID = 'tls-ccomic-map';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Frame from '../interface/frame.js';
import { fromPlanar, toPlanar } from '../util/frame-planar.js';
import { paletteCGA16 } from '../util/palette-default.js';

const BYTES_PER_TILE = 128;

const recordTypes = {
	header: {
		lastPassable: RecordType.int.u8,
		unknown1: RecordType.int.u8,
		unknown2: RecordType.int.u8,
		flags: RecordType.int.u8,
	},
};

export default class Tileset_CComic_Map extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Captain Comic Map Tiles',
		};

		md.limits.minimumSize.x = 16;
		md.limits.minimumSize.y = 16;
		md.limits.maximumSize.x = 16;
		md.limits.maximumSize.y = 16;
		md.limits.depth = 4;
		md.limits.hasPalette = false;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = 1;

		return md;
	}

	static identify(content) {
		if (content.length > 256 * BYTES_PER_TILE) {
			return {
				valid: false,
				reason: 'File too large (>256 tiles).',
			};
		}

		if (content.length % BYTES_PER_TILE !== 4) {
			return {
				valid: false,
				reason: 'Not a multiple of the tile size.',
			};
		}

		return {
			valid: undefined,
			reason: `Permissable file size.`,
		};
	}

	static read(content) {
		let buffer = new RecordBuffer(content.main);
		const header = buffer.readRecord(recordTypes.header);

		let frame = new Frame({
			pixels: fromPlanar({
				content: buffer.getU8(4),
				planeCount: 4,
				planeWidth: 16 * 16,
				lineWidth: 16,
				planeValues: [1, 2, 4, 8],
				byteOrderMSB: true,
			}),
		});

		return new Image({
			width: 16,
			height: (16 * content.main.length / BYTES_PER_TILE) >>> 0,
			frames: [frame],
			palette: paletteCGA16(),
			tags: {
				lastPassable: header.lastPassable,
				flags: header.flags,
			},
		});
	}

	static write(image) {
		if (image.frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}

		const pixels = toPlanar({
			content: image.frames[0].pixels,
			planeCount: 4,
			planeWidth: 16 * 16,
			lineWidth: 16,
			planeValues: [1, 2, 4, 8],
			byteOrderMSB: true,
		});

		let buffer = new RecordBuffer(pixels.length + 4);
		buffer.writeRecord(recordTypes.header, {
			lastPassable: image.tags.lastPassable || 0,
			unknown1: 0,
			unknown2: 0,
			flags: image.tags.flags || 0,
		});

		buffer.put(pixels);

		return {
			content: {
				main: buffer.getU8(),
			},
			warnings: [],
		};
	}
}
