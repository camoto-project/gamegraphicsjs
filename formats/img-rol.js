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
import Frame from '../interface/frame.js';
import {
	img_stp_v1 as stpHandlerV1,
	img_stp_v2 as stpHandlerV2,
} from '../index.js';

const recordTypes = {
	fatEntry: {
		offset: RecordType.int.u32le,
	},
};

const STP_V1_HEADER_SIZE_BYTES = 10;
const STP_V2_HEADER_SIZE_BYTES = 8;

/**
 * This is the common base class for two versions of the Stamp Roll format
 * that differ slightly. The ROL format itself only defines a simple
 * container for STP images that are concatenated within. STP images can
 * be stored in one of two different formats (which are referred to as
 * Version 1 and Version 2, in order of their chronological appearance).
 * The STP images contained within a ROL must all be of the same version.
 * The version of the ROL file is defined to match the version of the
 * contained STP images.
 */
class img_rol_common extends ImageHandler {
	static metadata() {
		let md = super.metadata();
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

	static identifyByVersion(content, rolVersion) {

		let stpHandler = undefined;
		if (rolVersion == 1) {
			stpHandler = stpHandlerV1;
		} else if (rolVersion == 2) {
			stpHandler = stpHandlerV2;
		} else {
			throw new Error(`ROL version must be either 1 or 2.`);
		}

		const stpHeaderSizeBytes = (rolVersion == 1) ? STP_V1_HEADER_SIZE_BYTES : STP_V2_HEADER_SIZE_BYTES;

		// Require at least a single 0x0 frame (4 bytes for ROL index + empty STP file)
		if (content.length < (4 + stpHeaderSizeBytes)) {
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

		if (content.length < (headerSize + (frameCount * stpHeaderSizeBytes))) {
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

			if ((startOffsets[i] + stpHeaderSizeBytes) >= content.length) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${startOffsets[i]} starts beyond the end of the archive.`,
				};
			}
		}

		// Verify that all the contained STP files are valid.
		for (let i = 0; i < frameCount; i++) {

			const pastEnd = (i == frameCount - 1) ? content.length : startOffsets[i + 1];
			const stpData = content.slice(startOffsets[i], pastEnd);

			if (stpHandler.identify(stpData).valid == false) {
				return {
					valid: false,
					reason: `File ${i} @ offset ${startOffsets[i]} is not a valid STP version ${rolVersion} file.`,
				};
			}
		}

		return {
			valid: true,
			reason: `Potentially valid ROL image, pending decode.`,
		};
	}

	static readByVersion(content, rolVersion) {

		if ((rolVersion !== 1) && (rolVersion !== 2)) {
			throw new Error(`ROL version must be either 1 and 2.`);
		}
		const stpHandler = (rolVersion == 1) ? stpHandlerV1 : stpHandlerV2;

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

		let frame0Width = undefined;
		let frame0Height = undefined;

		for (let i = 0; i < frameCount; i++) {
			const length = (i == frameCount - 1) ?
				(content.main.length - startOffsets[i]) : (startOffsets[i + 1] - startOffsets[i]);
			const stpData = content.main.slice(startOffsets[i], startOffsets[i] + length);
			const stpImg = stpHandler.read({
				main: stpData
			});

			// Capture the width/height from the first frame for reporting
			if (i == 0) {
				frame0Width = stpImg.width;
				frame0Height = stpImg.height;
			}

			rolFrames.push(new Frame({
				width: stpImg.width,
				height: stpImg.height,
				hotspotX: stpImg.hotspotX,
				hotspotY: stpImg.hotspotY,
				pixels: stpImg.frames[0].pixels,
			}));
		}

		return new Image({
			width: frame0Width,
			height: frame0Height,
			frames: rolFrames,
		});
	}

	static writeByVersion(image, rolVersion) {

		if ((rolVersion !== 1) && (rolVersion !== 2)) {
			throw new Error(`ROL version must be either 1 and 2.`);
		}
		const stpHandler = (rolVersion == 1) ? stpHandlerV1 : stpHandlerV2;
		const stpHeaderSizeBytes = (rolVersion == 1) ? STP_V1_HEADER_SIZE_BYTES : STP_V2_HEADER_SIZE_BYTES;

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
		let buffer = new RecordBuffer(headerSize + (stpHeaderSizeBytes * image.frames.length));

		// Generate and store the STP image data
		for (let i = 0; i < image.frames.length; i++) {

			let frameStpData = stpHandler.write(new Image({
				width: (image.frames[i].width === undefined) ? image.width : image.frames[i].width,
				height: (image.frames[i].height === undefined) ? image.height : image.frames[i].height,
				hotspotX: image.frames[i].hotspotX,
				hotspotY: image.frames[i].hotspotY,
				frames: [image.frames[i]]
			}));

			stpData.push(frameStpData.content.main);
			stpDataSizes[i] = frameStpData.content.main.length;
		}

		// Write the start offsets in the header
		buffer.writeRecord(recordTypes.fatEntry, {
			offset: headerSize
		});
		for (let i = 1; i < image.frames.length; i++) {
			buffer.writeRecord(recordTypes.fatEntry, {
				offset: headerSize + stpDataSizes[i]
			});
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

export class img_rol_v1 extends img_rol_common {

	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-v1',
			title: 'Stamp Roll image, version 1',
			options: {},
			glob: [
				'*.rol',
			],
		};
	}

	static identify(content) {
		return super.identifyByVersion(content, 1);
	}

	static read(content) {
		return super.readByVersion(content, 1);
	}

	static write(content) {
		return super.writeByVersion(content, 1);
	}
}

export class img_rol_v2 extends img_rol_common {

	static metadata() {
		return {
			...super.metadata(),
			id: FORMAT_ID + '-v2',
			title: 'Stamp Roll image, version 2',
			options: {},
			glob: [
				'*.rol',
			],
		};
	}

	static identify(content) {
		return super.identifyByVersion(content, 2);
	}

	static read(content) {
		return super.readByVersion(content, 2);
	}

	static write(content) {
		return super.writeByVersion(content, 2);
	}
}
