/*
 * Stamp Roll (.rol) image handler
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

const FORMAT_ID = 'img-rol';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import {
	RecordBuffer,
	RecordType
} from '@camoto/record-io-buffer';
import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import { Frame, img_stp as stpHandler } from '../index.js';

const recordTypes = {
	fatEntry: {
		offset: RecordType.int.u32le,
	},
};

const STP_HEADER_SIZE_BYTES = 8;

export default class Image_Rol extends ImageHandler {
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Stamp Roll image',
			options: {},
			glob: [
				'*.rol',
			],
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = undefined;
		md.limits.maximumSize.y = undefined;
		md.limits.sizePerFrame = true;
		md.limits.depth = 8;
		md.limits.hasPalette = false;
		md.limits.transparentIndex = 255;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = undefined;		
		return md;
	}

	static identify(content) {

		if (content.length < (4 + STP_HEADER_SIZE_BYTES)) {
			return {
				valid: false,
				reason: `File size is smaller than minimum possible size for one 0x0 frame.`,
			};
		}

		let buffer = new RecordBuffer(content);
		const headerSize = buffer.read(RecordType.int.u32le);
		const frameCount = Math.floor(headerSize / 4);

		if (frameCount == 0) {
			return {
				valid: false,
				reason: `Zero-frame ROL files are not supported.`,
			};
		}

		if (content.length < (headerSize + (frameCount * STP_HEADER_SIZE_BYTES))) {
			return {
				valid: false,
				reason: `Content too short for frame count.`,
			};
		}

		if (headerSize % 4 != 0) {
			return {
				valid: false,
				reason: `Header size not on 4-byte boundary.`,
			};
		}

		// The size of the header is also the file offset at which the
		// first contained file is stored.
		let startOffsets = [headerSize];

		// Read each offset and length and ensure it is valid.
		for (let i = 1; i < frameCount; i++) {
			
			startOffsets[i] = buffer.read(RecordType.int.u32le);

			if ((startOffsets[i] + 4) >= content.length) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${startOffsets[i]} starts beyond the end of the archive.`,
				};
			}
		}

		return {
			valid: true,
			reason: `Potentially valid ROL image, pending decode.`,
		};
	}

	static read(content) {

		let buffer = new RecordBuffer(content.main);
		const headerSize = buffer.read(RecordType.int.u32le);
		const frameCount = Math.floor(headerSize / 4);
		let rolFrames = [];
		
		// The size of the header is also the file offset at which the
		// first contained file is stored.
		let startOffsets = [headerSize];

		// Read the offset of each contained STP file
		for (let i = 1; i < frameCount; i++) {
			startOffsets[i] = buffer.read(RecordType.int.u32le);
		}

		let maxWidth = 0;
		let maxHeight = 0;

		for (let i = 0; i < frameCount; i++) {
			const length = (i == frameCount - 1) ?
				(content.main.length - startOffsets[i]) : (startOffsets[i + 1] - startOffsets[i]);
			const stpData = content.main.slice(startOffsets[i], startOffsets[i] + length);
			const stpImg = stpHandler.read({main: stpData});

			if (stpImg.width > maxWidth) {
				maxWidth = stpImg.width;
			}

			if (stpImg.height > maxHeight) {
				maxHeight = stpImg.height;
			}

			rolFrames.push(new Frame({
				width: stpImg.width,
				height: stpImg.height,
				pixels: stpImg.frames[0].pixels,
			}));
		}
		
		return new Image({
			width: maxWidth,
			height: maxHeight,
			frames: rolFrames,
		});
	}

	static write(image) {

		if (image.frames.length < 1) {
			return {
				valid: false,
				reason: `This format requires at least one frame.`,
			};
		}

		let stpDataSizes = [];
		let stpData = [];
		
		// header contains a 4-byte entry for each frame
		const headerSize = image.frames.length * 4;

		// Allocate the minimum space required (if every frame were 0x0)
		let buffer = new RecordBuffer(headerSize + (STP_HEADER_SIZE_BYTES * image.frames.length));

		// Generate and store the STP image data
		for (let i = 0; i < image.frames.length; i++) {
			
			let frameStpData = stpHandler.write(new Image({
				width: (image.frames[i].width === undefined) ? image.width : image.frames[i].width,
				height: (image.frames[i].height === undefined) ? image.height : image.frames[i].height,
				frames: [ image.frames[i] ] })
			);
			
			stpData.push(frameStpData.content.main);
			stpDataSizes[i] = frameStpData.content.main.length;
		}

		// Write the start offsets in the header
		buffer.writeRecord(recordTypes.fatEntry, {offset: headerSize});
		for (let i = 1; i < image.frames.length; i++) {
			buffer.writeRecord(recordTypes.fatEntry, { offset: headerSize + stpDataSizes[i] });
		}

		// Write the STP image content
		for (let i = 0; i < image.frames.length; i++) {
			buffer.put(stpData[i]);
		}

		return {
			content: {
				main: buffer.getU8(),
			},
			warnings: [],
		};
	}
}