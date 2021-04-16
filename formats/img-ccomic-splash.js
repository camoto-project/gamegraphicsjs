/*
 * Captain Comic splash screen handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/Captain_Comic_Image_Format
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

const FORMAT_ID = 'img-ccomic-splash';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { cmp_rle_ccomic } from '@camoto/gamecomp';

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Frame from '../interface/frame.js';
import { fromPlanar, toPlanar } from '../util/frame-planar.js';
import { paletteCGA16 } from '../util/palette-default.js';

const NUM_PLANES = 4;

export default class Tileset_CComic_Sprite extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Captain Comic Splash Screen',
		};

		md.limits.minimumSize.x = 320;
		md.limits.minimumSize.y = 200;
		md.limits.maximumSize.x = 320;
		md.limits.maximumSize.y = 200;
		md.limits.depth = 4;
		md.limits.hasPalette = false;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = 1;

		return md;
	}

	static identify(content) {
		// Assume each plane is blank (maximum compression) so it's composed
		// entirely of max-RLE blocks, which shrink every 127 bytes down into 2.
		const minPlaneSize = 8000 / 127 * 2;
		if (content.length < 2 + 4 * minPlaneSize) {
			return {
				valid: false,
				reason: 'File too small.',
			};
		}

		let buffer = new RecordBuffer(content);
		let lenPlane = buffer.read(RecordType.int.u16le);
		if (lenPlane != 8000) {
			return {
				valid: false,
				reason: 'Invalid plane size.',
			};
		}

		return {
			valid: undefined,
			reason: `Permissable file and plane size.`,
		};
	}

	static read(content) {
		let buffer = new RecordBuffer(content.main);
		let lenPlane = buffer.read(RecordType.int.u16le);
		let outbuf = new RecordBuffer(lenPlane * NUM_PLANES);
		let offNextPlane = 2;
		for (let p = 0; p < NUM_PLANES; p++) {
			let lenRead = 0;
			const cbLenRead = r => lenRead = r;
			const decomp = cmp_rle_ccomic.reveal(buffer.getU8(offNextPlane), {
				outputLength: 8000,
				cbLenRead,
			});
			offNextPlane += lenRead;
			outbuf.put(decomp);
		}

		const frame = new Frame({
			pixels: fromPlanar({
				content: outbuf.getU8(),
				planeCount: 4,
				planeWidth: 320 * 200,
				lineWidth: 320,
				planeValues: [1, 2, 4, 8],
				byteOrderMSB: true,
			}),
		});

		return new Image({
			width: 320,
			height: 200,
			frames: [frame],
			palette: paletteCGA16(),
		});
	}

	static write(image) {
		if (image.frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}

		const raw = toPlanar({
			content: image.frames[0].pixels,
			planeCount: 4,
			planeWidth: 320 * 200,
			lineWidth: 320,
			planeValues: [1, 2, 4, 8],
			byteOrderMSB: true,
		});

		const lenPlane = 8000;
		let output = new RecordBuffer(lenPlane * NUM_PLANES);

		output.write(RecordType.int.u16le, lenPlane);
		for (let p = 0; p < NUM_PLANES; p++) {
			// Each plane must be compressed separately, RLE codes can't run across
			// plane boundaries.
			const planeData = raw.slice(p * lenPlane, (p+1) * lenPlane);
			const cmp = cmp_rle_ccomic.obscure(planeData);
			output.put(cmp);
		}

		return {
			content: {
				main: output.getU8(),
			},
			warnings: [],
		};
	}
}
