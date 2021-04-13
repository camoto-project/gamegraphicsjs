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

import Image from '../interface/image.js';
import { imageCompose } from './image-compose.js';

/**
 * Draw a list of images one after another left-to-right, top-to-bottom.
 * All images must be the same dimensions.
 *
 * @param {Array<Image>} tiles
 *   List of images to draw.
 *
 * @param {Number} width
 *   Number of tiles to draw horizontally before moving to the next row.
 *
 * @return Image.
 */
export function imageFromTileset(tiles, width)
{
	let imageList = [], x = 0, y = 0, yMax = 0;
	for (let t = 0; t < tiles.length; t++) {
		if ((t > 0) && (t % width === 0)) {
			// Wrap to the next line.
			y += yMax;
			yMax = 0;
			x = 0;
		}

		imageList.push({
			frame: tiles[t],
			pos: { x, y },
		});

		x += tiles[t].dims.x;
		yMax = Math.max(yMax, tiles[t].dims.y);
	}

	return imageCompose(imageList);
}

/**
 * Split an image into multiple smaller images, all the same size.
 * Undoes the effect of imageFromTileset().
 */
export function tilesetFromImage(frame, originalFrames, bg = 0)
{
	if (!(frame instanceof Image)) {
		throw new Error(`Bad parameter: tilesetFromImage() expects Image instance `
			+ `as first parameter, got ${typeof frame}.`);
	}

	let tiles = [], tx = 0, ty = 0, yMax = 0;
	for (let t = 0; t < originalFrames.length; t++) {
		const dims = originalFrames[t].dims;

		if (tx + dims.x > frame.dims.x) {
			// Wrap to the next line.
			ty += yMax;
			yMax = 0;
			tx = 0;
		}

		let pixels = new Uint8Array(dims.x * dims.y);
		pixels.fill(bg);

		// Copy all the rows for this tile.
		for (let y = 0; y < dims.y; y++) {
			const offSrc = (ty + y) * frame.dims.x + tx;
			const offDst = y * dims.x;
			if (frame.pixels.byteOffset + offSrc + dims.x > frame.pixels.length) {
				throw new Error(`Pixel data for tile ${t} row ${y} runs past the end of the source image.`);
			}
			const bufSrc = new Uint8Array(
				frame.pixels.buffer,
				frame.pixels.byteOffset + offSrc,
				dims.x
			);
			pixels.set(bufSrc, offDst);
		}
		let img = new Image(
			dims,
			pixels,
			frame.palette,
		);
		tiles.push(img);

		tx += dims.x;
		yMax = Math.max(yMax, dims.y);
	}

	return tiles;
}
