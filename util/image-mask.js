/*
 * Conversion functions for image masks.
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

import Debug from '../util/debug.js';
const debug = Debug.extend('image-mask');

/**
 * Convert a visible frame and mask frame into a single frame with transparent
 * pixels.
 *
 * @param {Image} imgVisible
 *   Image containing visible pixels.
 *
 * @param {Image} imgMask
 *   Image containing mask pixels.
 *
 * @param {Function} cb
 *   Callback function to process each pixel.  Function signature is:
 *     function cbPixel(v, m) { return v; }
 *   Where `v` is the palette index (0..255) for the visible pixel being
 *   examined (from the Image.pixels array), `m` is the same but from the mask
 *   image, and the return value is the output pixel (0..255).
 *   This function should do something like return `v` unless `m` indicates a
 *   transparent pixel, which case it should return a palette index for a
 *   transparent pixel instead.
 *
 * @return {Image} A single image made from combining the visible image and
 *   the mask.
 */
export function imageFromMask({imgVisible, imgMask, cb})
{
	let img = imgVisible.clone();
	for (let p = 0; p < img.pixels.length; p++) {
		img.pixels[p] = cb(img.pixels[p], imgMask.pixels[p]);
	}

	return img;
}

/**
 * Convert an image with transparent pixels into two frames, one with visible
 * pixels and one with a monochrome transparency mask.
 *
 * @param {Image} img
 *   Image to read.
 *
 * @param {Function} cb
 *   Callback to process each pixel.  Function signature is:
 *     function cbPixel(p) { return [v, m]; }
 *   Where `p` is the pixel value (palette index 0..255) of the current pixel,
 *   `v` is the pixel value to put in the visible image, and `m` is the pixel
 *   value to put in the mask image.
 *
 * @return {Object} with two properties, `imgVisible` and `imgMask`, both
 *   `Image` instances.
 */
export function maskFromImage({ img, cb })
{
	let imgVisible = img.clone();
	let imgMask = img.clone();
	for (let p = 0; p < imgVisible.pixels.length; p++) {
		const [ v, m ] = cb(img.pixels[p]);
		imgVisible.pixels[p] = v;
		imgMask.pixels[p] = m;
	}

	return {
		imgVisible,
		imgMask,
	};
}