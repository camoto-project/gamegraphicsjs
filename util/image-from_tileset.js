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
	const { x: tileWidth, y: tileHeight } = tiles[0].dims;

	let imageList = [];
	for (let t = 0; t < tiles.length; t++) {
		imageList.push({
			frame: tiles[t],
			pos: {
				x: (t % width) * tileWidth,
				y: Math.floor(t / width) * tileHeight,
			},
		});
	}

	return imageCompose(imageList);
}

/**
 * Split an image into multiple smaller images, all the same size.
 * Undoes the effect of imageFromTileset().
 */
export function tilesetFromImage(frame, tileDimensions, tileCount, bg = 0)
{
	let tiles = [];
	for (let ty = 0; ty < frame.dims.y; ty += tileDimensions.y) {
		for (let tx = 0; tx < frame.dims.x; tx += tileDimensions.x) {
			let pixels = new Uint8Array(tileDimensions.x * tileDimensions.y);
			pixels.fill(bg);

			// Copy all the rows for this tile.
			for (let y = 0; y < tileDimensions.y; y++) {
				const offSrc = (ty + y) * frame.dims.x + tx;
				const offDst = y * tileDimensions.x;
				const bufSrc = new Uint8Array(
					frame.pixels.buffer,
					frame.pixels.byteOffset + offSrc,
					tileDimensions.x
				);
				pixels.set(bufSrc, offDst);
			}
			let img = new Image(
				tileDimensions,
				pixels,
				frame.palette,
			);
			tiles.push(img);

			// Abort if we have reached the required number of tiles.
			if (tiles.length >= tileCount) break;
		}
	}

	return tiles;
}
