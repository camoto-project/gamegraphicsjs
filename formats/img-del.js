/*
 * Delta (.del) image handler
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

const FORMAT_ID = 'img-del';

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
	},
};

const DEL_HEADER_SIZE_BYTES = 4;
const PAL_TRANSPARENCY_INDEX = 0xFF;
const MAX_RUNLENGTH_TRANSPARENCY = 0xFF;
const MAX_RUNLENGTH_6BIT = 0x3F;

const deltaTable = [0, 1, 2, 3, 4, 5, 6, 7, -8, -7, -6, -5, -4, -3, -2, -1];

const NEGATIVE_DELTA_LIMIT = -8;
const POSITIVE_DELTA_LIMIT = 7;

export default class Image_Del extends ImageHandler {
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Delta image',
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

		if (content.length < DEL_HEADER_SIZE_BYTES) {
			return {
				valid: false,
				reason: `File size is smaller than minimum possible size for 0x0 image.`,
			};
		}

		let buffer = new RecordBuffer(content);
		const header = buffer.readRecord(recordTypes.header);
		const reportedPixelCount = header.width * header.height;
		const rasterDataSize = content.length - DEL_HEADER_SIZE_BYTES;

		// We can compute a minimum possible image size (in pixel count)
		// for a given DEL file by assuming the least efficient packing
		// possible, which is 2 bytes per pixel.
		// (Theoretically, a DEL file could contain any number of zero-pixel
		// transparency commands, which means that the file data could
		// be arbitrarily large relative to the image size. We're going
		// to assume that this would not actually occur in any file.)
		const minPossiblePixelCount = Math.floor(rasterDataSize / 2);

		// The maximum possible pixel count (based on file size) would be
		// in a file that consists only of transparency. In this case, every
		// pair of bytes would generate 255 transparent pixels.
		const maxPossiblePixelCount = Math.ceil(rasterDataSize / 2) * 255;

		if (reportedPixelCount < minPossiblePixelCount) {
			return {
				valid: false,
				reason: `Image header reports pixel count of ${reportedPixelCount} but length ` +
					`(${content.length}) would result in a minimum possible size of ${minPossiblePixelCount}.`,
			};
		}

		if (reportedPixelCount > maxPossiblePixelCount) {
			return {
				valid: false,
				reason: `Image header reports pixel count of ${reportedPixelCount} but length ` +
					`(${content.length}) would result in a maximum possible size of ${maxPossiblePixelCount}.`,
			};
		}

		return {
			valid: true,
			reason: `Potentially valid DEL image, pending decode.`,
		};
	}

	static read(content) {

		let buffer = new RecordBuffer(content.main);
		const header = buffer.readRecord(recordTypes.header);

		let out = new Uint8Array(header.width * header.height);
		let inputPos = DEL_HEADER_SIZE_BYTES;
		let outputPos = 0;

		while (inputPos < content.main.length) {
			const cmdbyte = content.main[inputPos];
			let databyte = 0;
			inputPos++;

			if (cmdbyte & 0x01) {
				// We'll be writing the byte from the input stream to the output at least once,
				// so grab the input byte now
				databyte = content.main[inputPos++];

				if (cmdbyte & 0x02) {
					// single byte copy from input (low two bits of command are 11)
					out[outputPos++] = databyte;
				} else {
					// repeat byte from input (low two bits of command are 01)
					for (let repeatidx = 0; repeatidx < (cmdbyte >> 2); repeatidx++) {
						out[outputPos++] = databyte;
					}
				}
			} else {
				if (cmdbyte & 0x02) {
					// Transparency run (low two bits are 10)

					let length = (cmdbyte >> 2);

					// The next byte from the input is used as the repeat count if and only if
					// the top six bits of the command byte are zeroed
					if (length == 0) {
						length = content.main[inputPos++];
					}

					for (let repeatidx = 0; repeatidx < length; repeatidx++) {
						out[outputPos++] = PAL_TRANSPARENCY_INDEX;
					}
				} else {
					// Delta encoding sequence (low two bits are 00)

					// Length of the sequence, including the first literal byte
					const length = (cmdbyte >> 2);

					if (length > 0) {
						// First byte written to the output will be the next byte in the input stream
						databyte = content.main[inputPos++];
						out[outputPos++] = databyte;

						let sequenceCount = 1;

						while (sequenceCount < length) {
							let nibble = content.main[inputPos] >> 4;

							databyte += deltaTable[nibble];
							out[outputPos++] = databyte;
							sequenceCount++;

							// Only process the second nibble if we haven't yet completed the sequence;
							// if the sequence does not require this nibble then it's simply wasted
							if (sequenceCount < length) {
								nibble = content.main[inputPos] & 0x0F;
								databyte += deltaTable[nibble];
								out[outputPos++] = databyte;
								sequenceCount++;
							}

							inputPos++;
						}
					}
				}
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

	static writeDeltaSeq(buffer, deltaRunVals) {
		const deltaRunCmd = (deltaRunVals.length << 2);
		buffer.put([deltaRunCmd, deltaRunVals[0]]);

		// Pack two delta values into each output byte; one per nibble.
		for (let i = 1; i < deltaRunVals.length - 1; i += 2) {
			buffer.put([(deltaRunVals[i] << 4) | (deltaRunVals[i + 1])]);
		}

		// If there are a even number of pixels in the sequence, then the
		// last byte will use only the high nibble. The very first pixel
		// in the sequence is a literal value (not a delta) and it occupies
		// a byte of its own.
		if (deltaRunVals.length % 2 == 0) {
			buffer.put([deltaRunVals[deltaRunVals.length - 1] << 4]);
		}
	}

	static writeSingleColorRun(buffer, color, length) {
		if (color == PAL_TRANSPARENCY_INDEX) {

			if (length <= MAX_RUNLENGTH_6BIT) {

				const transparencyCmd = 0x02 | (length << 2);
				buffer.put([transparencyCmd]);

			} else if (length <= MAX_RUNLENGTH_TRANSPARENCY) {

				// When the runlength of the transparency is greater than a full
				// 6-bit count, leave those bits zeroed and write an additional
				// byte containing the count.
				buffer.put([0x02, length]);

			} else {
				throw new Error(`Transparency run of length ${length} exceeds maximum of ${MAX_RUNLENGTH_TRANSPARENCY}.`);
			}
		} else {

			if (length <= MAX_RUNLENGTH_6BIT) {

				const singleColorCmd = 0x01 | (length << 2);
				buffer.put([singleColorCmd, color]);

			} else {
				throw new Error(`Single-color run of length ${length} exceeds maximum of ${MAX_RUNLENGTH_6BIT}.`);
			}
		}
	}

	static write(image) {
		if (image.frames.length !== 1) {
			throw new Error(`Can only write one frame to this format.`);
		}

		const frame = image.frames[0];
		const frameWidth = (frame.width === undefined) ? image.width : frame.width;
		const frameHeight = (frame.height === undefined) ? image.height : frame.height;
		const pixels = frame.pixels;

		let buffer = new RecordBuffer(frame.pixels.length + DEL_HEADER_SIZE_BYTES);

		let pixelIndex = 0; // index of pixel currently being inspected
		let runStartIndex = undefined; // start index of the current single-color run
		let lastColor = undefined; // color of the previous pixel
		let deltaRunVals = []; // initial literal value and subsequent delta indices for a delta sequence
		let lastPixelInSequence = undefined; // flag: whether the previous pixel was part of a running sequence

		buffer.writeRecord(recordTypes.header, {
			width: frameWidth,
			height: frameHeight,
		});

		while (pixelIndex < pixels.length) {

			// if this pixel's color is the same as the previous pixel's...
			if (pixels[pixelIndex] == lastColor) {

				if (runStartIndex != undefined) {

					// We've already started a single-color run. Check whether it
					// has yet reached the maximum length.

					const runLength = pixelIndex - runStartIndex + 1;

					// If we're reached the maximum possible run length for either
					// a transparency or a single color, stop the run and write it
					// to the output now.
					if (((lastColor == PAL_TRANSPARENCY_INDEX) && (runLength == MAX_RUNLENGTH_TRANSPARENCY)) ||
						((lastColor != PAL_TRANSPARENCY_INDEX) && (runLength == MAX_RUNLENGTH_6BIT))) {

						this.writeSingleColorRun(buffer, lastColor, runLength);
						runStartIndex = undefined;
						lastColor = undefined;
					}

				} else if (deltaRunVals.length > 0) {

					// A delta sequence was previously started, so continue it.
					deltaRunVals.push(0);

					if (deltaRunVals.length == MAX_RUNLENGTH_6BIT) {
						this.writeDeltaSeq(buffer, deltaRunVals);
						deltaRunVals = [];
					}
					lastPixelInSequence = true;

				} else if ((pixelIndex < (pixels.length - 1)) && (pixels[pixelIndex + 1] == lastColor)) {

					// There are at least three consecutive pixels with the same value.
					// Start a single-color run.

					lastPixelInSequence = true;
					runStartIndex = pixelIndex - 1;

				} else {

					// The run of consecutive like pixels is not long enough to
					// start a single-color run, so start a delta sequence instead.

					deltaRunVals.push(lastColor);
					deltaRunVals.push(0);
					lastPixelInSequence = true;
				}

			} else {
				// Otherwise, this pixel's color doesn't match the previous
				// (or we need to look for the start of the next run)

				if (runStartIndex != undefined) {

					// We were in the middle of a run of identical pixels, so end that
					// run and write it to the output.

					lastPixelInSequence = false;

					const runLength = pixelIndex - runStartIndex;
					this.writeSingleColorRun(buffer, lastColor, runLength);
					runStartIndex = undefined;

				} else if (((pixels[pixelIndex] - lastColor) >= NEGATIVE_DELTA_LIMIT) &&
					((pixels[pixelIndex] - lastColor) <= POSITIVE_DELTA_LIMIT)) {

					// This pixel's color can be expressed as a delta from the previous pixel

					lastPixelInSequence = true;

					if (deltaRunVals.length == 0) {
						deltaRunVals.push(lastColor);
					}

					// Compute the delta value and add it to the list
					const deltaFromLast = pixels[pixelIndex] - lastColor;
					const tableIndexOfDelta = deltaTable.indexOf(deltaFromLast);
					deltaRunVals.push(tableIndexOfDelta);

					// If we've reached the maximum length of a delta sequence,
					// end the sequence and write it to the output.
					if (deltaRunVals.length >= MAX_RUNLENGTH_6BIT) {
						this.writeDeltaSeq(buffer, deltaRunVals);
						deltaRunVals = [];
					}

				} else {

					// This pixel's value cannot be covered by a delta from the last pixel

					if (deltaRunVals.length > 0) {
						// we had previously started a delta sequence, so we need to end that now
						// and write it to the output
						this.writeDeltaSeq(buffer, deltaRunVals);
						deltaRunVals = [];
					}

					// If we get here, the current pixel doesn't match the previous,
					// and it also can't be expressed as a delta from the previous.
					// If the previous pixel didn't fit into a runlength/delta sequence,
					// then we need to fall back to writing it out as a discrete value.
					if (lastPixelInSequence == false) {
						buffer.put([0x03, lastColor]);
					}

					lastPixelInSequence = false;
				}

				lastColor = pixels[pixelIndex];
			}

			pixelIndex++;
		}

		// TODO: write out any unfinished sequence (or individual value) at the end
		if (deltaRunVals.length > 0) {
			this.writeDeltaSeq(buffer, deltaRunVals);
		}

		return {
			content: {
				main: buffer.getU8(),
			},
			warnings: [],
		};
	}
}
