/*
 * Tests for util/image-mask.js.
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

import assert from 'assert';
import TestUtil from './util.js';
import Image from '../interface/image.js';
import { imageFromMask, maskFromImage } from '../util/image-mask.js';

function runTest(msg, { pixelsVisible, pixelsMask, fnFromMask, pixelsCombined, fnToMask }) {
	describe(msg, function() {

		const imgVisible = new Image(
			{x: pixelsVisible.length, y: 1},
			Uint8Array.from(pixelsVisible)
		);
		const imgMask = new Image(
			{x: pixelsMask.length, y: 1},
			Uint8Array.from(pixelsMask)
		);
		const imgCombined = new Image(
			{x: pixelsCombined.length, y: 1},
			Uint8Array.from(pixelsCombined)
		);

		it('imageFromMask()', function() {
			const actual = imageFromMask({
				imgVisible,
				imgMask,
				cb: fnFromMask,
			});
			TestUtil.buffersEqual(pixelsCombined, actual.pixels);
			assert.equal(imgVisible.dims.x, actual.dims.x);
			assert.equal(imgVisible.dims.y, actual.dims.y);
		});

		it('maskFromImage()', function() {
			const { imgVisible: actualVisible, imgMask: actualMask } = maskFromImage({
				img: imgCombined,
				cb: fnToMask,
			});
			TestUtil.buffersEqual(pixelsVisible, actualVisible.pixels);
			TestUtil.buffersEqual(pixelsMask, actualMask.pixels);
			assert.equal(imgCombined.dims.x, actualVisible.dims.x);
			assert.equal(imgCombined.dims.y, actualVisible.dims.y);
			assert.equal(imgCombined.dims.x, actualMask.dims.x);
			assert.equal(imgCombined.dims.y, actualMask.dims.y);
		});

	});
}

describe(`Tests for util/image-mask`, function() {
	runTest(
		`should handle simple mask`,
		{
			pixelsVisible: [
				0x10, 0x00, 0x12, 0x00,
			],
			pixelsMask: [
				0x00, 0xFF, 0x00, 0xFF,
			],
			fnFromMask: (v, m) => (
				// Return 0xFF if the mask is 0xFF otherwise use the visible pixel.
				(m === 0xFF) ? 0xFF : v
			),
			pixelsCombined: [
				0x10, 0xFF, 0x12, 0xFF,
			],
			fnToMask: p => ([
				// Set the visible pixel to itself, unless it's 0xFF in which case set
				// it to 0x00 instead.
				p === 0xFF ? 0x00 : p,
				// Set the mask to 0xFF if the pixel is 0xFF, otherwise set it to 0x00.
				p === 0xFF ? 0xFF : 0x00,
			]),
		}
	);

});
