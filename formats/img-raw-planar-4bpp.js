/*
 * 4bpp graphic-planar (EGA fullscreen) format handler.
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

const FORMAT_ID = 'img-raw-planar-4bpp';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import { fromPlanar, toPlanar } from '../util/image-planar.js';
import { paletteCGA16 } from '../util/palette-default.js';

export default class Image_Raw_4bpp_Planar extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Raw 4bpp graphic-planar image',
			options: {
				width: 'Image width, in pixels',
				height: 'Image height, in pixels',
			},
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = undefined,
		md.limits.maximumSize.y = undefined,
		md.limits.multipleSize.x = 8;
		md.limits.depth = 4;
		md.limits.hasPalette = false;

		return md;
	}

	static identify(content, filename, options = {}) {
		const width = options.width ?? 320;
		const height = options.height ?? 200;
		const planeCount = options.planeCount ?? 4;

		const expSize = width * height * planeCount / 8;
		if (content.length !== expSize) {
			return {
				valid: false,
				reason: `File length ${content.length} is not ${expSize}.`,
			};
		}

		return {
			valid: true,
			reason: `Correct file size.`,
		};
	}

	static read(content, options = {}) {
		const width = parseInt(options.width ?? 320);
		const height = parseInt(options.height ?? 200);

		if (width % 8) {
			throw new Error(`Image width must be a multiple of 8 (limits.multipleSize ignored).`);
		}
		return [
			new Image(
				{x: width, y: height},
				fromPlanar({
					content: content.main,
					planeCount: options.planeCount ?? 4,
					planeWidth: width * height,
					planeValues: [1, 2, 4, 8],
					byteOrderMSB: true,
				}),
				paletteCGA16()
			),
		];
	}

	static write(frames, options) {
		if (frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}
		const image = frames[0];

		if (image.dims.x % 8) {
			throw new Error(`Image width must be a multiple of 8 (limits.multipleSize ignored).`);
		}
		return {
			content: {
				main: toPlanar({
					content: image.pixels,
					planeCount: options.planeCount ?? 4,
					planeWidth: image.dims.x * image.dims.y,
					planeValues: [1, 2, 4, 8],
					byteOrderMSB: true,
				}),
			},
			warnings: [],
		};
	}
}
