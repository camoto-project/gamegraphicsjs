/*
 * 8bpp linear format handler.
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

const FORMAT_ID = 'img-raw-linear-8bpp';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';

export default class Image_Raw_8bpp_Linear extends ImageHandler
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Raw 8bpp linear image',
			limits: {
				minimumSize: {x: 0, y: 0},
				maximumSize: {x: undefined, y: undefined},
				depth: 8,
				hasPalette: false,
			},
			options: {
				width: 'Image width, in pixels',
				height: 'Image height, in pixels',
			},
		};
	}

	static identify(content, filename, options = {}) {
		const width = options.width ?? 320;
		const height = options.height ?? 200;

		const expSize = width * height;
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
		return new Image(
			{x: options.width ?? 320, y: options.height ?? 200},
			content.main
		);
	}

	static write(image) {
		return {
			main: image.pixels,
		};
	}
}
