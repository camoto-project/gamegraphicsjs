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

import { PNG } from '@camoto/pngjs';

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Frame from '../interface/frame.js';
import Palette from '../interface/palette.js';
import { defaultPalette } from '../util/palette-default.js';

export default class Image_PNG extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Portable Network Graphic',
			glob: [
				'*.png',
			],
		};

		md.limits.minimumSize.x = 1;
		md.limits.minimumSize.y = 1;
		md.limits.maximumSize.x = undefined,
		md.limits.maximumSize.y = undefined,
		md.limits.depth = 8;
		md.limits.hasPalette = true;
		md.limits.paletteDepth = 8;
		md.limits.transparentIndex = undefined;

		return md;
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

		let palette = undefined;
		if (png.palette) {
			palette = new Palette(png.palette.length);
			for (let i = 0; i < palette.length; i++) {
				// This will include alpha from the tRNS palette transparency block.
				palette[i] = png.palette[i];
			}
		} else {
			palette = defaultPalette(png.depth);
		}

		return new Image({
			width: png.width,
			height: png.height,
			frames: [
				new Frame({
					pixels: png.data,
				}),
			],
			palette,
		});
	}

	static write(image)
	{
		if (image.frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}

		const frame = image.frames[0];
		const frameWidth = (frame.width === undefined) ? image.width : frame.width;
		const frameHeight = (frame.height === undefined) ? image.height : frame.height;

		let png = new PNG();
		png.width = frameWidth;
		png.height = frameHeight;
		png.data = image.frames[0].pixels;

		let maxPixel = 0;
		for (const c of image.frames[0].pixels) {
			if (c > maxPixel) maxPixel = c;
		}
		if (maxPixel >= 16) {
			png.depth = 8;
		} else if (maxPixel >= 4) {
			png.depth = 4;
		} else if (maxPixel >= 2) {
			png.depth = 2;
		} else {
			png.depth = 1;
		}
		debug(`Writing as ${png.depth}-bit (max pixel value is ${maxPixel})`);

		if (image.palette) {
			// We could chop the palette down in size to the last colour actually used,
			// but often it's nice to have the whole palette exported in a 256 colour
			// image even if it doesn't use all 256 colours, so we'll leave it.
			png.palette = image.palette.slice(0, 1 << png.depth);
		} else {
			debug('Using default palette');
			png.palette = defaultPalette(png.depth);
		}

		let buffer = PNG.sync.write(png, {
			inputColorType: 3, // we are passing in indexed data
			colorType: 3, // we want an indexed .png
		});

		return {
			content: {
				main: new Uint8Array(buffer),
			},
			warnings: [],
		};
	}
}
