/*
 * Tests specific to img-stp-v1.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 * Copyright (C) 2021 Colin Bourassa
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
	img_stp_v1 as handler
} from '../index.js';

const md = handler.metadata();
let testutil = new TestUtil(md.id);

describe(`Extra tests for ${md.title} [${md.id}]`, function() {
	let content = {};

	describe('I/O', function() {

		before('load test data from local filesystem', function() {
			content = testutil.loadContent(handler, [
				'7x7-toobig',
				'7x7-toosmall',
			]);
		});

		describe('read()', function() {

			it('should reject files that do not have sufficient data for their declared size', function() {
				assert.throws(function() {
					handler.read(content['7x7-toosmall']);
				}, Error,
				`Ran out of input data before full frame size was constructed.`);
			});

			it('should reject files that have extra data beyond their declared size', function() {
				assert.throws(function() {
					handler.read(content['7x7-toobig']);
				}, Error,
				`Extraneous input data; frame is complete with input data remaining.`);
			});

		}); // read()

	}); // I/O

}); // Extra tests
