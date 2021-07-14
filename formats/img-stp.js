/*
 * Stamp (.stp) image handler
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

const FORMAT_ID = 'img-stp';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import {
	RecordBuffer,
	RecordType
} from '@camoto/record-io-buffer';
import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Frame from '../interface/frame.js';

const recordTypes = {
	header: {
		width: RecordType.int.u16le,
		height: RecordType.int.u16le,
		negativeOffsetX: RecordType.int.u16le,
		negativeOffsetY: RecordType.int.u16le,
	},
};

const STP_HEADER_SIZE_BYTES = 8;
const MAX_RUNLENGTH_TRANSPARENCY = 0x7F;
const MAX_RUNLENGTH_OPAQUE = 0x3F;
const MAX_DIRECT_SEQUENCE_LEN = 0x3F;
const PAL_TRANSPARENCY_INDEX = 0xFF;

export default class Image_Stp extends ImageHandler {
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Stamp image',
			options: {},
		};

		md.limits.minimumSize.x = 0;
		md.limits.minimumSize.y = 0;
		md.limits.maximumSize.x = undefined;
		md.limits.maximumSize.y = undefined;
		md.limits.depth = 8;
		md.limits.hasPalette = false;

		return md;
	}

	static identify(content) {

		if (content.length < STP_HEADER_SIZE_BYTES) {
			return {
				valid: false,
				reason: `File size is smaller than minimum possible size for 0x0 image.`,
			};
		}

		let buffer = new RecordBuffer(content);
		const header = buffer.readRecord(recordTypes.header);

		if (header.negativeOffsetX > 320 || header.negativeOffsetY > 200) {
			return {
				valid: false,
				reason: `Negative offset header fields contain values larger than maximum possible screen size for STP images.`,
			};
		}

		const reportedPixelCount = header.width * header.height;
		const rasterDataSize = content.length - STP_HEADER_SIZE_BYTES;

		// We can compute a minimum possible image size (in pixel count)
		// for a given STP file by assuming the least efficient packing
		// possible, which is 64 bytes -> 63 pixels.
		let minPossiblePixelCount =
			(Math.floor(rasterDataSize / 64) * 63) + ((rasterDataSize % 64) - 1);
		if (minPossiblePixelCount < 0) {
			minPossiblePixelCount = 0;
		}

		// The maximum possible pixel count (based on file size) would be
		// in a file that consists only of transparency/background. In this
		// case, each byte would provide 127 pixels.
		const maxPossiblePixelCount = (rasterDataSize * 0x7F);

		if (reportedPixelCount < minPossiblePixelCount) {
			return {
				valid: false,
				reason: `Image header reports pixel count of ${reportedPixelCount} but length ` +
					`(${content.length}) would result in a minimum size of ${minPossiblePixelCount}.`,
			};
		}

		if (reportedPixelCount > maxPossiblePixelCount) {
			return {
				valid: false,
				reason: `Image header reports pixel count of ${reportedPixelCount} but length ` +
					`(${content.length}) would result in a maximum size of ${maxPossiblePixelCount}.`,
			};
		}

		return {
			valid: true,
			reason: `Potentially valid STP image, pending decode.`,
		};
	}

	static read(content) {

		let buffer = new RecordBuffer(content.main);
		const header = buffer.readRecord(recordTypes.header);

		let out = new Uint8Array(header.width * header.height);
		let inputPos = STP_HEADER_SIZE_BYTES;
		let outputPos = 0;
		let directCopySeq = false;
		let repeatSeq = false;
		let transparencySeq = false;
		let count = 0;

		while (((inputPos < content.main.length) || transparencySeq) && (outputPos < out.length)) {

			// if we're doing direct copy from the compressed data...
			if (directCopySeq) {

				out[outputPos++] = content.main[inputPos];
				if (--count == 0) {
					directCopySeq = false;
				}
				inputPos++;

			} else if (repeatSeq) { // if we're repeating a single byte multiple times

				const repeatedByte = content.main[inputPos];
				while ((outputPos < out.length) && (count > 0)) {
					out[outputPos++] = repeatedByte;
					count--;
				}
				repeatSeq = false;
				inputPos++;

			} else if (transparencySeq) {

				while ((outputPos < out.length) && (count > 0)) {
					out[outputPos++] = PAL_TRANSPARENCY_INDEX;
					count--;
				}
				transparencySeq = false;

			} else { // otherwise, we're looking for the next sequence in the input

				// If the control byte indicates a pointer advance (i.e. transparency)
				if ((content.main[inputPos] & 0x80) == 0x80) {

					// number of pixels to write out as transparent
					count = (content.main[inputPos] & 0x7F);
					transparencySeq = true;

				} else if ((content.main[inputPos] & 0xC0) == 0x40) {

					count = (content.main[inputPos] & 0x3F);
					repeatSeq = true;

				} else { // otherwise, this seq is a direct copy from the input

					count = content.main[inputPos];
					directCopySeq = true;
				}

				inputPos++;
			}
		}

		if (inputPos < content.main.length) {
			throw new Error(`Extraneous input data; frame is complete with input data remaining.`);
		}

		if (outputPos < out.length) {
			throw new Error(`Ran out of input data before full frame size was constructed.`);
		}

		return new Image({
			width: header.width,
			height: header.height,
			frames: [
				new Frame({
					pixels: out,
				}),
			],
		});
	}

	static write(image) {
		if (image.frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}

		const frame = image.frames[0];
		const frameWidth = (frame.width === undefined) ? image.width : frame.width;
		const frameHeight = (frame.height === undefined) ? image.height : frame.height;
		const pixels = frame.pixels;

		let buffer = new RecordBuffer(frame.pixels.length + STP_HEADER_SIZE_BYTES);

		let pixelIndex = 0; // index of pixel currently being inspected
		let runStartIndex = 0; // start of the current sequence
		let runColor = undefined; // color of the current sequence
		let runLength = 0; // length of the current sequence
		let directSeq = false; // flag indicating whether current sequence is a byte-for-byte copy from input
		let runSeq = false; // flag indicating whether current sequence is a run-length of a single value

		buffer.writeRecord(recordTypes.header, {
			width: frameWidth,
			height: frameHeight,
			negativeOffsetX: 0,
			negativeOffsetY: 0,
		});

		while (pixelIndex < pixels.length) {

			// if this pixel's color is the same as the previous pixel's...
			if (pixels[pixelIndex] == runColor) {

				runSeq = true;
				runLength++;

				// if we were in the middle of a direct copy sequence, declare that
				// sequence complete at the pixel *before the previous* (i.e. pixelIndex - 2)
				if (directSeq) {

					// we can just mask the runLength count here to make the control byte
					// (since the control byte for this type of sequence has both bits 6 and 7 cleared)
					buffer.put([(runLength - 2) & MAX_DIRECT_SEQUENCE_LEN]);
					const byteseq = pixels.slice(runStartIndex, (runStartIndex + runLength - 2));
					buffer.put(byteseq);

					directSeq = false;
					runLength = 2;
					runStartIndex = pixelIndex - 1;

				} else if ((runColor == PAL_TRANSPARENCY_INDEX) &&
					(runLength == MAX_RUNLENGTH_TRANSPARENCY)) {

					// write a control byte with the transparency bit (MSB) set, with
					// the maximum transparent pixel count (0x3F)
					buffer.put([0xFF]);

					runLength = 0;
					runStartIndex = pixelIndex + 1;
					runColor = undefined;

				} else if (runLength == MAX_RUNLENGTH_OPAQUE) {

					// write a control byte with the transparency bit clear and the
					// run-length bit set, followed by a byte with the repeating color index
					buffer.put([0x7F, runColor]);

					// reset the run length and run color, and set the next starting index to be
					// on the following pixel (since this pixel was the last of the current run)
					runSeq = false;
					runLength = 0;
					runStartIndex = pixelIndex + 1;
					runColor = undefined;
				}

			} else {
				// otherwise, this pixel's color doesn't match the previous

				if (directSeq) {

					// we're already in the middle of a direct copy sequence,
					// so increment its length
					runLength++;

					if (runLength == MAX_DIRECT_SEQUENCE_LEN) {

						// we got to the max length of a direct copy sequence, so write
						// that sequence to the output buffer
						buffer.put([MAX_DIRECT_SEQUENCE_LEN]); // control byte; note bits 6-7 are clear
						const byteseq = pixels.slice(runStartIndex, (runStartIndex + runLength));
						buffer.put(byteseq);

						directSeq = false;
						runLength = 0;
						runStartIndex = pixelIndex + 1;
					}
				} else if (runSeq) {

					// we were in a color/transparency run, but that run has now ended
					// so write the encoding to the output buffer
					const ctrlBits = (runColor == PAL_TRANSPARENCY_INDEX) ? 0x80 : 0x40;
					const countMask = (runColor == PAL_TRANSPARENCY_INDEX) ? 0x7F : 0x3F;
					const ctrlByte = ctrlBits | (runLength & countMask);
					buffer.put([ctrlByte, runColor]);

					runSeq = false;
					runLength = 1; // this is already the first byte of the next sequence
					runStartIndex = pixelIndex;
				} else {

					runLength++;

					// if we've seen a consecutive pair of dissimilar pixels that weren't at
					// the boundary between two runs, then we will need to do a direct copy sequence
					if (runLength > 1) {
						directSeq = true;
					}
				}

				runColor = pixels[pixelIndex];
			}

			pixelIndex++;
		}

		// if there's an unfinished sequence at the end, write it out now
		if (runLength > 0) {
			if (runSeq) {
				const ctrlBits = (runColor == PAL_TRANSPARENCY_INDEX) ? 0x80 : 0x40;
				const countMask = (runColor == PAL_TRANSPARENCY_INDEX) ? 0x7F : 0x3F;
				const ctrlByte = ctrlBits | (runLength & countMask);
				buffer.put([ctrlByte, runColor]);
			} else {
				const ctrlByte = (runLength & MAX_DIRECT_SEQUENCE_LEN);
				buffer.put([ctrlByte]);
				const byteseq = pixels.slice(runStartIndex, (runStartIndex + runLength));
				buffer.put(byteseq);
			}
		}

		return {
			content: {
				main: buffer.getU8(),
			},
			warnings: [],
		};
	}
}
