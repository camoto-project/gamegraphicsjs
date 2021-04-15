/*
 * Conversion functions for packed linear image data.
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
const debug = Debug.extend('frame-linear_packed');

import { BitStream, BitView } from 'bit-buffer';

/**
 * Convert packed linear pixel data to 8bpp unpacked.
 *
 * This is used to read mono, CGA and EGA data.
 *
 * @param {Number} bitDepth
 *   Plane count, e.g. `4` for 16-colour, `5` for 16-colour masked.
 *
 * @param {boolean} byteOrderMSB
 *   `true` if the most significant bit in each byte is the left-most pixel,
 *   `false` if the least significant bit is the left-most pixel.
 *
 * @return {Uint8Array} 8bpp linear pixel data.
 */
export function fromPacked({ content, width, height, bitDepth, widthBits, byteOrderMSB })
{
	// Shortcut for 0x0 frame.
	if (content.length === 0) {
		return new Uint8Array(0);
	}

	let bs = new BitStream(
		new BitView(content.buffer, content.byteOffset, content.byteLength)
	);
	bs.bigEndian = byteOrderMSB;

	const targetWidthPixels = widthBits / bitDepth; // used to pad up to next byte
	const targetLengthBytes = width * height;

	let out = new Uint8Array(targetLengthBytes);
	let outPos = 0, x = 0;
	while ((bs.bitsLeft >= bitDepth) && (outPos < targetLengthBytes)) {
		if (x >= width) {
			bs.index += bitDepth * (targetWidthPixels - width);
			x = 0;
		} else {
			out[outPos++] = bs.readBits(bitDepth, false);
			x++;
		}
	}

	if (outPos != targetLengthBytes) {
		throw new Error(`Wrote ${outPos} bytes but should have written ${targetLengthBytes} bytes.`);
	}
	return out;
}

/**
 * Convert linear pixel data to packed linear.
 *
 * This is used to produce mono, CGA and EGA compatible non-planar data.
 *
 * The parameters are the same as for fromLinear().
 *
 * @return {Uint8Array} 1/2/4/8bpp linear pixel data.
 */
export function toPacked({ content, width, height, bitDepth, widthBits, byteOrderMSB })
{
	// Shortcut for 0x0 frame.
	if (content.length === 0) {
		return new Uint8Array(0);
	}

	const targetWidthPixels = widthBits / bitDepth; // used to pad up to next byte
	const targetLengthBytes = Math.ceil(widthBits * height / 8);

	let out = new ArrayBuffer(targetLengthBytes);
	let bs = new BitStream(out);
	bs.bigEndian = byteOrderMSB;

	let inPos = 0, x = 0;
	while (inPos < content.length) {
		if (x >= width) {
			// Pad the end of the line up to the end of the byte.
			bs.writeBits(0, bitDepth * (targetWidthPixels - width));
			x = 0;
		} else {
			bs.writeBits(content[inPos++], bitDepth);
			x++;
		}
	}

	// Write zero bits until the next byte boundary.
	const bitsLeft = (8 - (bs.index % 8)) % 8;
	if (bitsLeft) bs.writeBits(0, bitsLeft);

	if (bs.byteIndex != targetLengthBytes) {
		throw new Error(`Wrote ${bs.byteIndex} bytes but should have written ${targetLengthBytes} bytes.`);
	}
	return new Uint8Array(out, 0, bs.byteIndex);
}
