/*
 * Tests specific to img-png.
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
import { img_png as handler, Image, Palette, defaultPalette } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

function genImage(depth)
{
	let pixels = new Array(16 * 16);
	const pixelCutoff = 1 << depth;
	for (let i = 0; i < 16 * 16; i++) {
		pixels[i] = i % pixelCutoff;
	}

	return new Image({x: 16, y: 16}, pixels, defaultPalette(depth));
}

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'16x16c2',
				'16x16c4',
				'16x16c16',
				'16x16c256',
			]);
		});

		describe('read()', function() {

			for (const depth of [1, 2, 4, 8]) {
				it(`should handle ${depth}-bit images`, function() {
					const img = genImage(depth);
					const contentGenerated = handler.write(img);
					TestUtil.contentEqual(content[`16x16c${1 << depth}`], contentGenerated);
				});
			}

		}); // read()

	}); // I/O

}); // Extra tests
