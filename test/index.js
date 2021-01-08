/**
 * @file Standard tests.
 *
 * Copyright (C) 2018 Adam Nielsen <malvineous@shikadi.net>
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
	all as gamegraphicsFormats,
	Image,
	Palette,
} from '../index.js';

// Skip these tests until the format handlers are improved.
const skipTests = ['img-png'];

// Override the default colours so we can actually see them
import { colors } from 'mocha/lib/reporters/base.js';
colors['diff added'] = '1;33';
colors['diff removed'] = '1;31';
colors['green'] = '1;32';
colors['fail'] = '1;31';
colors['error message'] = '1;31';
colors['error stack'] = '1;37';

// Standard image used for the conversion tests.
function createStandardImage(width, height, cga = false) {
	let pixels = new Uint8Array(width * height, 0x00);
	const lastRow = (height - 1) * width;

	// Write 0x0F across first row and 0x09 across last row
	for (let x = 0; x < width; x++) {
		pixels[x] = cga ? 0x03 : 0x0F;
		pixels[lastRow + x] = cga ? 0x02 : 0x09;
	}

	// Write 0x0C across first and 0x0A across last column, except first row
	for (let y = 1; y < height - 1; y++) {
		pixels[y * width] = cga ? 0x01 : 0x0C;
		pixels[y * width + (width - 1)] = cga ? 0x02 : 0x0A;
	}

	// Bottom-right-most pixel is 0x0E
	if ((width > 0) && (height > 0)) {
		pixels[width * height - 1] = cga ? 0x01 : 0x0E;
	}
	return pixels;
}

function createStandardMask(width, height, hit) {
	let pixels = new Uint8Array(width * height, 0x01);
	const lastRow = (height - 1) * width;

	// Write 0x00 across first and last row
	for (let x = 0; x < width; x++) {
		pixels[x] = 0x00;
		pixels[lastRow + x] = 0x00;
	}

	// Write 0x00 across first and last column
	for (let y = 1; y < height - 1; y++) {
		pixels[y * width] = 0x00;
		pixels[y * width + (width - 1)] = 0x00;
	}

	// Write 0x02 across second row if hitmask is enabled, on both transparent
	// and opaque pixels.
	if (hit) {
		for (let x = 0; x < width; x++) {
			pixels[width + x] |= 0x02;
		}
	}
	return pixels;
}

function createStandardPalette(transparentIndex)
{
	let pal = new Palette(256);
	for (let i = 0; i < 256; i++) {
		pal[i] = [
			(i << 2) % 256,
			i >> 4,
			i,
			255,
		];
	}
	if (transparentIndex === undefined) transparentIndex = 255;
	if (transparentIndex !== null) {
		pal[transparentIndex][3] = 0;
	}
	return pal;
}

for (const handler of gamegraphicsFormats) {
	const md = handler.metadata();

	if (skipTests.some(id => id === md.id)) {
		it.skip(`Standard tests for ${md.title} [${md.id}]`);
		continue;
	}

	let testutil = new TestUtil(md.id);

	describe(`Standard tests for ${md.title} [${md.id}]`, function() {
		let content = {};

		describe('metadata()', function() {

			it('should provide a title', function() {
				assert.ok(md.title && (md.title.length > 0));
			});

			it('should provide a list of format limitations', function() {
				assert.ok(md.limits);
				// Make sure the metadata() implementation amends the objects rather
				// than replacing them entirely.
				assert.ok(md.limits.minimumSize);
				assert.ok(md.limits.maximumSize);
				if (md.limits.hasPalette) {
					assert.ok(md.limits.paletteDepth > 0, 'Has palette but missing paletteDepth');
				}
			});

		});

		function testSize(dims, message) {
			const sizename = dims.x + 'x' + dims.y;
			describe(`should handle dimensions of ${sizename}`, function () {
				// Load expected image data for these image dimensions
				let contentEncoded;
				before(`load expected output from local filesystem`, function () {
					try {
						const sizeContent = testutil.loadContent(handler, [
							sizename,
						]);
						contentEncoded = sizeContent[sizename];
					} catch (e) {
						// Save the expected data if $SAVE_FAILED_TEST is set
						if (process.env.SAVE_FAILED_TEST == 1) {
							const testimg = new Image(
								dims,
								createStandardImage(dims.x, dims.y, false),
								md.limits.hasPalette ? createStandardPalette(md.limits.transparentIndex) : null,
								undefined
							);
							const contentGenerated = handler.write(testimg);
							for (let i = 1; i <= 20; i++) {
								const fn = `expected${i}.${md.id}.${sizename}.bin`;
								if (!fs.existsSync(fn)) {
									// eslint-disable-next-line no-console
									console.warn(`** Expected data does not exist, writing it to ${fn}`);
									fs.writeFileSync(fn, contentGenerated.main);
									break;
								}
							}
						}

						throw e;
					}
				});

				// Read the image
				describe('read()', function() {
					let image;
					before('should read correctly', function() {
						// Not all format handlers use this, but those that do all use the
						// same keys.
						const options = {
							dims: dims,
						};

						image = handler.read(contentEncoded, options);
						assert.notStrictEqual(image, undefined);
						assert.notStrictEqual(image, null);
					});

					it('should have the correct dimensions', function() {
						assert.equal(image.dims.x, dims.x);
						assert.equal(image.dims.y, dims.y);
					});

					if (md.limits.hasPalette) {
						it('should have the correct palette', function() {
							assert.notStrictEqual(image.palette, undefined);
							assert.notStrictEqual(image.palette, null);

							const palExp = createStandardPalette(md.limits.transparentIndex);
							// Adjust the precision of the expected value, reducing it if the
							// format reports the palette components are under 8-bits wide.
							let adjustPrecision = c => c;
							if (md.limits.paletteDepth < 8) {
								adjustPrecision = c => c >> (8 - md.limits.paletteDepth);
							}
							for (let i = 0, p = 0; i < 256; i++) {
								assert.equal(
									adjustPrecision(image.palette[i][0]),
									adjustPrecision(palExp[i][0]),
									`Red (0) component of palette entry ${i} does not match`
								);
								assert.equal(
									adjustPrecision(image.palette[i][1]),
									adjustPrecision(palExp[i][1]),
									`Green (1) component of palette entry ${i} does not match`
								);
								assert.equal(
									adjustPrecision(image.palette[i][2]),
									adjustPrecision(palExp[i][2]),
									`Blue (2) component of palette entry ${i} does not match`
								);
								if (md.limits.transparentIndex !== null) {
									// Transparency available in some form.
									assert.equal(
										adjustPrecision(image.palette[i][3]),
										adjustPrecision(palExp[i][3]),
										`Alpha (3) component of palette entry ${i} does not match`
									);
								}
							}
						});
					}
				});

				// Write the image
				describe('write()', function() {
					let image;
					before('generate standard image', function() {
						image = new Image(
							dims,
							createStandardImage(dims.x, dims.y, false),
							md.limits.hasPalette ? createStandardPalette(md.limits.transparentIndex) : null,
							undefined
						);
						assert.notStrictEqual(image, undefined);
						assert.notStrictEqual(image, null);
					});

					it('should write correctly', function() {
						const contentGenerated = handler.write(image);

						TestUtil.contentEqual(contentEncoded, contentGenerated);
					});
				});

				describe('identify()', function() {

					it('should not negatively identify itself', function() {
						const result = handler.identify(contentEncoded.main);
						assert.ok(result === true || result === undefined);
					});

					for (const subhandler of gamegraphicsFormats) {
						const submd = subhandler.metadata();

						// Skip ourselves
						if (submd.id === md.id) return;

						it(`should not positively identify ${submd.id} files`, function() {
							const result = subhandler.identify(contentEncoded);
							assert.notEqual(result, true);
						});
					}
				});

			});
		}

		// If the max size is undefined, use 1024 as that should be large enough.
		const maxDims = {
			x: (md.limits.maximumSize.x === undefined) ? 1024 : md.limits.maximumSize.x,
			y: (md.limits.maximumSize.y === undefined) ? 1024 : md.limits.maximumSize.y,
		};

		testSize(md.limits.minimumSize, 'Minimum permitted size');

		if (
			(md.limits.maximumSize.x > md.limits.minimumSize.x)
			|| (md.limits.maximumSize.y > md.limits.minimumSize.y)
		) {
			testSize(maxDims, 'Maximum permitted size');
		}

		[
			{x: 8, y: 8},
			{x: 16, y: 16},
			{x: 32, y: 32},
			{x: 320, y: 200},

			{x: 7, y: 8},
			{x: 8, y: 7},
			{x: 7, y: 7},
			{x: 9, y: 8},
			{x: 8, y: 9},
			{x: 9, y: 9},
		].forEach(function (testDims) {
			// Run a test at this resolution if it's between, but not exactly, the
			// maximum or the minimum (since we've already run max+min tests above).
			if (
				(md.limits.minimumSize.x < testDims.x)
				&& (md.limits.minimumSize.y < testDims.y)
				&& (maxDims.x > testDims.x)
				&& (maxDims.y > testDims.y)
			) {
				testSize(testDims);
			}
		});

	});
}
