/*
 * Compose a frame by overlaying multiple other frames in a grid layout.
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

import Image from '../interface/image.js';
import Frame from '../interface/frame.js';
import { frameCompose } from './frame-compose.js';

/**
 * Draw a list of image frames one after another left-to-right, top-to-bottom.
 * All frames must be the same dimensions.
 *
 * @param {Image} image
 *   List of image frames to draw.
 *
 * @param {Number} width
 *   Number of tiles to draw horizontally before moving to the next row.
 *
 * @return Image.
 */
export function frameFromTileset(image, width)
{
	let frameList = [], x = 0, y = 0, yMax = 0;
	for (let f = 0; f < image.frames.length; f++) {
		if ((f > 0) && (f % width === 0)) {
			// Wrap to the next line.
			y += yMax;
			yMax = 0;
			x = 0;
		}

		frameList.push({
			frame: image.frames[f],
			offsetX: x,
			offsetY: y,
		});

		const frameWidth = (image.frames[f].width === undefined) ? image.width : image.frames[f].width;
		const frameHeight = (image.frames[f].height === undefined) ? image.height : image.frames[f].height;
		x += frameWidth;
		yMax = Math.max(yMax, frameHeight);
	}

	return frameCompose(frameList);
}

/**
 * Split a frame into multiple smaller frames, all the same size.
 * Undoes the effect of imageFromTileset().
 */
export function tilesetFromFrame(frame, originalImage, bg = 0)
{
	if (!(frame instanceof Frame)) {
		throw new Error(`Bad parameter: tilesetFromFrame() expects Frame instance `
			+ `as first parameter, got ${typeof frame}.`);
	}

	let tiles = [], tx = 0, ty = 0, yMax = 0;
	for (let f = 0; f < originalImage.frames.length; f++) {
		const tileWidth = (originalImage.frames[f].width === undefined) ? originalImage.width : originalImage.frames[f].width;
		const tileHeight = (originalImage.frames[f].height === undefined) ? originalImage.height : originalImage.frames[f].height;

		if (tx + tileWidth > frame.width) {
			// Wrap to the next line.
			ty += yMax;
			yMax = 0;
			tx = 0;
		}

		let pixels = new Uint8Array(tileWidth * tileHeight);
		pixels.fill(bg);

		// Copy all the rows for this tile.
		for (let y = 0; y < tileHeight; y++) {
			const offSrc = (ty + y) * frame.width + tx;
			const offDst = y * tileWidth;
			if (frame.pixels.byteOffset + offSrc + tileWidth > frame.pixels.length) {
				throw new Error(`Pixel data for tile ${f} row ${y} runs past the end of the source image.`);
			}
			const bufSrc = new Uint8Array(
				frame.pixels.buffer,
				frame.pixels.byteOffset + offSrc,
				tileWidth
			);
			pixels.set(bufSrc, offDst);
		}
		let img = new Frame({
			width: tileWidth,
			height: tileHeight,
			pixels,
		});
		tiles.push(img);

		tx += tileWidth;
		yMax = Math.max(yMax, tileHeight);
	}

	return new Image({
		frames: tiles,
		palette: frame.palette,
	});
}
