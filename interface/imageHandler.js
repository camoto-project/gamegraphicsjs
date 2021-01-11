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
				 * Two element array containing X and Y dimensions, in pixels, of the
				 * minimum permitted image size.
				 */
				minimumSize: { x: 0, y: 0 },

				/**
				 * Two element array containing X and Y dimensions, in pixels, of the
				 * maximum permitted image size.  One or both elements may be
				 * undefined if the format does not provide a specific limit.  If the
				 * format does not store pixel data (e.g. it's a palette file) then
				 * the max size will be (0,0).
				 */
				maximumSize: { x: undefined, y: undefined },

				/**
				 * If the image dimensions can only be a multiple of some number,
				 * specify it here.  For example planar image data is written as 8
				 * pixels per byte, so these images must have widths that are a
				 * multiple of 8 in order to fit in whole bytes.
				 */
				multipleSize: { x: 1, y: 1 },

				/**
				 * Maximum colour depth of images in this format.
				 * 4 = 16-colour/EGA, 8 = 256-colour/VGA, etc.
				 */
				depth: undefined,

				/**
				 * Can this format store a palette?  `true` if so, `false` if not.
				 * Note that all images must have a palette specified (even if it's
				 * just the default one) this only indicates whether that palette will
				 * be saved with the pixel data or not.
				 */
				hasPalette: undefined,

				/**
				 * How many bits are stored per channel.  Typical values are 6 (0..64)
				 * for VGA palettes or 8 (0..255) for more modern formats.
				 * `undefined` if the format cannot store a palette.
				 */
				paletteDepth: undefined,

				/**
				 * A palette index for a transparent colour, if this format always has
				 * the same palette index marked as transparent.  `null` if no colours
				 * can be transparent, or `undefined` if the transparency comes instead
				 * from the alpha value in the palette (allowing any colour to play the
				 * role of transparent.
				 */
				transparentIndex: null,
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
	 * @return `null` if there are no supplementary files, otherwise an `object`
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
	 * @param {string} filename
	 *   The archive's filename in case it is relevant, for those formats where
	 *   the filename extension is significant.
	 *
	 * @param {object} options
	 *   Object with keys matching `this.metadata().options` if present.  Used to
	 *   supply additional attributes, such as image width and height for formats
	 *   that don't store this in a file header.
	 *
	 * @return {object} with a `.valid` property, set to `true` if the data is
	 *   definitely in this format, `false` if it is definitely not in this
	 *   format, and `undefined` if it's possible the data is in this format but
	 *   there is not enough information to know for certain one way or the other.
	 *   The returned object also has a `.reason` property containing a technical
	 *   although user-friendly explanation as to why the data was decreed to be
	 *   or not be in this format.  This is most useful when uncertain or
	 *   rejecting content, as the user can then be informed why.
	 */
	// eslint-disable-next-line no-unused-vars
	static identify(content, filename, options) {
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
	 * @param {object} options
	 *   Object with keys matching `this.metadata().options` if present.  Used to
	 *   supply additional attributes, such as image width and height for formats
	 *   that don't store this in a file header.
	 *
	 * @return {Image} object containing the decoded image data.
	 */
	// eslint-disable-next-line no-unused-vars
	static read(content, options) {
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
	 * @param {object} options
	 *   Object with keys matching `this.metadata().options` if present.  Used to
	 *   supply additional attributes, such as image width and height for formats
	 *   that don't store this in a file header.
	 *
	 * @return {Object} containing two properties, `content` and `warnings`.
	 *   `warnings` is a (possibly empty) array of text strings to show the user
	 *   to highlight and issues encountered when producing the content, and
	 *   `content` contains the actual data.  The main file is in `content.main`,
	 *   with any other supp files as other `content` properties.  Each
	 *   property is a `Uint8Array` suitable for writing directly to a file on
	 *   disk or offering for download to the user.
	 */
	// eslint-disable-next-line no-unused-vars
	static write(image, options) {
		throw new Error('Not implemented yet.');
	}
}
