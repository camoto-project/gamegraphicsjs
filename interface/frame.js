/*
 * Frame base class, for one or more pictures in an image.
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

export default class Frame
{
	/**
	 * Create a new frame.
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
	 * @param {Number} hotspotX
	 *   Horizontal hotspot point, in pixels from the left of the frame.  May be
	 *   negative.
	 *
	 * @param {Number} hotspotY
	 *   Vertical hotspot point, in pixels from the top of the frame.  May be
	 *   negative.
	 *
	 * @param {Number} offsetX
	 *   Number of pixels this frame is moved horizontally relative to the
	 *   overall image.  This is so a frame in an animation may only update a
	 *   small section of the overall image.  May NOT be negative or cause the
	 *   frame to extend beyond the bounding box defined by the parent image.
	 *   Defaults to `0`.
	 *
	 * @param {Number} offsetY
	 *   Number of pixels this frame is moved vertically.  Same conditions apply
	 *   as for `offsetX`.  Defaults to `0`.
	 *
	 * @param {Number} postDelay
	 *   Number of milliseconds to wait after drawing the image, if the image is
	 *   a frame in an animation sequence.  Ignored if not part of an animation.
	 *   Do not set (or set to `undefined`) unless this is an animation, as the
	 *   presence of this value is used to distinguish between tilesets and
	 *   animations.
	 */
	constructor(params) {
		this.width = params.width || undefined;
		this.height = params.height || undefined;
		this.pixels = params.pixels || new Uint8Array(this.width * this.height);
		this.palette = params.palette || undefined;
		this.hotspotX = params.hotspotX || undefined;
		this.hotspotY = params.hotspotY || undefined;
		this.offsetX = params.offsetX || 0;
		this.offsetY = params.offsetY || 0;
		this.postDelay = params.postDelay || undefined;
	}

	/**
	 * Return a new frame identical to the original, but with a duplicated buffer
	 * so that changes to the copy do not affect the original.
	 */
	clone() {
		return new Frame({
			width: this.width,
			height: this.height,
			pixels: new Uint8Array(this.pixels),
			palette: this.palette && this.palette.clone(),
			hotspotX: this.hotspotX,
			hotspotY: this.hotspotY,
			offsetX: this.offsetX,
			offsetY: this.offsetY,
			postDelay: this.postDelay,
		});
	}
}
