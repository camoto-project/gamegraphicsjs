/*
 * Tests specific to img-gif-87a.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 * Copyright (C) 2022 Colin Bourassa
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
	Image_Gif87a as handler
} from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'incomplete-header',
				'bad-magic-word',
				'too-short-for-global-color',
				'unexpected-extension',
				'invalid-initial-code-size',
				'no-image-data',
			]);
		});

		describe('identify()', function() {

			it('should reject files that do not start with the required magic word', function() {
				const result = handler.identify(content['bad-magic-word'].main);
				assert.strictEqual(result.reason, `Header magic word not found.`);
				assert.strictEqual(result.valid, false);
			});

			it('should reject files that are smaller than the minimal header info', function() {
				const result = handler.identify(content['incomplete-header'].main);
				assert.strictEqual(result.reason, `File size is smaller than minimal header information.`);
				assert.strictEqual(result.valid, false);
			});

			it('should reject files that are too short to contain the claimed global color table', function() {
				const result = handler.identify(content['too-short-for-global-color'].main);
				assert.strictEqual(result.reason, `File size too small to contain claimed global color table.`);
				assert.strictEqual(result.valid, false);
			});

			it('should reject files that contain GIF extensions', function() {
				const result = handler.identify(content['unexpected-extension'].main);
				assert.strictEqual(result.reason, `File contains an extension, which is not supported.`);
				assert.strictEqual(result.valid, false);
			});

			it('should reject files that attempt to use an invalid LZW initial code size', function() {
				const result = handler.identify(content['invalid-initial-code-size'].main);
				assert.strictEqual(result.reason, `LZW minimum code size (13) is outside valid range for GIF (2 to 12).`);
				assert.strictEqual(result.valid, false);
			});

			it('should reject files that do not contain data for at least one image frame', function() {
				const result = handler.identify(content['no-image-data'].main);
				assert.strictEqual(result.reason, `File ends without containing at least one image data block.`);
				assert.strictEqual(result.valid, false);
			});

		}); //identify()

	}); // I/O

}); // Extra tests