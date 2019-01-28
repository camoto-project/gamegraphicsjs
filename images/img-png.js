/**
 * @file Raw VGA palette with 6-bit values [0..63].
 *
 * Copyright (C) 2018-2019 Adam Nielsen <malvineous@shikadi.net>
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

const PNG = require('pngjs').PNG;

const Debug = require('../util/utl-debug.js');
const ImageHandler = require('./imageHandler.js');
const Image = require('./image.js');

const FORMAT_ID = 'img-png';

module.exports = class Image_PNG extends ImageHandler
{
	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Portable Network Graphic',
			games: [
				'TODO',
			],
			glob: [
				'*.png',
			],
		};
	}

	static identify(content) {
		try {
			Debug.push(FORMAT_ID, 'identify');

			if (content.length !== 320 * 200) {
				Debug.log(`File length ${content.length} is not ${320 * 200} => false`);
				return false;
			}

			Debug.log(`Correct file size => true`);
			return true;

		} finally {
			Debug.pop();
		}
	}

	static read(content) {
		let png = new PNG();
		png.sync.read(content.main);

		// Convert RGBA to 8bpp
		let indexedBuffer = new Uint8Array(png.width * png.height);
		for (let i = 0; i < png.width * png.height; i++) {
			// TODO: lookup palette or something
			indexedBuffer[i] = png.data[i];
		}
		return new Image(
			png.width,
			png.height,
			indexedBuffer
		);
	}

	static write(image)
	{
		let png = new PNG();
		png.width = image.width;
		png.height = image.height;
		png.data = new Uint8Array(png.width * png.height * 4);
		// Temp: Convert to RGBA
		for (let i = 0; i < image.width * image.height; i++) {
			png.data[i * 4 + 0] = image.palette ? image.palette[image.pixels[i]][0] : image.pixels[i];
			png.data[i * 4 + 1] = image.palette ? image.palette[image.pixels[i]][1] : image.pixels[i];
			png.data[i * 4 + 2] = image.palette ? image.palette[image.pixels[i]][2] : image.pixels[i];
			png.data[i * 4 + 3] = image.palette ? image.palette[image.pixels[i]][3] : 255;
		}
		return {
			main: PNG.sync.write(png, {
				colorType: 6, // TODO: Use indexed instead
			}),
		};
	}
};
