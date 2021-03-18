/*
 * Conversion functions for byte-planar image data.
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

/**
 * Convert packed planar pixel data to linear.
 *
 * This is used to read mono, CGA and EGA data.
 *
 * @param {Number} planeCount
 *   Plane count, e.g. `4` for 16-colour, `5` for 16-colour masked.
 *
 * @param {Number} planeWidth
 *   Width of each plane in pixels.  `8` for byte-planar data (switch to the
 *   next plane after every 8 pixels), set to image width in pixels for
 *   row-planar data (switch to next plane after each row).
 *
 * @param {Array<Number>} planeValues
 *   Output value for each plane, e.g. `[1, 2, 4, 8]` for BGRI plane order, or
 *   `[16, 8, 4, 2, 1]` for MIRGB plane order.  Number of entries must match
 *   `planeCount`.
 *
 * @param {boolean} byteOrderMSB
 *   `true` if the most significant bit in each byte is the left-most pixel,
 *   `false` if the least significant bit is the left-most pixel.
 *
 * @return {Uint8Array} 8bpp linear pixel data.
 */
export function fromPlanar({ content, planeCount, planeWidth, planeValues, byteOrderMSB })
{
	// Shortcut for 0x0 image.
	if (content.length === 0) {
		return new Uint8Array(0);
	}

	let out = new Uint8Array(content.length * 8 / planeCount);
	let outpos = 0;
	const widthBytes = Math.ceil(planeWidth / 8);
	if (widthBytes <= 0) {
		throw new Error(`fromPlanar() planeWidth=${planeWidth} too small!`);
	}
	for (let i = 0; i < content.length; i += widthBytes) {
		const plane = (i / widthBytes) % planeCount;
		for (let b = 0; b < planeWidth; b++) {
			const srcByteOffset = (b / 8) >>> 0;
			const srcBit = byteOrderMSB ? (7 - (b % 8)) : b % 8;
			const data = content[i + srcByteOffset];
			const value = ((data >> srcBit) & 1) && planeValues[plane];
			out[outpos + b] |= value;
		}
		if (plane === planeCount - 1) outpos += planeWidth;
	}

	return out;
}

/**
 * Convert linear pixel data to packed planar.
 *
 * This is used to produce mono, CGA and EGA compatible data.
 *
 * The parameters are the same as for fromPlanar().
 *
 * @return {Uint8Array} 1/2/4/8bpp planar pixel data.
 */
export function toPlanar({ content, planeCount, planeWidth, planeValues, byteOrderMSB })
{
	// Shortcut for 0x0 image.
	if (content.length === 0) {
		return new Uint8Array(0);
	}

	let out = new Uint8Array(content.length * planeCount / 8);
	let outpos = 0;
	const widthBytes = Math.ceil(planeWidth / 8);
	for (let i = 0; i < content.length; i++) {
		const pixelByte = ((i / 8) >> 0) % widthBytes;
		const pixelBit = byteOrderMSB ? 7 - (i % 8) : (i % 8);
		const data = content[i];
		for (let b = 0; b < planeCount; b++) {
			const val = (data & planeValues[b]) && (1 << pixelBit);
			out[outpos + pixelByte + b * widthBytes] |= val;
		}
		if ((i % planeWidth) === planeWidth - 1) outpos += planeCount * widthBytes;
	}

	return out;
}
