/*
 * Cosmo's Cosmic Adventure tileset handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/Cosmo_Tileset_Format
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

const FORMAT_ID = 'tls-cosmo';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import { fromPlanar, toPlanar } from '../util/image-planar.js';
import { paletteCGA16 } from '../util/palette-default.js';

const BYTES_PER_TILE = 32;

export default class Tileset_Cosmo extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Cosmo\'s Cosmic Adventure Tileset',
		};

		md.limits.minimumSize.x = 8;
		md.limits.minimumSize.y = 8;
		md.limits.maximumSize.x = 8;
		md.limits.maximumSize.y = 8;
		md.limits.depth = 4;
		md.limits.hasPalette = false;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = 1;

		return md;
	}

	static identify(content) {
		if (content.length > 5000 * BYTES_PER_TILE) {
			return {
				valid: false,
				reason: 'File too large (>5000 tiles).',
			};
		}

		if (content.length % BYTES_PER_TILE) {
			return {
				valid: false,
				reason: 'Not a multiple of the tile size.',
			};
		}

		return {
			valid: undefined,
			reason: `Permissable file size.`,
		};
	}

	static read(content) {
		return [
			new Image(
				{x: 8, y: (8 * content.main.length / BYTES_PER_TILE) >>> 0},
				fromPlanar({
					content: content.main,
					planeCount: 4,
					planeWidth: 8,
					lineWidth: 8,
					planeValues: [1, 2, 4, 8],
					byteOrderMSB: true,
				}),
				paletteCGA16()
			),
		];
	}

	static write(frames) {
		if (frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}
		const image = frames[0];

		return {
			content: {
				main: toPlanar({
					content: image.pixels,
					planeCount: 4,
					planeWidth: 8,
					lineWidth: 8,
					planeValues: [1, 2, 4, 8],
					byteOrderMSB: true,
				}),
			},
			warnings: [],
		};
	}
}
