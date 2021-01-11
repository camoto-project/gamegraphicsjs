/*
 * Tests for util/image-planar.js.
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
import { fromPlanar, toPlanar } from '../util/image-planar.js';

let testutil = new TestUtil('util/image-planar');

function runTest(msg, { planar, linear, planeCount, planeWidth, isMSB, planeValues }) {
	describe(msg, function() {

		it('fromPlanar()', function() {
			const actual = fromPlanar({
				content: planar,
				planeCount,
				planeWidth,
				byteOrderMSB: isMSB,
				planeValues,
			});
			TestUtil.buffersEqual(linear, actual);
		});

		it('toPlanar()', function() {
			const actual = toPlanar({
				content: linear,
				planeCount,
				planeWidth,
				byteOrderMSB: isMSB,
				planeValues,
			});
			TestUtil.buffersEqual(planar, actual);
		});

	});
}

describe(`Extra tests for util/image-planar`, function() {
	let content = {};

	runTest(
		`should handle 4-plane byte-planar data (8x1)`,
		{
			planar: [
				0xFF, 0x70, 0x3F, 0x18,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
			],
			planeCount: 4,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle 4-plane byte-planar data (8x2)`,
		{
			planar: [
				0xFF, 0x70, 0x3F, 0x18,
				0x55, 0xAA, 0xFF, 0x01,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
				0x06, 0x05, 0x06, 0x05, 0x06, 0x05, 0x06, 0x0D,
			],
			planeCount: 4,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle 4-plane row-planar data (16x1)`,
		{
			planar: [
				0xFF, 0x55,
				0x70, 0xAA,
				0x3F, 0xFF,
				0x18, 0x01,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
				0x06, 0x05, 0x06, 0x05, 0x06, 0x05, 0x06, 0x0D,
			],
			planeCount: 4,
			planeWidth: 16,
			isMSB: true,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle 4-plane row-planar data (16x2)`,
		{
			planar: [
				0xFF, 0x55,
				0x70, 0xAA,
				0x3F, 0xFF,
				0x18, 0x01,
				0x50, 0xA0,
				0xA0, 0x50,
				0x05, 0x0A,
				0x0A, 0x05,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
				0x06, 0x05, 0x06, 0x05, 0x06, 0x05, 0x06, 0x0D,
				0x02, 0x01, 0x02, 0x01, 0x08, 0x04, 0x08, 0x04,
				0x01, 0x02, 0x01, 0x02, 0x04, 0x08, 0x04, 0x08,
			],
			planeCount: 4,
			planeWidth: 16,
			isMSB: true,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle 5-plane byte-planar data (8x1)`,
		{
			planar: [
				0xFF, 0x70, 0x3F, 0x18, 0x32,
			],
			linear: [
				0x01, 0x03, 0x17, 0x1F, 0x0D, 0x05, 0x15, 0x05,
			],
			planeCount: 5,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8, 16],
		}
	);

	runTest(
		`should handle 5-plane byte-planar data (8x2)`,
		{
			planar: [
				0xFF, 0x70, 0x3F, 0x18, 0x23,
				0x55, 0xAA, 0xFF, 0x01, 0x45,
			],
			linear: [
				0x01, 0x03, 0x17, 0x0F, 0x0D, 0x05, 0x15, 0x15,
				0x06, 0x15, 0x06, 0x05, 0x06, 0x15, 0x06, 0x1D,
			],
			planeCount: 5,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8, 16],
		}
	);

	runTest(
		`should handle 5-plane row-planar data (16x1)`,
		{
			planar: [
				0xFF, 0x55,
				0x70, 0xAA,
				0x3F, 0xFF,
				0x18, 0x01,
				0x23, 0x45,
			],
			linear: [
				0x01, 0x03, 0x17, 0x0F, 0x0D, 0x05, 0x15, 0x15,
				0x06, 0x15, 0x06, 0x05, 0x06, 0x15, 0x06, 0x1D,
			],
			planeCount: 5,
			planeWidth: 16,
			isMSB: true,
			planeValues: [1, 2, 4, 8, 16],
		}
	);

	runTest(
		`should handle 5-plane row-planar data (16x2)`,
		{
			planar: [
				0xFF, 0x55,
				0x70, 0xAA,
				0x3F, 0xFF,
				0x18, 0x01,
				0x23, 0x45,
				0x50, 0xA0,
				0xA0, 0x50,
				0x05, 0x0A,
				0x0A, 0x05,
				0x12, 0x48,
			],
			linear: [
				0x01, 0x03, 0x17, 0x0F, 0x0D, 0x05, 0x15, 0x15,
				0x06, 0x15, 0x06, 0x05, 0x06, 0x15, 0x06, 0x1D,
				0x02, 0x01, 0x02, 0x11, 0x08, 0x04, 0x18, 0x04,
				0x01, 0x12, 0x01, 0x02, 0x14, 0x08, 0x04, 0x08,
			],
			planeCount: 5,
			planeWidth: 16,
			isMSB: true,
			planeValues: [1, 2, 4, 8, 16],
		}
	);

	runTest(
		`should handle 6-plane byte-planar data (8x1)`,
		{
			planar: [
				0xFF, 0x70, 0x3F, 0x18, 0x32, 0xC6,
			],
			linear: [
				0x21, 0x23, 0x17, 0x1F, 0x0D, 0x25, 0x35, 0x05,
			],
			planeCount: 6,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8, 16, 32],
		}
	);

	runTest(
		`should handle 6-plane byte-planar data (8x2)`,
		{
			planar: [
				0xFF, 0x70, 0x3F, 0x18, 0x23, 0xF0,
				0x55, 0xAA, 0xFF, 0x01, 0x45, 0x0F,
			],
			linear: [
				0x21, 0x23, 0x37, 0x2F, 0x0D, 0x05, 0x15, 0x15,
				0x06, 0x15, 0x06, 0x05, 0x26, 0x35, 0x26, 0x3D,
			],
			planeCount: 6,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8, 16, 32],
		}
	);

	runTest(
		`should handle MSB byte-planar data (8x1)`,
		{
			planar: [
				0x80, 0x01, 0x40, 0x02,
			],
			linear: [
				0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02,
			],
			planeCount: 4,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle LSB byte-planar data (8x1)`,
		{
			planar: [
				0x80, 0x01, 0x40, 0x02,
			],
			linear: [
				0x02, 0x08, 0x00, 0x00, 0x00, 0x00, 0x04, 0x01,
			],
			planeCount: 4,
			planeWidth: 8,
			isMSB: false,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle MSB byte-planar data (8x2)`,
		{
			planar: [
				0x80, 0x01, 0x40, 0x02,
				0x08, 0x10, 0xF0, 0x0F,
			],
			linear: [
				0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02,
				0x04, 0x04, 0x04, 0x06, 0x09, 0x08, 0x08, 0x08,
			],
			planeCount: 4,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle LSB byte-planar data (8x2)`,
		{
			planar: [
				0x80, 0x01, 0x40, 0x02,
				0x08, 0x10, 0xF0, 0x0F,
			],
			linear: [
				0x02, 0x08, 0x00, 0x00, 0x00, 0x00, 0x04, 0x01,
				0x08, 0x08, 0x08, 0x09, 0x06, 0x04, 0x04, 0x04,
			],
			planeCount: 4,
			planeWidth: 8,
			isMSB: false,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle MSB row-planar data (16x1)`,
		{
			planar: [
				0x80, 0x08,
				0x01, 0x10,
				0x40, 0xF0,
				0x02, 0x0F,
			],
			linear: [
				0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02,
				0x04, 0x04, 0x04, 0x06, 0x09, 0x08, 0x08, 0x08,
			],
			planeCount: 4,
			planeWidth: 16,
			isMSB: true,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle LSB row-planar data (16x1)`,
		{
			planar: [
				0x80, 0x08,
				0x01, 0x10,
				0x40, 0xF0,
				0x02, 0x0F,
			],
			linear: [
				0x02, 0x08, 0x00, 0x00, 0x00, 0x00, 0x04, 0x01,
				0x08, 0x08, 0x08, 0x09, 0x06, 0x04, 0x04, 0x04,
			],
			planeCount: 4,
			planeWidth: 16,
			isMSB: false,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle BGRI data (8x1)`,
		{
			planar: [
				0xFF, 0x70, 0x3F, 0x18,
			],
			linear: [
				0x01, 0x03, 0x07, 0x0F, 0x0D, 0x05, 0x05, 0x05,
			],
			planeCount: 4,
			planeWidth: 8,
			isMSB: true,
			planeValues: [1, 2, 4, 8],
		}
	);

	runTest(
		`should handle RGBI data (8x1)`,
		{
			planar: [
				0xFF, 0x70, 0x3F, 0x18,
			],
			linear: [
				0x08, 0x0C, 0x0E, 0x0F, 0x0B, 0x0A, 0x0A, 0x0A,
			],
			planeCount: 4,
			planeWidth: 8,
			isMSB: true,
			planeValues: [8, 4, 2, 1],
		}
	);

}); // Extra tests
