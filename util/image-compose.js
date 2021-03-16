/*
 * Compose an image from overlaying multiple other images.
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

import Debug from '../util/debug.js';
const debug = Debug.extend('image-planar');

import Image from '../interface/image.js';

/**
 * Draw a selection of images onto a transparent canvas.
 *
 * @param {Array<Object>} composition
 *   List of images to draw.  An array of:
 *   {
 *     frame: Image instance,
 *     pos: {
 *       x: Horizontal coordinate to draw image,
 *       y: Vertical coordinate to draw image,
 *     },
 *   }
 *   Images are drawn from (0,0), i.e. the hotspot is ignored.
 *
 * @return Image.
 */
export function imageCompose(composition)
{
	let width = 0, height = 0;
	for (const c of composition) {
		const cx = c.pos.x + c.frame.dims.x;
		const cy = c.pos.y + c.frame.dims.y;
		width = Math.max(width, cx);
		height = Math.max(height, cy);
	}
	debug(`Final size: (${width},${height})`);

	let bg = 0;
	const palette = composition[0].frame.palette;
	if (palette) {
		for (const p of palette) {
			if (p.alpha === 0) {
				// Found a transparent colour, use that for the background.
				bg = p;
				break;
			}
		}
	}

	let pixels = new Uint8Array(width * height).fill(bg);

	for (const c of composition) {
		for (let y = 0; y < c.frame.dims.y; y++) {
			const offSrc = y * c.frame.dims.x;
			const offDst = (c.pos.y + y) * width + c.pos.x;
			const bufSrc = new Uint8Array(
				c.frame.pixels.buffer,
				c.frame.pixels.byteOffset + offSrc,
				c.frame.dims.x
			);
			// Copy pixel data over the top, overwriting opaque pixels with
			// transparent ones.
			pixels.set(bufSrc, offDst);
			// TODO: Alternate method that ignores transparent pixels in bufSrc.
		}
	}

	return new Image(
		{ x: width, y: height },
		pixels,
		palette,
	);
}
