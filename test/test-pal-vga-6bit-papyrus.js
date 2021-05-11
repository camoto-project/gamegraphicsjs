/*
 * Tests specific to pal-vga-6bit-papyrus.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 *               2021 Colin Bourassa
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
import { pal_vga_6bit_papyrus as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'full',
				'index_overrun',
				'invalid_colour',
				'invalid_header',
				'minimal',
				'partial',
				'too_large',
				'too_small',
			]);
		});

		describe('identify()', function() {

			it('should reject files that overrun palette index', function() {
				const result = handler.identify(content['index_overrun'].main);
				assert.strictEqual(result.reason, 'Colour count 256 and starting index of 16 overruns VGA palette size.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files with invalid colours', function() {
				const result = handler.identify(content['invalid_colour'].main);
				assert.strictEqual(result.reason, 'Colour 0 has value > 64, not 6-bit palette.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files with invalid header', function() {
				const result = handler.identify(content['invalid_header'].main);
				assert.strictEqual(result.reason, 'First byte is nonzero.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject long files', function() {
				const result = handler.identify(content['too_large'].main);
				assert.strictEqual(result.reason, 'File length 772 does not match expected length of 771 for 256 colours.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject short files', function() {
				const result = handler.identify(content['too_small'].main);
				assert.strictEqual(result.reason, 'File length 5 is smaller than minimum for this type (6).');
				assert.strictEqual(result.valid, false);
			});

			it('should handle minimal (1-color) files', function() {
				const result = handler.identify(content['minimal'].main);
				assert.strictEqual(result.valid, true);
			});

			it('should handle partial (< 256 color) files', function() {
				const result = handler.identify(content['partial'].main);
				assert.strictEqual(result.valid, true);
			});

			it('should handle full (256 color) files', function() {
				const result = handler.identify(content['full'].main);
				assert.strictEqual(result.valid, true);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
