/*
 * Cosmo's Cosmic Adventure masked tileset handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/Cosmo_Tileset_Format
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

const FORMAT_ID = 'tls-cosmo-masked';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Frame from '../interface/frame.js';
import { fromPlanar, toPlanar } from '../util/frame-planar.js';
import { paletteCGA16 } from '../util/palette-default.js';

const BYTES_PER_TILE = 8 * 5;

export class tls_cosmo_masked extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Cosmo\'s Cosmic Adventure Masked Tileset',
		};

		md.limits.minimumSize.x = 8;
		md.limits.minimumSize.y = 8;
		md.limits.maximumSize.x = 8;
		md.limits.maximumSize.y = 8;
		md.limits.depth = 4;
		md.limits.hasPalette = false;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = 1;

		return md;
	}

	static identify(content) {
		if (content.length > 5000 * BYTES_PER_TILE) {
			return {
				valid: false,
				reason: 'File too large (>5000 tiles).',
			};
		}

		if (content.length % BYTES_PER_TILE) {
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
		const pixels = fromPlanar({
			content: content.main,
			planeCount: 5,
			planeWidth: 8,
			lineWidth: 8,
			planeValues: [16, 1, 2, 4, 8],
			byteOrderMSB: true,
		});

		// Convert any colour over 15 to transparent.
		for (let p = 0; p < pixels.length; p++) {
			pixels[p] = Math.min(16, pixels[p]);
		}

		let img = new Image({
			width: 8,
			height: 8,
			frames: [],
			palette: paletteCGA16(),
		});

		// Add an entry for transparent.
		img.palette.push([255, 0, 255, 0]);

		const pixelsPerTile = img.width * img.height;
		const numTiles = pixels.length / pixelsPerTile;
		for (let f = 0; f < numTiles; f++) {
			img.frames.push(new Frame({
				pixels: pixels.slice(f * pixelsPerTile, (f + 1) * pixelsPerTile),
			}));
		}

		return img;
	}

	static write(image) {
		let pixelCount = 0;
		for (const f of image.frames) {
			const frameWidth = f.width || image.width;
			const frameHeight = f.height || image.height;
			pixelCount += frameWidth * frameHeight;
		}
		let pixels = new Uint8Array(pixelCount);

		let offDst = 0;
		for (const f of image.frames) {
			pixels.set(f.pixels, offDst);
			offDst += f.pixels.length;
		}

		return {
			content: {
				main: toPlanar({
					content: pixels,
					planeCount: 5,
					planeWidth: 8,
					lineWidth: 8,
					planeValues: [16, 1, 2, 4, 8],
					byteOrderMSB: true,
				}),
			},
			warnings: [],
		};
	}
}
