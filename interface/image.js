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
	 * @param {Number} width
	 *   Image width, in pixels.  This applies to any frame that does not have
	 *   its own size set.
	 *
	 * @param {Number} height
	 *   Image height, in pixels.  As for `width`.
	 *
	 * @param {Uint8Array} pixels
	 *   Optional image content to use, in 8bpp linear format.  If omitted, a new
	 *   empty buffer is allocated and filled with palette index 0.
	 *
	 * @param {Palette} palette
	 *   Colour palette to use.  Omit or specify null to use the default VGA
	 *   palette.
	 *
	 * @param {Number} hotspotX
	 *   Horizontal hotspot point, in pixels.  The hotspot is the position within
	 *   the image that appears at the coordinates where the image is drawn.
	 *   If the hotspot is (10,20) then drawing the image at (100,100) will cause
	 *   the top-left of the image (0,0) to be drawn at (90,80), so that the
	 *   hotspot pixel is at the original (100,100) coordinate.  This value
	 *   applies to any frame that does not have its own hotspot set, and
	 *   defaults to (0,0).
	 *
	 * @param {Number} hotspotY
	 *   Vertical hotspot point, in pixels.  As for `hotspotX`.
	 *
	 * @param {Object} tags
	 *   Additional generic information to expose as key/value data, such as
	 *   titles, artist names, and other metadata.  Each format handler supplies
	 *   a list of tags it can read and write.
	 */
	constructor(params) {
		this.width = params.width || 0;
		this.height = params.height || 0;
		this.frames = params.frames || [];
		this.palette = params.palette || undefined;
		this.hotspotX = params.hotspotX || undefined;
		this.hotspotY = params.hotspotY || undefined;
		this.tags = params.tags || {};
	}

	/**
	 * Return a new image identical to the original, but with a duplicated buffer
	 * so that changes to the copy do not affect the original.
	 */
	clone() {
		return new Image({
			width: this.width,
			height: this.height,
			frames: this.frames.map(f => f.clone()),
			palette: this.palette && this.palette.clone(),
			hotspotX: this.hotspotX,
			hotspotY: this.hotspotY,
			tags: { ...this.tags },
		});
	}
}
