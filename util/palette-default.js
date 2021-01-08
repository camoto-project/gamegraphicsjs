/*
 * Construct default CGA, EGA and VGA palettes.
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

import Palette from '../interface/palette.js';

/**
 * Create a new palette.
 *
 * @param {Number} length
 *   Number of entries. TODO: which CGA one?  EGA with yucky brown?
 */
export function createDefaultPalette(length)
{
	let pal = new Palette(256);
	for (let i = 0; i < 16; i++) {
		pal[i] = [
			(i & 8) ? ((i & 4) ? 0xFF : 0x55) : ((i & 4) ? 0xAA : 0x00),
			(i & 8) ? ((i & 2) ? 0xFF : 0x55) : ((i & 2) ? 0xAA : 0x00),
			(i & 8) ? ((i & 1) ? 0xFF : 0x55) : ((i & 1) ? 0xAA : 0x00),
			255,
		];
	}
	for (let i = 16; i < 256; i++) {
		pal[i] = [0, 0, 0, 255];
	}

	return pal;
}
