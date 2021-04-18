/*
 * Compose a frame by overlaying multiple other frames.
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
const debug = Debug.extend('frame-compose');

import Frame from '../interface/frame.js';

/**
 * Draw a selection of images onto a transparent canvas.
 *
 * @param {Array<Object>} composition
 *   List of frames to draw.  An array of:
 *   {
 *     frame: Frame instance,
 *     offsetX: Horizontal coordinate to draw image,
 *     offsetY: Vertical coordinate to draw image,
 *   }
 *   Frames are drawn from (0,0), i.e. the hotspot is ignored.
 *
 * @param {Object} options
 *   options.defaultWidth is the width in pixels of each frame, used if the
 *   frame itself lacks a width value.
 *
 *   options.defaultHeight is the same as defaultWidth but for height.
 *
 * @return Frame.
 */
export function frameCompose(composition, options)
{
	let width = 0, height = 0;
	for (const c of composition) {
		const cx = c.offsetX + (c.frame.width || options.defaultWidth);
		const cy = c.offsetY + (c.frame.height || options.defaultHeight);
		width = Math.max(width, cx);
		height = Math.max(height, cy);
	}
	debug(`Final size: (${width},${height})`);

	let bg = 0;
	const palette = composition[0].frame.palette;
	if (palette) {
		for (let i = 0; i < palette.length; i++) {
			if ((palette[i] === undefined) || (palette[i][3] === undefined)) {
				debug(`Palette entry ${i} is invalid.`);
				throw new Error(`Palette entry ${i} is invalid.`);
			}
			if (palette[i][3] === 0) {
				// Found a transparent colour, use that for the background.
				bg = i;
				break;
			}
		}
	}

	let pixels = new Uint8Array(width * height).fill(bg);

	for (const c of composition) {
		const frameHeight = c.frame.height || options.defaultHeight;
		const frameWidth = c.frame.width || options.defaultWidth;
		for (let y = 0; y < frameHeight; y++) {
			const offSrc = y * frameWidth;
			const offDst = (c.offsetY + y) * width + c.offsetX;
			const bufSrc = new Uint8Array(
				c.frame.pixels.buffer,
				c.frame.pixels.byteOffset + offSrc,
				frameWidth
			);
			// Copy pixel data over the top, overwriting opaque pixels with
			// transparent ones.
			pixels.set(bufSrc, offDst);
			// TODO: Alternate method that ignores transparent pixels in bufSrc.
		}
	}

	return new Frame({
		width,
		height,
		pixels,
		palette,
	});
}
