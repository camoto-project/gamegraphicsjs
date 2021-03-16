/*
 * Tests specific to tls-ddave-vga.
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
import { tls_ddave_vga as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('Real game files (if present)', function() {

		before('load game files from local filesystem', function() {
			try {
				content = testutil.loadDirect(handler, [
					'vgadave.dav',
				]);
			} catch (e) {
				// If the game files can't be found just skip the tests, so we don't
				// break them just because we don't distribute game files with the code.
				console.log(`Skipping ${md.id} tests against real game data because:`, e.message);
				this.skip();
			}
		});

		describe('identify()', function() {

			it(`should recognise original file`, function() {
				const result = handler.identify(
					content['vgadave.dav'].main,
					content['vgadave.dav'].main.filename
				);
				assert.equal(result.valid, true);
				assert.equal(result.reason, 'All checks passed.');
			});

		}); // identify()

		describe('read()', function() {

			it(`check image data for some tiles`, function() {
				const frames = handler.read(content['vgadave.dav']);

				assert.equal(frames[1].dims.x, 16);
				assert.equal(frames[1].dims.y, 16);
				assert.equal(TestUtil.hash(frames[1].pixels), 'ObIbMbCFRL7882dsitHoAhz9xbY=');
			});

		}); // read()

		describe('write()', function() {

			it(`rewrite original unchanged`, function() {
				const frames = handler.read(content['vgadave.dav']);
				const generated = handler.write(frames);

				assert.equal(
					TestUtil.hash(generated.content.main),
					TestUtil.hash(content['vgadave.dav'].main)
				);
			});

		}); // read()

	}); // Real game files

}); // Extra tests
