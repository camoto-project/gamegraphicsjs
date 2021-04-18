/*
 * Tests for util/image-from_tileset.js.
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
import Frame from '../interface/frame.js';
import { frameFromTileset, tilesetFromFrame } from '../util/frame-from_tileset.js';

function runTest(msg, { tiles, image: srcimage, width, bg }) {
	describe(msg, function() {

		function createImage(tiles) {
			let frames = [];
			for (const t of tiles) {
				frames.push(
					new Frame({
						width: t.width,
						height: t.height,
						pixels: Uint8Array.from(t.pixels),
					})
				);
			}

			return new Image({
				frames,
			});
		}
		const imgTiles = createImage(tiles);

		it('frameFromTileset()', function() {
			const actual = frameFromTileset(
				imgTiles,
				width
			);
			TestUtil.buffersEqual(srcimage.pixels, actual.pixels);
			assert.equal(actual.width, srcimage.width, `Mismatch in composed tileset image width`);
			assert.equal(actual.height, srcimage.height, `Mismatch in composed tileset image height`);
		});

		it('tilesetFromFrame()', function() {
			const tileDims = imgTiles.frames.map(f => ({
				width: f.width,
				height: f.height,
			}));
			const actual = tilesetFromFrame({
				frame: new Frame({
					width: srcimage.width,
					height: srcimage.height,
					pixels: Uint8Array.from(srcimage.pixels),
				}),
				frameWidth: srcimage.width,
				tileDims,
				bg,
			});

			for (let i = 0; i < tiles.length; i++) {
				TestUtil.buffersEqual(imgTiles.frames[i].pixels, actual[i].pixels);
				assert.equal(imgTiles.frames[i].width, actual[i].width);
				assert.equal(imgTiles.frames[i].height, actual[i].height);
			}
			assert.equal(imgTiles.frames.length, actual.length);
		});

	});
}

describe(`Tests for util/image-from_tileset`, function() {
	runTest(
		`should handle same sized tiles`,
		{
			tiles: [
				{
					width: 2,
					height: 2,
					pixels: [ 0xFF, 0x70, 0x3F, 0x18 ],
				},
				{
					width: 2,
					height: 2,
					pixels: [ 0x02, 0x02, 0x02, 0x02 ],
				},
				{
					width: 2,
					height: 2,
					pixels: [ 0x30, 0x31, 0x32, 0x33 ],
				},
				{
					width: 2,
					height: 2,
					pixels: [ 0x40, 0x41, 0x42, 0x43 ],
				},
			],
			width: 2,
			image: {
				width: 4,
				height: 4,
				pixels: [
					0xFF, 0x70,  0x02, 0x02,
					0x3F, 0x18,  0x02, 0x02,

					0x30, 0x31,  0x40, 0x41,
					0x32, 0x33,  0x42, 0x43,
				],
			},
		}
	);

	runTest(
		`should handle uneven tiles`,
		{
			tiles: [
				{
					width: 3,
					height: 2,
					pixels: [ 0x10, 0x11, 0x12, 0x13, 0x14, 0x15 ],
				},
				{
					width: 2,
					height: 2,
					pixels: [ 0x20, 0x21, 0x22, 0x23 ],
				},
				{
					width: 2,
					height: 2,
					pixels: [ 0x30, 0x31, 0x32, 0x33 ],
				},
				{
					width: 1,
					height: 4,
					pixels: [ 0x40, 0x41, 0x42, 0x43 ],
				},
			],
			width: 2,
			image: {
				width: 5,
				height: 6,
				pixels: [
					0x10, 0x11, 0x12,  0x20, 0x21,
					0x13, 0x14, 0x15,  0x22, 0x23,

					0x30, 0x31,  0x40,  0x00, 0x00,
					0x32, 0x33,  0x41,  0x00, 0x00,
					0x00, 0x00,  0x42,  0x00, 0x00,
					0x00, 0x00,  0x43,  0x00, 0x00,
				],
			},
		}
	);

});
