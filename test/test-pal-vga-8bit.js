/*
 * Tests specific to pal-vga-8bit.
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
import { pal_vga_8bit as handler, Image, defaultPalette } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'pal2',
				'pal4',
				'pal16',
				'pal64',
				'pal256',
			]);
		});

		describe('read()', function() {

			for (const depth of [1, 2, 4, 6, 8]) {
				it(`should handle ${depth}-bit images`, function() {
					const palExpected = defaultPalette(depth);

					const img = handler.read(content[`pal${1 << depth}`]);
					assert.ok(img.palette, 'Palette missing.');
					assert.ok(img.palette.length > 0, `Got an empty palette (${img.palette.length} entries).`);

					const numEntries = Math.max(img.palette.length, palExpected.length);
					for (let p = 0; p < numEntries; p++) {
						for (let c = 0; c < 3; c++) {
							assert.equal(
								palExpected[p][c],
								img.palette[p][c],
								`Palette entry ${p} subcomponent ${c} did not match.`
							);
						}
					}
				});
			}

		}); // read()

		describe('write()', function() {

			for (const depth of [1, 2, 4, 6, 8]) {
				it(`should handle ${depth}-bit images`, function() {
					const img = new Image({
						palette: defaultPalette(depth),
					});
					const { content: contentGenerated } = handler.write(img);
					TestUtil.contentEqual(content[`pal${1 << depth}`], contentGenerated);
				});
			}

		}); // write()

	}); // I/O

}); // Extra tests
