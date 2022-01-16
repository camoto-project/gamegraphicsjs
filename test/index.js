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
	Frame,
	Palette,
} from '../index.js';

// Skip these tests until the format handlers are improved.
const skipTests = [
	// These formats can't be tested easily with standard tests.
	'tls-ddave-cga', // first tiles are fixed at 16x16, rest are variable
	'tls-ddave-ega', // first tiles are fixed at 16x16, rest are variable
	'tls-ddave-vga', // first tiles are fixed at 16x16, rest are variable
];

// List which handlers can't help but misdetect other files.
const skipIdentify = {
	'img-raw-linear-8bpp': [
		'img-raw-planar-4bpp',
		'tls-quarantine-spr',
	],
	'img-raw-planar-4bpp': [
		'img-raw-linear-8bpp',
	],
	'tls-cosmo': [
		'img-raw-planar-4bpp',
	],
	'img-pln': [
		'tls-quarantine-spr',
	],
	'img-rol-v1': [
		'img-pln',
		'tls-quarantine-spr',
	],
	'img-rol-v2': [
		'img-pln',
		'tls-quarantine-spr',
	],
	'img-stp-v1': [
		'img-pln',
		'tls-quarantine-spr',
	],
	'tls-quarantine-spr': [
		'img-pln',
	],
};

// Override the default colours so we can actually see them
import { colors } from 'mocha/lib/reporters/base.js';
colors['diff added'] = '1;33';
colors['diff removed'] = '1;31';
colors['green'] = '1;32';
colors['fail'] = '1;31';
colors['error message'] = '1;31';
colors['error stack'] = '1;37';

// Standard image used for the conversion tests.
function createStandardImage(width, height, depth, uniquePixel) {
	const cga = depth < 4;
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

	// If uniquePixels was given, use it for the first pixel
	if (uniquePixel !== undefined) {
		pixels[width * (height - 1)] = uniquePixel >>> 0;
	}

	return pixels;
}

// eslint-disable-next-line no-unused-vars
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

