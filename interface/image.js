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
	 * @param {Array<Frame>} frames
	 *   Zero or more frames in the image.  A normal image (e.g. loaded from a PNG
	 *   or JPEG file) will have just one frame containing the pixel data for the
	 *   graphic.  Image sets may have multiple frames (e.g. a set of images for
	 *   the player sprite in a game).  Animated images will have multiple frames,
	 *   as well as the `animation` property below to control how the frames are
	 *   displayed over time.
	 *
	 * @param {Palette} palette
	 *   Global colour palette to use for all frames in the image (where the frame
	 *   doesn't include its own palette.)  Omit or specify null to use the
	 *   default 256-colour VGA palette.  Use one of the functions exported from
	 *   `util/palette-default.js` for default CGA or EGA palettes (see
	 *   img-raw-planar-4bpp.js for a 16-colour EGA example.)
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
	 *
	 * @param {Array} animation
	 *   Array of objects containing the following properties:
	 *     - index: Zero-based index of the frame to show at this point in the
	 *       cycle.  This allows frames to be used multiple times in a sequence.
	 *     - postDelay: Number of milliseconds to pause after showing this frame,
	 *       before advancing to the next.
	 */
	constructor(params = {}) {
		this.width = params.width || 0;
		this.height = params.height || 0;
		this.frames = params.frames || [];
		this.palette = params.palette || undefined;
		this.hotspotX = params.hotspotX || undefined;
		this.hotspotY = params.hotspotY || undefined;
		this.tags = params.tags || {};
		this.animation = params.animation || [];
	}

	/**
	 * Return a new image identical to the original, but with a duplicated buffer
	 * so that changes to the copy do not affect the original.
	 *
	 * @param {Number} start
	 *   First frame to copy, defaults to 0.
	 *
	 * @param {Number} count
	 *   Number of frames to copy, defaults to all.
	 */
	clone(start = 0, count = this.frames.length) {
		let selectedFrames = [];
		for (let f = start; f < Math.min(start + count, this.frames.length); f++) {
			selectedFrames.push(
				this.frames[f].clone()
			);
		}

		return new Image({
			width: this.width,
			height: this.height,
			frames: selectedFrames,
			palette: this.palette && this.palette.clone(),
			hotspotX: this.hotspotX,
			hotspotY: this.hotspotY,
			tags: { ...this.tags },
			animation: [ ...this.animation ], // TODO: ensure deep copy
		});
	}
}
