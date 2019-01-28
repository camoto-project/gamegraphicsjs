/**
 * @file 8bpp linear format handler.
 *
 * Copyright (C) 2018-2019 Adam Nielsen <malvineous@shikadi.net>
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

const Debug = require('../util/utl-debug.js');
const ImageHandler = require('./imageHandler.js');
const Image = require('./image.js');

const FORMAT_ID = 'img-raw-vga';

module.exports = class Image_VGA_Linear extends ImageHandler
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Raw 8bpp linear image',
			games: [
				'TODO',
			],
			glob: [
			],
			limits: {
				minimumSize: [0, 0],
				maximumSize: [undefined, undefined],
				hasPalette: false,
			},
		};
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			if (content.length !== 320 * 200) {
				Debug.log(`File length ${content.length} is not ${320 * 200} => false`);
				return false;
			}

			Debug.log(`Correct file size => true`);
			return true;

		} finally {
			Debug.pop();
		}
	}

	static read(content, options = {}) {
		return new Image(
			options.width || 320,
			options.height || 200,
			content.main,
			options.palette
		);
	}

	static write(image, options = {}) {
		return {
			main: image.pixels,
		};
	}
};
