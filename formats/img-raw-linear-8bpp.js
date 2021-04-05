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

const nullCo = (v, d) => ((v === null) || (v === undefined)) ? d : v;

export default class Image_Raw_8bpp_Linear extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Raw 8bpp linear image',
			options: {
				width: 'Image width, in pixels',
				height: 'Image height, in pixels',
			},
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = undefined,
		md.limits.maximumSize.y = undefined,
		md.limits.depth = 8;
		md.limits.hasPalette = false;

		return md;
	}

	static identify(content, filename, options = {}) {
		const width = parseInt(nullCo(options.width, 320));
		const height = parseInt(nullCo(options.height, 200));

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
		return [
			new Image(
				{
					x: parseInt(nullCo(options.width, 320)),
					y: parseInt(nullCo(options.height, 200)),
				},
				content.main
			),
		];
	}

	static write(frames) {
		if (frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}
		const image = frames[0];

		return {
			content: {
				main: image.pixels,
			},
			warnings: [],
		};
	}
}
