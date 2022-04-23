/*
 * Tests specific to img-rol-v2.
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
import {
	Image_Rol_V2 as handler
} from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'tooshort-a',
				'tooshort-b',
				'zeroframes',
				'badheader',
				'toolong',
			]);
		});

		describe('identify()', function() {

			it('should reject files whose size falls below the minimum possible', function() {
				const result = handler.identify(content['tooshort-a'].main);
				assert.strictEqual(result.reason, 'File size is smaller than minimum possible size for one 0x0 frame.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files whose size falls below the minimum for the frame count', function() {
				const result = handler.identify(content['tooshort-b'].main);
				assert.strictEqual(result.reason, 'Content too short for frame count.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files with zero frames', function() {
				const result = handler.identify(content['zeroframes'].main);
				assert.strictEqual(result.reason, 'Zero-frame ROL files are not supported.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files with a header size not on 4-byte boundary', function() {
				const result = handler.identify(content['badheader'].main);
				assert.strictEqual(result.reason, 'Header size not on 4-byte boundary.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files with a frame that starts beyond the file contents', function() {
				const result = handler.identify(content['toolong'].main);
				assert.strictEqual(result.reason, 'File 1 @ offset 24 starts beyond the end of the archive.');
				assert.strictEqual(result.valid, false);
			});

		}); // identify()

	}); // I/O

}); // Extra tests
