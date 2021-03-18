/*
 * Tests for util/image-linear_packed.js.
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

import TestUtil from './util.js';
import { fromPacked, toPacked } from '../util/image-linear_packed.js';

function runTest(msg, { packed, linear, bitDepth, widthPixels, widthBits, isMSB }) {
	describe(msg, function() {

		it('fromPacked()', function() {
			const actual = fromPacked({
				content: Uint8Array.from(packed),
				bitDepth,
				widthPixels,
				widthBits,
				byteOrderMSB: isMSB,
			});
			TestUtil.buffersEqual(linear, actual);
		});

		it('toPacked()', function() {
			const actual = toPacked({
				content: Uint8Array.from(linear),
				bitDepth,
				widthPixels,
				widthBits,
				byteOrderMSB: isMSB,
			});
			TestUtil.buffersEqual(packed, actual);
		});

	});
}

describe(`Extra tests for util/image-packed`, function() {
	runTest(
		`should handle 4bpp linear data (8x1)`,
		{
			packed: [
				0x13, 0x7F, 0xD5, 0x55,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
			],
			bitDepth: 4,
			widthPixels: 8,
			widthBits: 32,
			isMSB: true,
		}
	);

	runTest(
		`should handle 4bpp linear data (8x2)`,
		{
			packed: [
				0x13, 0x7F, 0xD5, 0x55,
				0x65, 0x65, 0x65, 0x6D,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
				0x06, 0x05, 0x06, 0x05, 0x06, 0x05, 0x06, 0x0D,
			],
			bitDepth: 4,
			widthPixels: 8,
			widthBits: 32,
			isMSB: true,
		}
	);

	runTest(
		`should handle 4bpp linear data (16x1)`,
		{
			packed: [
				0x13, 0x7F, 0xD5, 0x55, 0x65, 0x65, 0x65, 0x6D,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
				0x06, 0x05, 0x06, 0x05, 0x06, 0x05, 0x06, 0x0D,
			],
			bitDepth: 4,
			widthPixels: 16,
			widthBits: 64,
			isMSB: true,
		}
	);

	runTest(
		`should handle 4bpp linear data (16x2)`,
		{
			packed: [
				0x13, 0x7F, 0xD5, 0x55, 0x65, 0x65, 0x65, 0x6D,
				0x21, 0x21, 0x84, 0x84, 0x12, 0x12, 0x48, 0x48,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
				0x06, 0x05, 0x06, 0x05, 0x06, 0x05, 0x06, 0x0D,
				0x02, 0x01, 0x02, 0x01, 0x08, 0x04, 0x08, 0x04,
				0x01, 0x02, 0x01, 0x02, 0x04, 0x08, 0x04, 0x08,
			],
			bitDepth: 4,
			widthPixels: 16,
			widthBits: 64,
			isMSB: true,
		}
	);

	runTest(
		`should handle 2bpp linear data (8x1)`,
		{
			packed: [
				0x13, 0x7F,
			],
			linear: [
				0x00, 0x01, 0x00, 0x03, 0x01, 0x03, 0x03, 0x03,
			],
			bitDepth: 2,
			widthPixels: 8,
			widthBits: 16,
			isMSB: true,
		}
	);

	runTest(
		`should handle 2bpp linear data (8x2)`,
		{
			packed: [
				0x13, 0x7F,
				0xD5, 0x55,
			],
			linear: [
				0x00, 0x01, 0x00, 0x03, 0x01, 0x03, 0x03, 0x03,
				0x03, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
			],
			bitDepth: 2,
			widthPixels: 8,
			widthBits: 16,
			isMSB: true,
		}
	);

	runTest(
		`should handle MSB linear data (8x1)`,
		{
			packed: [
				0x14, 0x00, 0x00, 0x82,
			],
			linear: [
				0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02,
			],
			bitDepth: 4,
			widthPixels: 8,
			widthBits: 32,
			isMSB: true,
		}
	);

	runTest(
		`should handle LSB linear data (8x1)`,
		{
			packed: [
				0x82, 0x00, 0x00, 0x14,
			],
			linear: [
				0x02, 0x08, 0x00, 0x00, 0x00, 0x00, 0x04, 0x01,
			],
			bitDepth: 4,
			widthPixels: 8,
			widthBits: 32,
			isMSB: false,
		}
	);

	runTest(
		`should handle 2bpp LSB data (8x1)`,
		{
			packed: [
				0x13, 0x7F,
			],
			linear: [
				0x03, 0x00, 0x01, 0x00, 0x03, 0x03, 0x03, 0x01,
			],
			bitDepth: 2,
			widthPixels: 8,
			widthBits: 16,
			isMSB: false,
		}
	);


	runTest(
		`should handle 2bpp MSB linear data (8x2)`,
		{
			packed: [
				0xE4, 0x5A,
				0x1B, 0xF5,
			],
			linear: [
				0x00, 0x01, 0x02, 0x03, 0x02, 0x02, 0x01, 0x01,
				0x03, 0x02, 0x01, 0x00, 0x01, 0x01, 0x03, 0x03,
			],
			bitDepth: 2,
			widthPixels: 8,
			widthBits: 16,
			isMSB: false,
		}
	);

	runTest(
		`should handle 4bpp padded rows (7x1)`,
		{
			packed: [
				0x28, 0x65, 0x31, 0x40,
			],
			linear: [
				0x02, 0x08, 0x06, 0x05, 0x03, 0x01, 0x04,
			],
			bitDepth: 4,
			widthPixels: 7,
			widthBits: 32,
			isMSB: true,
		}
	);

	runTest(
		`should handle 4bpp padded rows (7x2)`,
		{
			packed: [
				0x28, 0x65, 0x31, 0x40,
				0x79, 0x43, 0x26, 0x50,
			],
			linear: [
				0x02, 0x08, 0x06, 0x05, 0x03, 0x01, 0x04,
				0x07, 0x09, 0x04, 0x03, 0x02, 0x06, 0x05,
			],
			bitDepth: 4,
			widthPixels: 7,
			widthBits: 32,
			isMSB: true,
		}
	);

	runTest(
		`should handle 2bpp padded rows (7x2)`,
		{
			packed: [
				0x8D, 0xD8,
				0x93, 0xB4,
			],
			linear: [
				0x02, 0x00, 0x03, 0x01, 0x03, 0x01, 0x02,
				0x02, 0x01, 0x00, 0x03, 0x02, 0x03, 0x01,
			],
			bitDepth: 2,
			widthPixels: 7,
			widthBits: 16,
			isMSB: true,
		}
	);

}); // Extra tests
