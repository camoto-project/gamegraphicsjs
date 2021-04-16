/*
 * Test with files from the actual games.
 *
 * These files cannot be distributed with the code, so these tests are skipped
 * if the files are not present.  You will need to obtain copies of the games
 * and copy the files into their respective test folders in order to run these
 * tests.
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
import { all as allFormats } from '../index.js';

const gameFiles = {
	'img-ccomic-splash': {
		'sys000.ega': [
			'PBD6NdDg3YQ96S9KvYVZHw89B8k=',
		],
	},
	'img-raw-linear-8bpp': {
		'unlogic1.gra': [
			'FIwTzEYTeDXeLfxWIsztlvAqoNE=',
		],
	},
	'img-raw-planar-4bpp': {
		'onemomnt.mni': [
			'6gqRf6Uk4LfbO7k18vYFXuqGvhM=',
		],
	},
	'tls-ccomic-map': {
		'castle.tt2': [
			'XrxoTBlN7Y2cWbQlGCnpVsmX6pE=',
		],
	},
	'tls-ccomic-sprite': {
		'bird.shp': [
			'lRGfccg1DQ8yQ6zQw+1H0vAhyyo=',
		],
	},
	'tls-cosmo': {
		'tiles.mni': [
			'3KytfIvfaf9ggBAkdGIqiA7dxQU=',
		],
	},
	'tls-ddave-cga': {
		'cgadave.dav': [
			's3aIWshFK2y/nO2BsQgL/VcNm5E=',
			'FHrKxtWrhpxNTVFph2qjn/MeBlc=',
		],
	},
	'tls-ddave-ega': {
		'egadave.dav': [
			's3aIWshFK2y/nO2BsQgL/VcNm5E=',
			'lu9QYaLGLvixBd0xqWKyun7t7uw=',
		],
	},
	'tls-ddave-vga': {
		'vgadave.dav': [
			's3aIWshFK2y/nO2BsQgL/VcNm5E=',
			'ObIbMbCFRL7882dsitHoAhz9xbY=',
		],
	},
};

// List which handlers can't help but misdetect other files.
const skipIdentify = {
	'img-raw-linear-8bpp': [
		'tls-cosmo', // just happens to be exactly 64000 bytes!
	],
	'tls-ccomic-sprite': [
		'img-raw-planar-4bpp',
	],
	'tls-cosmo': [
		'img-raw-linear-8bpp',
		'img-raw-planar-4bpp',
		'tls-ccomic-sprite',
	],
	'tls-ddave-vga': [
		'tls-cosmo',
	],
};

describe(`Tests with real game files (if present)`, function() {

	let format = {};

	for (const idFormat of Object.keys(gameFiles)) {
		const f = {};
		f.handler = allFormats.find(t => t.metadata().id === idFormat);
		if (!f.handler) {
			throw new Error(`BUG: Test code has cases for format "${idFormat}" but `
				+ `this format isn't part of the library!`);
		}
		f.md = f.handler.metadata();
		f.testutil = new TestUtil(f.md.id);
		format[idFormat] = f;
	}

	before('load test data from local filesystem', function() {
		for (const [ idFormat, files ] of Object.entries(gameFiles)) {
			const { testutil, handler } = format[idFormat];
			try {
				format[idFormat].content = testutil.loadDirect(handler, Object.keys(files));
			} catch (e) {
				console.log(e.message);
			}
		}
	});

	for (const [ idFormat, files ] of Object.entries(gameFiles)) {
		const md = format[idFormat].md;

		describe(`${md.title} [${md.id}]`, function() {

			describe('identify()', function() {

				for (const imgFilename of Object.keys(files)) {
					it(`should recognise ${imgFilename}`, function() {
						// The next line has to be inside the it() otherwise it evaluates
						// too early, before the before() block above has populated the
						// object.
						const { handler, content } = format[idFormat];
						if (!content) this.skip();
						const result = handler.identify(
							content[imgFilename].main,
							content[imgFilename].main.filename
						);
						assert.ok(result, `Handler did not return a valid result object`);
						assert.notEqual(result.valid, false, `Handler did not recognise ${imgFilename}: ${result.reason}`);
					});
				}

				const skipFormats = skipIdentify[idFormat] || [];
				for (const [ idFormat2, files2 ] of Object.entries(gameFiles)) {
					if (idFormat2 === idFormat) continue; // skip ourselves

					// Skip files listed in gameFiles[].skip.
					if (skipFormats.includes(idFormat2)) continue;

					if (!format[idFormat2]) {
						throw new Error(`BUG: Tests tried to access non-existent format "${idFormat2}".`);
					}
					for (const imgFilename2 of Object.keys(files2)) {
						it(`should not recognise ${idFormat2} file ${imgFilename2}`, function() {
							// These also have to be inside the it() the same as above.
							const { content: content2 } = format[idFormat2];
							if (!content2) this.skip();
							const { handler } = format[idFormat];
							const result = handler.identify(
								content2[imgFilename2].main,
								content2[imgFilename2].main.filename
							);
							assert.equal(result.valid, false);
						});
					}
				}

			}); // identify()

			describe('parse()/generate()', function() {

				for (const [ targetFile, targetHash ] of Object.entries(files)) {
					it(`should read and rewrite ${targetFile}`, function() {
						const { handler, content } = format[idFormat];
						if (!content) this.skip();
						const img = handler.read(content[targetFile]);

						for (let f = 0; f < targetHash.length; f++) {
							assert.equal(TestUtil.hash(img.frames[f].pixels), targetHash[f],
								`Pixel data for "${targetFile}" frame ${f} differs to what `
								+ `was expected.`);
						}

						// Generate a new archive that should be identical to the original.
						const output = handler.write(img);
						const img2 = handler.read(output.content);

						// Compare the content against what was read from the first file,
						// which also passed the hash check.  This way if the content is
						// wrong, we get a hex dump of the differences rather than just
						// a "hash doesn't match" error.
						const largestFrames = Math.max(img.frames.length, img2.frames.length);
						for (let f = 0; f < largestFrames; f++) {
							const frame = img.frames[f];
							const frame2 = img2.frames[f];
							TestUtil.buffersEqual(
								(frame && frame.pixels) || new Uint8Array(),
								(frame2 && frame2.pixels) || new Uint8Array()
							);
							assert.equal(frame.width, frame2.width, `Width of frame ${f} changed after rewrite`);
							assert.equal(frame.height, frame2.height, `Height of frame ${f} changed after rewrite`);
						}
					});
				}

			}); // parse()/generate()

		}); // describe(format)

	} // foreach format

}); // Real game file tests
