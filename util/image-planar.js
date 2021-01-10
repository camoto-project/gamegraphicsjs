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

/**
 * Input: 8bpp linear
 * Output: 4bpp planar packed
 *
 * @param {Number} planes
 *   Plane count.  `4` for 16-colour, `5` for 16-colour masked.
 */
export function fromBytePlanar(content, planes, byteOrderMSB)
{
	let out = new Uint8Array(content.length * 8 / planes);
	let outpos = 0;
	for (let i = 0; i < content.length; i++) {
		const plane = i % planes;
		const data = content[i];
		for (let b = 0; b < 8; b++) {
			const outb = byteOrderMSB ? (7 - b) : b;
			out[outpos + outb] |= ((data >> b) & 1) << plane;
		}
		if (plane === planes - 1) outpos += 8;
	}

	return out;
}

export function toBytePlanar(content, planes, byteOrderMSB)
{
	let out = new Uint8Array(content.length * planes / 8);
	let outpos = 0;
	for (let i = 0; i < content.length; i++) {
		const pixelBit = byteOrderMSB ? 7 - (i % 8) : (i % 8);
		const data = content[i];
		for (let b = 0; b < planes; b++) {
			const val = ((data >> b) & 1) << pixelBit;
			out[outpos + b] |= val;
		}
		if ((i % 8) === 7) outpos += planes;
	}

	return out;
}
