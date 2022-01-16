/*
 * Tests specific to tls-quarantine-spr.
 *
 * Copyright (C) 2010-2022 Adam Nielsen <malvineous@shikadi.net>
 *               2022 Colin Bourassa
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
import { tls_quarantine_spr as handler } from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'tooshort-a',
				'zerotiles',
				'tooshort-b',
				'tooshort-c',
				'threetile',
				'toolong',
			]);
		});

		describe('identify()', function() {

			it('should reject files whose size falls below the minimum possible', function() {
				const result = handler.identify(content['tooshort-a'].main);
				assert.strictEqual(result.reason, 'File size is smaller than minimum possible size for one 0x0 tile.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files whose header claims a count of zero tiles', function() {
				const result = handler.identify(content['zerotiles'].main);
				assert.strictEqual(result.reason, 'SPR files with no tiles are not supported.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files whose size falls below the minimum for the tile count', function() {
				const result = handler.identify(content['tooshort-b'].main);
				assert.strictEqual(result.reason, 'Content too short to cover header size for 3 tiles.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files with insufficient data to cover the tile sizes', function() {
				const result = handler.identify(content['tooshort-c'].main);
				assert.strictEqual(result.reason, 'Content length of 38 does not exactly match expected size of 39.');
				assert.strictEqual(result.valid, false);
			});

			it('should reject files with too much data for the tile sizes', function() {
				const result = handler.identify(content['toolong'].main);
				assert.strictEqual(result.reason, 'Content length of 40 does not exactly match expected size of 39.');
				assert.strictEqual(result.valid, false);
			});

		}); // identify()

		describe('read()', function() {

			it('should read the correct number of tiles', function() {
				const sprSet = handler.read(content['threetile']);
				assert.strictEqual(sprSet.length, 3);
			});

		}); // read()

	}); // I/O

}); // Extra tests
