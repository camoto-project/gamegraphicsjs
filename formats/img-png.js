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
				minimumSize: {x: 0, y: 0},
				maximumSize: {x: undefined, y: undefined},
				depth: 8,
				hasPalette: true,
				paletteDepth: 8,
				transparentIndex: undefined,
			},
		};
	}

	static read(content) {
		let png = new PNG();
		png.sync.read(content.main);

		// Convert RGBA to 8bpp
		let indexedBuffer = new Uint8Array(png.width * png.height);
		for (let i = 0; i < png.width * png.height; i++) {
			// TODO: lookup palette or something
			indexedBuffer[i] = png.data[i];
		}
		return new Image(
			{x: png.width, y: png.height},
			indexedBuffer
		);
	}

	static write(image)
	{
		let png = new PNG();
		png.width = image.dims.x;
		png.height = image.dims.y;
		png.data = new Uint8Array(png.width * png.height * 4);
		// Temp: Convert to RGBA
		for (let i = 0; i < png.width * png.height; i++) {
			if (image.palette && image.palette[image.pixels[i]]) {
				png.data[i * 4 + 0] = image.palette[image.pixels[i]][0];
				png.data[i * 4 + 1] = image.palette[image.pixels[i]][1];
				png.data[i * 4 + 2] = image.palette[image.pixels[i]][2];
				png.data[i * 4 + 3] = image.palette[image.pixels[i]][3];
			} else {
				png.data[i * 4 + 0] = image.pixels[i];
				png.data[i * 4 + 1] = image.pixels[i];
				png.data[i * 4 + 2] = image.pixels[i];
				png.data[i * 4 + 3] = 255;
			}
		}
		return {
			main: PNG.sync.write(png, {
				colorType: 6, // TODO: Use indexed instead
			}),
		};
	}
}
