/*
 * Base class and defaults for image format handlers.
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

/**
 * Base class and defaults for image format handlers.
 *
 * To implement a new image file format, this is the class that will be
 * extended and its methods replaced with ones that perform the work.
 *
 * @name ImageHandler
 */
export default class ImageHandler
{
	/**
	 * Retrieve information about the image file format.
	 *
	 * This must be overridden by all format handlers.  It returns a structure
	 * detailed below.
	 *
	 * @return {Metadata} object.
	 */
	static metadata() {
		return {
			/**
			 * @typedef {Object} Metadata
			 *
			 * @property {string} id
			 *   A unique identifier for the format.
			 *
			 * @property {string} title
			 *   The user-friendly title for the format.
			 *
			 * @property {Array} games
			 *   A list of strings naming the games that use this format.
			 *
			 * @property {Array} glob
			 *   A list of strings with filename expressions matching files that are
			 *   often in this format.  An examples is ['*.txt', '*.doc', 'file*.bin'].
			 *
			 * @property {ImageLimits} limits
			 *   Values indicating what limitations apply to this format.
			 */
			id: 'unknown',
			title: 'Unknown format',
			games: [],
			glob: [],
			limits: {
				/**
				 * @typedef {Object} ImageLimits
				 *
				 * @property {Array} minimumSize
				 *   Two element array containing X and Y dimensions, in pixels, of the
				 *   minimum permitted image size.
				 *
				 * @property {Array} maximumSize
				 *   Two element array containing X and Y dimensions, in pixels, of the
				 *   maximum permitted image size.  One or both elements may be
				 *   undefined if the format does not provide a specific limit.  If the
				 *   format does not store pixel data (e.g. it's a palette file) then
				 *   the max size will be (0,0).
				 *
				 * @property {Number} transparentIndex
				 *   If hasPalette is true, this value is the palette index of a colour
				 *   that is fixed as transparent, e.g. 255 will mean the last palette
				 *   entry is treated as fully transparent.  A value of {null} signifies
				 *   that no colours can be transparent, and a value of {undefined}
				 *   means that any colour can be transparent based on the alpha value
				 *   in the palette data itself.  Writing a palette that doesn't fit
				 *   these limitations will typically result in an error.
				 */
				minimumSize: {x: 0, y: 0},
				maximumSize: {x: undefined, y: undefined},
				depth: undefined,
				hasPalette: undefined,
				paletteDepth: undefined,
				transparentIndex: undefined,
			},
			options: {},
		};
	}

	/**
	 * Identify any problems writing the given image in this format.
	 *
	 * @param {Image} image
	 *   Image to attempt to write in this handler's format.
	 *
	 * @return {Array} of strings listing any problems that will prevent the
	 *   supplied image from being written in this format.  An empty array
	 *   indicates no problems.
	 */
	static checkLimits(image)
	{
		const { limits } = this.metadata();
		let issues = [];

		if (
			(limits.maximumSize.x !== undefined)
			&& (image.dims.x > limits.maximumSize.x)
		) {
			issues.push(`The image's width (${image.dims.x}) is larger than the `
				+ `maximum of ${limits.maximumSize.x} that this format can handle.`);
		}

		if (
			(limits.maximumSize.y !== undefined)
			&& (image.dims.y > limits.maximumSize.y)
		) {
			issues.push(`The image's height (${image.dims.y}) is larger than the `
				+ `maximum of ${limits.maximumSize.y} that this format can handle.`);
		}

		// Make sure the image doesn't have too many colours.
		const maxIndex = 1 << limits.depth;
		for (let i = 0; i < image.pixels.length; i++) {
			if (image.pixels[i] >= maxIndex) {
				const x = i % image.dims.width;
				const y = i / image.dims.width;
				issues.push(`The image contains a pixel of colour index `
					+ `${image.pixels[i]} at (${x},${y}), but this format only supports `
					+ `images with colour numbers less than ${maxIndex}.`);
				break;
			}
		}

		return issues;
	}

	/**
	 * Get a list of supplementary files needed to use the format.
	 *
	 * Some formats store their data across multiple files, and this function
	 * will return a list of filenames needed, based on the filename and data in
	 * the main image file.
	 *
	 * This allows both the filename and content to be examined, in case either
	 * of these are needed to construct the name of the supplementary files.
	 *
	 * @param {string} name
	 *   Filename.
	 *
	 * @param {Uint8Array} content
	 *   File content.
	 *
	 * @return {null} if there are no supplementary files, otherwise an {Object}
	 *   where each key is an identifier specific to the handler, and the value
	 *   is the expected case-insensitive filename.  Don't convert passed names
	 *   to lowercase, but any changes (e.g. appending a filename extension)
	 *   should be lowercase.
	 */
	// eslint-disable-next-line no-unused-vars
	static supps(name, content) {
		return null;
	}

	/**
	 * See if the given file is in the format supported by this handler.
	 *
	 * This is used for format autodetection.
	 *
	 * @note More than one handler might report that it supports a file format.
	 *
	 * @param {Uint8Array} content
	 *   The file content to examine.
	 *
	 * @return {Boolean} true if the data is definitely in this format, false if
	 *   it is definitely not in this format, and undefined if the data could not
	 *   be positively identified but it's possible it is in this format.
	 */
	// eslint-disable-next-line no-unused-vars
	static identify(content) {
		return false;
	}

	/**
	 * Read the given image file.
	 *
	 * @param {Object} content
	 *   File content to read.  The `main` property contains the main file,
	 *   with any other supps as other properties.  Each property is a
	 *   {Uint8Array}.
	 *
	 * @return {Image} object containing the decoded image data.
	 */
	// eslint-disable-next-line no-unused-vars
	static read(content) {
		throw new Error('Not implemented yet.');
	}

	/**
	 * Write out an image file in this format.
	 *
	 * @preconditions The image has already been passed through checkLimits()
	 *   successfully. If not, the behaviour is undefined and a corrupted file
	 *   might be produced.
	 *
	 * @param {Image} image
	 *   The image to encode.
	 *
	 * @return {Object} containing the contents of the file in the `main`
	 *   property, with any other supp files as other properties.  Each property
	 *   is a {Uint8Array} suitable for writing directly to a file on disk or
	 *   offering for download to the user.
	 */
	// eslint-disable-next-line no-unused-vars
	static write(image) {
		throw new Error('Not implemented yet.');
	}
}