function createStandardPalette(transparentIndex, offset = 0)
{
	let pal = new Palette(256);
	for (let i = 0; i < 256; i++) {
		pal[i] = [
			((i << 2) + offset) % 256,
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

				assert.ok(md.limits.frameCount, 'Missing frameCount');
				assert.ok(md.limits.frameCount.min >= 0, 'Minimum frame count is invalid');
				assert.ok(
					(md.limits.frameCount.max === undefined)
					|| (md.limits.frameCount.max >= 0),
					'Maximum frame count is invalid'
				);
			});

		});

		function testSize(width, height, message, count) {
			const sizename = width + 'x' + height + ((count > 1) ? `-${count}` : '');
			describe(`should handle dimensions of ${sizename} (${message})`, function () {
				// Not all format handlers use this, but those that do all use the
				// same keys.
				const options = {
					width,
					height,
				};

				// Load expected image data for these image dimensions
				let contentEncoded;
				before(`load expected output from local filesystem`, function () {
					const sizeContent = testutil.loadContent(handler, [
						sizename,
					]);
					contentEncoded = sizeContent[sizename];
					assert.ok(contentEncoded.main.filename); // sanity check
				});

				// Read the image
				describe('read()', function() {
					let image;
					before('should read correctly', function() {
						let sourceImage = handler.read(contentEncoded, options);
						if (count === 1) {
							image = sourceImage;
						} else {
							assert.ok(sourceImage.length >= count, `Not enough images in `
								+ `sample file (got ${sourceImage.length}, needed ${count}).`);
							image = sourceImage[count - 1];
						}
						assert.notStrictEqual(image, undefined);
						assert.notStrictEqual(image.frames, undefined);
						assert.notStrictEqual(image.frames, null);
						assert.notStrictEqual(image.frames.length, undefined);
					});

					it('should have the correct dimensions', function() {
						if (md.limits.sizePerFrame) {
							// Use just the first frame, but fall back to the image dimensions
							// if the frame has none.
							const f = 0;
							const frameWidth = (image.frames[f].width === undefined) ? image.width : image.frames[f].width;
							const frameHeight = (image.frames[f].height === undefined) ? image.height : image.frames[f].height;
							assert.equal(frameWidth, width, 'Wrong width');
							assert.equal(frameHeight, height, 'Wrong height');
						} else {
							// Use global image size.
							assert.equal(image.width, width, 'Wrong width');
							assert.equal(image.height, height, 'Wrong height');
						}
					});

					if (md.limits.hasPalette) {
						it('should have the correct palette', function() {
							assert.notStrictEqual(image.palette, undefined, 'Palette cannot be undefined');
							assert.notStrictEqual(image.palette, null, 'Palette cannot be null');

							const palExp = createStandardPalette(md.limits.transparentIndex);
							// Adjust the precision of the expected value, reducing it if the
							// format reports the palette components are under 8-bits wide.
							let adjustPrecision = c => c;
							if (md.limits.paletteDepth < 8) {
								adjustPrecision = c => c >> (8 - md.limits.paletteDepth);
							}
							for (let i = 0; i < image.palette.length; i++) {
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

						if (md.limits.palettePerFrame) {
							it(`should have a palette for each frame`, function() {
								// TODO: Check each frame's palette
								this.skip();
							});
						}

					} else {
						it(`should correctly report no palette`, function() {
							assert.equal(md.limits.palettePerFrame, false,
								'Cannot have palettes per frame if the format does not support '
								+ 'palettes.');
						});
					}

					it(`should have the correct pixel values`, function() {
						assert.ok(image.frames.length >= md.limits.frameCount.min,
							`Image has ${image.frames.length} frames, but the minimum `
							+ `permitted is ${md.limits.frameCount.min}`);
						assert.ok(
							(md.limits.frameCount.max === undefined)
							|| (image.frames.length <= md.limits.frameCount.max),
							`Image has ${image.frames.length} frames, but the maximum `
							+ `permitted is ${md.limits.frameCount.max}`);
						for (let f = 0; f < image.frames.length; f++) {
							const expectedPixels = createStandardImage(width, height, md.depth, f);
							TestUtil.buffersEqual(expectedPixels, image.frames[f].pixels,
								`Frame ${f} has wrong pixel values`);
						}
					});
				});

				// Write the image
				describe('write()', function() {
					let images;
					before('generate standard image', function() {
						const maxFrameCount = (md.limits.frameCount.max === undefined) ? 100 : md.limits.frameCount.max;
						const frameCount = Math.max(
							md.limits.frameCount.min,
							Math.min(count, maxFrameCount)
						);
						let frames = [];
						for (let f = 0; f < frameCount; f++) {
							let frame = new Frame({
								width,
								height,
								pixels: createStandardImage(width, height, md.depth, f),
								// Use a unique palette per frame if the format supports it.
								palette: md.limits.palettePerFrame ? createStandardPalette(md.limits.transparentIndex, f) : null,
							});
							assert.notStrictEqual(frame, undefined);
							assert.notStrictEqual(frame, null);
							assert.notStrictEqual(frame.pixels, undefined);
							frames.push(frame);
						}
						const imgpal = md.limits.hasPalette ? createStandardPalette(md.limits.transparentIndex) : null;
						const img = new Image({
							width,
							height,
							frames,
							palette: imgpal,
						});

						// Duplicate it so we have an array of images.
						images = [];
						for (let i = 0; i < count; i++) {
							images.push(img.clone());
						}
					});

					it('checkLimits() should not complain', function() {
						for (const image of images) {
							for (let f = 0; f < image.frames.length; f++) {
								assert.notStrictEqual(image.frames[f].pixels, undefined,
									`BUG: Frame ${f} exists but has no pixel data.`);
							}
						}
						const targetImage = (count === 1) ? images[0] : images;
						const warnings = handler.checkLimits(targetImage);
						assert.ok(warnings.length === 0, 'Got unexpected warning: ' + warnings[0]);
					});

					it('should write correctly using image dims', function() {
						// Zero out the frame dimensions to force the image dimensions to
						// be used.
						let img2 = [];
						for (let i = 0; i < count; i++) {
							let cpyImage = images[i].clone();
							for (const f of cpyImage.frames) {
								f.width = undefined;
								f.height = undefined;
							}
							img2.push(cpyImage);
						}
						const targetImage = (count === 1) ? img2[0] : img2;

						const { content: contentGenerated } = handler.write(targetImage, options);

						TestUtil.contentEqual(contentEncoded, contentGenerated);
					});

					it('should write correctly using frame dims', function() {
						// Move the dimensions from the main image onto the frame instead.
						// The format handler should use the frame dimensions in preference
						// to the image dimensions, if present.
						let img2 = [];
						for (let i = 0; i < count; i++) {
							let cpyImage = images[i].clone();
							cpyImage.width = 0;
							cpyImage.height = 0;
							img2.push(cpyImage);
						}
						const targetImage = (count === 1) ? img2[0] : img2;

						const { content: contentGenerated } = handler.write(targetImage, options);

						TestUtil.contentEqual(contentEncoded, contentGenerated);
					});
				});

				describe('identify()', function() {

					it('should not negatively identify itself', function() {
						const result = handler.identify(contentEncoded.main, contentEncoded.main.filename, options);
						assert.ok(
							result.valid === true || result.valid === undefined,
							`Failed self-identification with reason: ${result.reason}`
						);
					});

					const skipFormats = skipIdentify[md.id] || [];
					for (const subhandler of gamegraphicsFormats) {
						const submd = subhandler.metadata();

						// Skip ourselves
						if (submd.id === md.id) continue;

						// Skip files listed in gameFiles[].skip.
						if (skipFormats.includes(submd.id)) continue;

						it(`should not positively identify ${submd.id} files`, function() {
							const result = subhandler.identify(contentEncoded.main, contentEncoded.main.filename, options);
							assert.notEqual(result.valid, true);
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

		testSize(md.limits.minimumSize.x, md.limits.minimumSize.y, 'Minimum permitted size', 1);

		if (
			(md.limits.maximumSize.x > md.limits.minimumSize.x)
			|| (md.limits.maximumSize.y > md.limits.minimumSize.y)
		) {
			testSize(maxDims.x, maxDims.y, 'Maximum permitted size', 1);
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
				(md.limits.minimumSize.x <= testDims.x)
				&& (md.limits.minimumSize.y <= testDims.y)
				&& (maxDims.x >= testDims.x)
				&& (maxDims.y >= testDims.y)
				&& (md.limits.multipleSize.x && (testDims.x % md.limits.multipleSize.x === 0))
				&& (md.limits.multipleSize.y && (testDims.y % md.limits.multipleSize.y === 0))
			) {
				testSize(testDims.x, testDims.y, 'Standard test', 1);
				if (
					(md.limits.imageCount.max === undefined)
					|| (md.limits.imageCount.max > 1)
				) {
					testSize(testDims.x, testDims.y, 'Standard test with array of two images', 2);
				}
			}
		});

	});
}
