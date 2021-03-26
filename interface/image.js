/*
 * Image base class.
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

export default class Image
{
	/**
	 * Create a new image.
	 *
	 * @param {Object} dims
	 *   Dimensions of the new image.
	 *
	 * @param {Number} dims.x
	 *   Image width, in pixels.
	 *
	 * @param {Number} dims.y
	 *   Image height, in pixels.
	 *
	 * @param {Uint8Array} content
	 *   Optional image content to use, in 8bpp linear format.  If omitted, a new
	 *   empty buffer is allocated and filled with palette index 0.
	 *
	 * @param {Palette} palette
	 *   Colour palette to use.  Omit or specify null to use the default VGA
	 *   palette.
	 *
	 * @param {Object} hotspot
	 *   Pixel coordinate within the image that should appear at the location the
	 *   image is drawn.  If the hotspot is (10,20) then drawing the image at
	 *   (100,100) will cause the top-left of the image (0,0) to be drawn at
	 *   (90,80), so that the hotspot is at the (100,100) coordinate.
	 *
	 * @param {Number} hotspot.x
	 *   Horizontal hotspot point, in pixels.
	 *
	 * @param {Number} hotspot.y
	 *   Vertical hotspot point, in pixels.
	 *
	 * @param {Number} postDelay
	 *   Number of milliseconds to wait after drawing the image, if the image is
	 *   a frame in an animation sequence.  Ignored if not part of an animation.
	 *   Do not set (or set to `undefined`) unless this is an animation, as the
	 *   presence of this value is used to distinguish between tilesets and
	 *   animations.
	 */
	constructor(dims, content, palette, hotspot, postDelay) {
		this.dims = dims || {x: 0, y: 0};
		this.pixels = content || new Uint8Array(this.dims.x * this.dims.y);
		this.palette = palette || undefined;
		this.hotspot = hotspot || {x: undefined, y: undefined};
		this.postDelay = postDelay || undefined;
	}

	/**
	 * Change the size of the image without corrupting the data.
	 *
	 * @param {Number} newPixel
	 *   Palette index used for any new pixels, if the image is being enlarged.
	 */
	// eslint-disable-next-line no-unused-vars
	resize(newDims, newPixel) {
		throw new Error('Not implemented');
	}

	/**
	 * Return a new image identical to the original, but with a duplicated buffer
	 * so that changes to the copy do not affect the original.
	 */
	clone() {
		return new Image(
			{ ...this.dims },
			new Uint8Array(this.pixels),
			this.palette && this.palette.clone(),
			{ ...this.hotspot },
			this.postDelay,
		);
	}
}
