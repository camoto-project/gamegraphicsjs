/*
 * Standard .png image.
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

const FORMAT_ID = 'img-png';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { PNG } from 'pngjs';

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Palette from '../interface/palette.js';
import { defaultPalette } from '../util/palette-default.js';

export default class Image_PNG extends ImageHandler
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Portable Network Graphic',
			glob: [
				'*.png',
			],
			limits: {
				minimumSize: {x: 1, y: 1},
				maximumSize: {x: undefined, y: undefined},
				depth: 8,
				hasPalette: true,
				paletteDepth: 8,
				transparentIndex: undefined,
			},
		};
	}

	static identify(content) {
		if (
			(content[0] != 0x89)
			|| (content[1] != 'P'.charCodeAt(0))
			|| (content[2] != 'N'.charCodeAt(0))
			|| (content[3] != 'G'.charCodeAt(0))
		) {
			return {
				valid: false,
				reason: `Invalid signature.`,
			};
		}

		return {
			valid: true,
			reason: `Valid signature.`,
		};
	}

	static read(content) {
		let png = PNG.sync.read(Buffer.from(content.main), { keepIndexed: true });

		// Convert RGBA to 8bpp
		let indexedBuffer = new Uint8Array(png.width * png.height);
		for (let i = 0; i < png.width * png.height; i++) {
			// TODO: lookup palette or something
			indexedBuffer[i] = png.data[i];
		}

		let palette = undefined;
		if (png.palette) {
			palette = new Palette(png.palette.length);
			for (let i = 0; i < palette.length; i++) {
				// This will include alpha from the tRNS palette transparency block.
				palette[i] = png.palette[i];
			}
		} else {
			palette = defaultPalette(this.depth());
		}

		return new Image(
			{x: png.width, y: png.height},
			indexedBuffer,
			palette
		);
	}

	static write(image)
	{
		let png = new PNG();
		png.width = image.dims.x;
		png.height = image.dims.y;
		png.data = image.pixels;

		png.depth = this.depth();
		png.palette = [];
		const maxColours = Math.min(
			image.palette.length,
			1 << png.depth
		);
		debug(`Palette has ${image.palette.length} colours, writing ${maxColours}.`);

		for (let i = 0; i < image.palette.length; i++) {
			png.palette[i] = [
				image.palette[i][0],
				image.palette[i][1],
				image.palette[i][2],
				image.palette[i][3],
			];
		}

		let buffer = PNG.sync.write(png, {
			inputColorType: 3, // we are passing in indexed data
			colorType: 3, // we want an indexed .png
		});

		return {
			main: new Uint8Array(buffer),
		};
	}

	static depth() {
		return 8;
	}
}
