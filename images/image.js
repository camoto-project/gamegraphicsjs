/**
 * @file Image base class.
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

const createDefaultPalette = require('../palettes/pal-default.js');

module.exports = class Image
{
	/**
	 * Create a new image.
	 *
	 * @param {Number} width
	 *   Width of the new image, in pixels.
	 *
	 * @param {Number} height
	 *   Height of the new image, in pixels.
	 *
	 * @param {Uint8Array} content
	 *   Optional image content to use, in 8bpp linear format.  If omitted, a new
	 *   empty buffer is allocated and filled with palette index 0.
	 *
	 * @param {Palette} palette
	 *   Colour palette to use.  Omit or specify null to use the default VGA
	 *   palette.
	 */
	constructor(width, height, content, palette) {
		this.width = width;
		this.height = height;
		this.pixels = content || new Uint8Array(width * height);
		this.palette = palette || createDefaultPalette(256);
	}

	/**
	 * Change the size of the image without corrupting the data.
	 *
	 * @param {Number} newPixel
	 *   Palette index used for any new pixels, if the image is being enlarged.
	 */
	resize(newWidth, newHeight, newPixel) {
		throw new Error('Not implemented');
	}

	/**
	 * Return a new image identical to the original, but with a duplicated buffer
	 * so that changes to the copy do not affect the original.
	 */
	clone() {
		throw new Error('Not implemented');
	}
};
