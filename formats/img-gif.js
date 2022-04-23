/*
 * GIF image handler
 *
 * Copyright (C) 2010-2022 Adam Nielsen <malvineous@shikadi.net>
 * Copyright (C) 2022 Colin Bourassa
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

import {
	RecordBuffer,
	RecordType
} from '@camoto/record-io-buffer';
import {
	cmp_lzw
} from '@camoto/gamecomp';
import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Frame from '../interface/frame.js';
import Palette from '../interface/palette.js';

const HEADER_MAGIC_LEN = 6;
const LOGICAL_SCREEN_DESC_LEN = 7;

const EXTENSION_INTRODUCER = 0x21;
const EXTENSION_TYPE_GFX_CTRL = 0xF9;
const EXTENSION_TYPE_APPLICATION = 0xFF;

const IMG_DESC_INTRODUCER = 0x2C;
const TRAILER = 0x3B;

const recordTypes = {

	logicalScreenDescriptor: {
		canvasWidth: RecordType.int.u16le,
		canvasHeight: RecordType.int.u16le,
		// packedField is a bitfield containing the following:
		//  7:    Global color table flag
		//  6..4: Color resolution
		//  3:    Sort flag
		//  2..0: Global color table size
		packedField: RecordType.int.u8,
		bgColorIndex: RecordType.int.u8,
		pixelAspectRatio: RecordType.int.u8,
	},

	// This record omits the Graphic Control Label (0xF9), which identifies this
	// as a Graphic Control Extension and appears immediately before it in the
	// file. The 0xF9 identifier itself follows the 0x21 Extension Introducer.
	gfxCtrlExtension: {
		byteSize: RecordType.int.u8, // always 0x04
		packedField: RecordType.int.u8,
		delayTime: RecordType.int.u16le,
		transparentColorIndex: RecordType.int.u8,
		blockTerminator: RecordType.int.u8, // always 0x00
	},

	// This record is for the Netscape extension that allows animation looping.
	appExtensionNetscape: {
		byteSize: RecordType.int.u8, // always 0x0B
		identifier: RecordType.string.fixed.noTerm(8), // always "NETSCAPE"
		appCode: RecordType.string.fixed.noTerm(3), // always "2.0"
		lenSubBlock: RecordType.int.u8, // always 3
		lenUnknown: RecordType.int.u8, // always 1
		loopCount: RecordType.int.u16le,
		blockTerminator: RecordType.int.u8, // always 0x00
	},

	// Similarly to the gfxCtrlExtension record (above), this
	// record definition omits its introducer byte (0x2C).
	imageDescriptor: {
		imageLeft: RecordType.int.u16le,
		imageTop: RecordType.int.u16le,
		imageWidth: RecordType.int.u16le,
		imageHeight: RecordType.int.u16le,
		packedField: RecordType.int.u8,
	},
};

/**
 * There is at least one known variant on the GIF format that uses a different
 * magic word in the header. As a result, GIF support is implemented here with
 * a common base class from which variants may derive.
 */
class img_gif_base extends ImageHandler {

	static getMagicWord() {
		return '';
	}

	static getExtensionsAllowed() {
		return false;
	}

	static metadata() {
		let md = super.metadata();

		md.limits.minimumSize.x = 1;
		md.limits.minimumSize.y = 1;
		md.limits.maximumSize.x = undefined;
		md.limits.maximumSize.y = undefined;
		md.limits.depth = 8;
		md.limits.hasPalette = true;
		md.limits.paletteDepth = 8;
		md.limits.frameCount.min = 1;
		md.limits.frameCount.max = 1;

		return md;
	}

	static identify(content) {

		const expectedMagic = this.getMagicWord();
		const extensionsAllowed = this.getExtensionsAllowed();

		if (content.length < (HEADER_MAGIC_LEN + LOGICAL_SCREEN_DESC_LEN)) {
			return {
				valid: false,
				reason: `File size is smaller than minimal header information.`,
			};
		}

		let buffer = new RecordBuffer(content);
		let magic = buffer.get(HEADER_MAGIC_LEN);

		for (var i = 0; i < HEADER_MAGIC_LEN; i++) {
			if (magic[i] !== expectedMagic.charCodeAt(i)) {
				return {
					valid: false,
					reason: `Header magic word not found.`,
				};
			}
		}

		const logicalDesc = buffer.readRecord(recordTypes.logicalScreenDescriptor);
		const usingGlobalColor = logicalDesc.packedField & 0x80;
		const globalColorTableSize = (1 << ((logicalDesc.packedField & 0x07) + 1)) * 3;

		if (usingGlobalColor) {
			if (buffer.distFromEnd() < globalColorTableSize) {
				return {
					valid: false,
					reason: `File size too small to contain claimed global color table.`,
				};
			}

			buffer.seekRel(globalColorTableSize);
		}

		let foundTrailer = false;
		let foundImageData = false;

		// Loop, parsing any extension or data blocks contained in the file.
		while ((buffer.distFromEnd() > 0) && !foundTrailer) {
			let introducer = buffer.read(RecordType.int.u8);

			if (introducer == EXTENSION_INTRODUCER) {

				// Only continue to parse the extension payload if extensions are actually
				// supported by this revision of the GIF standard
				if (extensionsAllowed) {

					// Confirm that more data exists, as the next byte is expected to be
					// an extension identifier
					if (buffer.distFromEnd() > 0) {

						// Since we're only checking for file validity here, we don't need
						// to discriminate between extension types for any reason. The
						// format of their data payloads is all fundamentally the same,
						// being an arbitrary number of data subblocks, each prefixed with
						// a single byte indicating the subblock length in bytes.
						// Just advance past the extension identifier byte.
						buffer.seekRel(1);

						// Consume subblock data until we get a subblock of length 0
						// (which indicates the end of this extension's data) or we
						// run out of data in the buffer.
						let subBlockLen = -1;
						if (buffer.distFromEnd() > 0) {
							subBlockLen = buffer.read(RecordType.int.u8);
							while ((subBlockLen > 0) && (buffer.distFromEnd() > 0)) {
								// Skip past this subblock
								buffer.seekRel(subBlockLen);
								subBlockLen = (buffer.distFromEnd() > 0) ? buffer.read(RecordType.int.u8) : 0;
							}
						}

						if (subBlockLen != 0) {
							return {
								valid: false,
								reason: `File contains an invalid Plain Text or Comment extension.`,
							};
						}

					} else {
						return {
							valid: false,
							reason: `File contains insufficient data for extension block.`,
						};
					}
				} else {
					// We've encountered an extension block, but extensions are not
					// supported by this revision of the GIF standard.
					return {
						valid: false,
						reason: `File contains an extension, which is not supported.`,
					};
				}

			} else if (introducer === IMG_DESC_INTRODUCER) {

				if (buffer.distFromEnd() >= 9) {

					const imgDesc = buffer.readRecord(recordTypes.imageDescriptor);

					// If a local color table is being used, calculate its size so that
					// we can jump past it in the buffer.
					let localColorTableSize = 0;
					if (imgDesc.packedField & 0x80) {
						localColorTableSize = (1 << ((imgDesc.packedField & 0x07) + 1)) * 3;
					}

					if (buffer.distFromEnd() >= localColorTableSize) {
						buffer.seekRel(localColorTableSize);
					} else {
						return {
							valid: false,
							reason: `File contains an incomplete local color table.`,
						};
					}

					// Need at least two more bytes to get started reading the image data.
					if (buffer.distFromEnd() >= 2) {

						// Check that the LZW minimum code size is valid
						const lzwMinCodeSize = buffer.read(RecordType.int.u8);
						if ((lzwMinCodeSize < 2) || (lzwMinCodeSize > 12)) {
							return {
								valid: false,
								reason: `LZW minimum code size (${lzwMinCodeSize}) is outside valid range for GIF (2 to 12).`,
							};
						}

						let subBlockLen = buffer.read(RecordType.int.u8);
						while ((subBlockLen > 0) && (buffer.distFromEnd() > 0)) {
							// Skip past this subblock
							buffer.seekRel(subBlockLen);
							subBlockLen = (buffer.distFromEnd() > 0) ? buffer.read(RecordType.int.u8) : 0;
						}

						if (subBlockLen == 0) {
							foundImageData = true;
						} else {
							return {
								valid: false,
								reason: `File contains an incomplete image data subblock.`,
							};
						}
					} else {
						return {
							valid: false,
							reason: `File contains an incomplete image data block.`,
						};
					}
				} else {
					return {
						valid: false,
						reason: `File contains insufficient data to complete image descriptor.`,
					};
				}
			} else if (introducer == TRAILER) {
				foundTrailer = true;
			}
		}

		if (!foundImageData) {
			return {
				valid: false,
				reason: `File ends without containing at least one image data block.`,
			};
		}

		return {
			valid: true,
			reason: `Potentially valid GIF image, pending decode.`,
		};
	}

	static read(content) {

		const extensionsAllowed = this.getExtensionsAllowed();
		let buffer = new RecordBuffer(content.main);
		let gifFrames = [];

		// We've previously identified this file, so we can skip past the header.
		buffer.seekRel(HEADER_MAGIC_LEN);

		const logicalDesc = buffer.readRecord(recordTypes.logicalScreenDescriptor);
		const usingGlobalColor = logicalDesc.packedField & 0x80;
		const globalColorBpp = (logicalDesc.packedField & 0x07) + 1;
		const globalTableColorCount = (1 << globalColorBpp);

		let globalPal = new Palette(globalTableColorCount);

		// If a global color table is being used...
		if (usingGlobalColor) {
			for (let i = 0; i < globalTableColorCount; i++) {
				let r = buffer.read(RecordType.int.u8);
				let g = buffer.read(RecordType.int.u8);
				let b = buffer.read(RecordType.int.u8);
				globalPal[i] = [r, g, b, 255];
			}
		}

		let foundTrailer = false;
		let delayTimeMs = null;

		// Loop, parsing any extension or data blocks contained in the file.
		while ((buffer.distFromEnd() > 0) && !foundTrailer) {
			let introducer = buffer.read(RecordType.int.u8);

			if (introducer == EXTENSION_INTRODUCER) {
				if (extensionsAllowed) {
					const extType = buffer.read(RecordType.int.u8);

					// The only information that we use from any of the extensions is the
					// delay time between frames, provided by the Graphic Control Extension.
					if (extType == EXTENSION_TYPE_GFX_CTRL) {
						const gfxCtrl = buffer.readRecord(recordTypes.gfxCtrlExtension);
						// Assume that valid animation frame delays must be positive, given
						// that animations cannot run infinitely fast.
						if (gfxCtrl.delayTime > 0) {
							delayTimeMs = (gfxCtrl.delayTime * 10);
						}
					} else {
						// We're not doing anything with the data in this extension,
						// so just skip past it.
						let subBlockLen = buffer.read(RecordType.int.u8);
						while (subBlockLen > 0) {
							buffer.seekRel(subBlockLen);
							subBlockLen = buffer.read(RecordType.int.u8);
						}
					}
				} else {
					throw new Error(`Encountered extension block in a GIF variant that does not support extensions.`);
				}
			} else if (introducer === IMG_DESC_INTRODUCER) {

				const imgDesc = buffer.readRecord(recordTypes.imageDescriptor);

				let localTableColorCount = 0;
				let localPal = null;

				// If a local color table is being used...
				if (imgDesc.packedField & 0x80) {
					localTableColorCount = (1 << ((imgDesc.packedField & 0x07) + 1));
					localPal = new Palette(localTableColorCount);
					for (let i = 0; i < localTableColorCount; i++) {
						let r = buffer.read(RecordType.int.u8);
						let g = buffer.read(RecordType.int.u8);
						let b = buffer.read(RecordType.int.u8);
						localPal[i] = [r, g, b, 255];
					}
				}

				const lzwMinCodeSize = buffer.read(RecordType.int.u8);
				const clearCode = (1 << lzwMinCodeSize);
				const eoiCode = clearCode + 1;
				const firstAvailCode = eoiCode + 1;

				// Iterate over all the data subblocks that make up the image data,
				// collecting it all into an array for LZW decompression
				let lzwDataArr = [];
				let imgDataSubblockSize = buffer.read(RecordType.int.u8);
				while (imgDataSubblockSize > 0) {
					let lzwSubblockData = Array.from(buffer.get(imgDataSubblockSize));
					lzwDataArr = lzwDataArr.concat(lzwSubblockData);
					imgDataSubblockSize = buffer.read(RecordType.int.u8);
				}

				const lzwParams = {
					initialBits: lzwMinCodeSize + 1,
					maxBits: 12,
					cwFirst: firstAvailCode,
					cwEOF: eoiCode,
					cwDictReset: clearCode,
					resetDictWhenFull: false,
					resetCodewordLen: true,
					flushOnReset: false,
				};


				let lzwData = new Uint8Array(lzwDataArr);
				let pixelData = cmp_lzw.reveal(lzwData, lzwParams);
				let curFrame = new Frame({
					width: imgDesc.imageWidth,
					height: imgDesc.imageHeight,
					pixels: pixelData,
				});

				if (localPal !== null) {
					curFrame.palette = localPal;
				}
				gifFrames.push(curFrame);

			} else if (introducer == TRAILER) {
				foundTrailer = true;
			}
		}

		let finalImg = new Image({
			width: logicalDesc.canvasWidth,
			height: logicalDesc.canvasHeight,
			frames: gifFrames,
			palette: globalPal,
		});

		// If a positive delay time was given by the Graphics Control Extension,
		// use this as the inter-frame delay for the animation.
		if (delayTimeMs !== null) {
			let anim = [];
			for (let f = 0; f < gifFrames.length; f++) {
				anim.push({
					index: f,
					postDelay: delayTimeMs,
				});
			}
			finalImg.animation = anim;
		}

		return finalImg;
	}

	static write(image, options = {}) {

		const headerMagicWord = this.getMagicWord();
		const extensionsAllowed = this.getExtensionsAllowed();

		if (image.frames.length < 1) {
			if (extensionsAllowed) {
				throw new Error(`This format requires at least one frame.`);
			} else {
				throw new Error(`This format requires exactly one frame.`);
			}
		} else if (!extensionsAllowed && (image.frames.length > 1)) {
			throw new Error(`This GIF type does not support multiple frames.`);
		}

		let buffer = new RecordBuffer(image.frames[0].pixels.length);

		for (let i = 0; i < HEADER_MAGIC_LEN; i++) {
			buffer.write(RecordType.int.u8, headerMagicWord.charCodeAt(i));
		}

		let globalWidth = (image.width === undefined) ? 0 : image.width;
		let globalHeight = (image.height === undefined) ? 0 : image.height;
		for (let f = 0; f < image.frames.length; f++) {
			if (image.frames[f].width > globalWidth) {
				globalWidth = image.frames[f].width;
			}
			if (image.frames[f].height > globalHeight) {
				globalHeight = image.frames[f].height;
			}
		}

		let logicalDescPackedField = 0x00;
		let useGlobalColor = false;
		let globalColorResPower = 0;
		let transparentIndex = -1;

		// If we've been provided with a global palette...
		if (image.palette !== undefined) {

			if (image.palette.length > 256) {
				throw new Error(`Palette too large; this format supports a maximum of 8bpp of color indexing.`);
			}

			useGlobalColor = true;
			logicalDescPackedField |= 0x80;
			// It seems as though the "Color Resolution" field does not necessarily
			// have a rigorous definition per the spec, and that it may not be used
			// by many editors and viewers. It often (but not always?) contains the
			// same value as the "Size of Global Color Table" field, but the latter
			// is needed for determining the actual number of bytes occupied by the
			// the GCT.
			while ((1 << (globalColorResPower + 1)) < image.palette.length) {
				globalColorResPower++;
			}
			logicalDescPackedField |= (globalColorResPower << 4);
			logicalDescPackedField |= globalColorResPower;

			// Find the first global color with a fully transparent alpha. If none
			// are found, let this index variable remain at -1 as an indicator.
			transparentIndex = image.palette.findIndex(p => p[3] === 0);
		}

		buffer.writeRecord(recordTypes.logicalScreenDescriptor, {
			canvasWidth: globalWidth,
			canvasHeight: globalHeight,
			packedField: logicalDescPackedField,
			bgColorIndex: 0,
			pixelAspectRatio: 0,
		});

		if (useGlobalColor) {
			for (let p = 0; p < image.palette.length; p++) {
				buffer.write(RecordType.int.u8, image.palette[p][0]);
				buffer.write(RecordType.int.u8, image.palette[p][1]);
				buffer.write(RecordType.int.u8, image.palette[p][2]);
			}
		}

		// If this is a GIF revision that supports extensions, we can use the
		// Graphics Control Extension to record the delay time (for animations)
		// and/or a transparent color index from the global palette.
		if (extensionsAllowed &&
			((transparentIndex >= 0) || (image.animation.length > 0))) {

			// The loop count extension must immediately follow the global color
			// table.  Defaults to 0 (loop forever) but a specific number of loops can
			// be supplied.  `null` means omit the loop block entirely.
			const loopCount = (options.loop === undefined) ? 0 : options.loop;
			if (loopCount !== null) {
				buffer.write(RecordType.int.u8, EXTENSION_INTRODUCER);
				buffer.write(RecordType.int.u8, EXTENSION_TYPE_APPLICATION);
				buffer.writeRecord(recordTypes.appExtensionNetscape, {
					byteSize: 0x0B,
					identifier: 'NETSCAPE',
					appCode: '2.0',
					lenSubBlock: 0x03,
					lenUnknown: 0x01,
					loopCount: loopCount,
					blockTerminator: 0x00,
				});
			}

			buffer.write(RecordType.int.u8, EXTENSION_INTRODUCER);
			buffer.write(RecordType.int.u8, EXTENSION_TYPE_GFX_CTRL);
			buffer.writeRecord(recordTypes.gfxCtrlExtension, {
				byteSize: 0x04,
				// The only relevant field in this 'Packed Fields' byte is the transparent color flag
				// at bit 0, which is set only if there is a transparent color in the global palette.
				packedField: (transparentIndex >= 0) ? 0x01 : 0x00,
				// Use the delay from the first animation frame as the GIF animation delay. It is safe
				// to use a delay of 0 if there is no multi-frame animation in the input image.
				delayTime: (image.animation.length > 0) ?
					Math.floor(image.animation[0].postDelay / 10) : 0,
				transparentColorIndex: (transparentIndex >= 0) ? transparentIndex : 0x00,
				blockTerminator: 0x00,
			});
		}

		// TODO: This writes out frames as-is, but it needs to read image.animation
		// and look at the `index` property to figure out which frame to write.
		for (let f = 0; f < image.frames.length; f++) {

			// Begin building the image descriptor
			buffer.write(RecordType.int.u8, IMG_DESC_INTRODUCER);

			let imgDescPackedField = 0;
			let useLocalColor = false;
			let localColorResPower = 0;

			// If this frame has a frame-specific palette, then determine its
			// necessary size as a power of 2, and add this information to the
			// packed field.
			if (image.frames[f].palette !== undefined) {

				if (image.frames[f].palette.length > 256) {
					throw new Error(`Palette too large; this format supports a maximum of 8bpp of color indexing.`);
				}

				useLocalColor = true;
				while ((1 << (localColorResPower + 1)) < image.frames[f].palette.length) {
					localColorResPower++;
				}
				imgDescPackedField |= (0x80 | localColorResPower);
			}

			buffer.writeRecord(recordTypes.imageDescriptor, {
				imageLeft: 0,
				imageTop: 0,
				imageWidth: (image.frames[f].width === undefined) ?
					globalWidth : image.frames[f].width,
				imageHeight: (image.frames[f].height === undefined) ?
					globalHeight : image.frames[f].height,
				packedField: imgDescPackedField,
			});

			// Write out the Local Color Table data, if it exists
			if (useLocalColor) {
				for (let p = 0; p < image.frames[f].palette; p++) {
					buffer.write(RecordType.int.u8, image.frames[f].palette[p][0]);
					buffer.write(RecordType.int.u8, image.frames[f].palette[p][1]);
					buffer.write(RecordType.int.u8, image.frames[f].palette[p][2]);
				}
			}

			// Determine the appropriate values for the LZW codes and sizing
			const lzwMinCodeSize = useLocalColor ? (localColorResPower + 1) : (globalColorResPower + 1);
			const clearCode = (1 << lzwMinCodeSize);
			const eoiCode = clearCode + 1;
			const firstAvailCode = eoiCode + 1;

			const lzwParams = {
				initialBits: lzwMinCodeSize + 1,
				maxBits: 12,
				cwFirst: firstAvailCode,
				cwEOF: eoiCode,
				cwDictReset: clearCode,
				resetDictWhenFull: false,
				resetCodewordLen: true,
				flushOnReset: false,
			};

			let lzwCompData = cmp_lzw.obscure(image.frames[f].pixels, lzwParams);

			buffer.write(RecordType.int.u8, lzwMinCodeSize);

			let compStreamPos = 0;
			while (compStreamPos < lzwCompData.length) {
				const bytesInCurSubblock = ((lzwCompData.length - compStreamPos) > 255) ?
					255 : (lzwCompData.length - compStreamPos);
				buffer.write(RecordType.int.u8, bytesInCurSubblock);
				buffer.put(lzwCompData.slice(compStreamPos, compStreamPos + bytesInCurSubblock));
				compStreamPos += bytesInCurSubblock;
			}

			// Write one last subblock length of zero to indicate that we're finished
			buffer.write(RecordType.int.u8, 0);
		}

		buffer.write(RecordType.int.u8, TRAILER);

		return {
			content: {
				main: buffer.getU8(),
			},
			warnings: [],
		};
	}
}

export class img_gif_87a extends img_gif_base {

	static metadata() {
		return {
			...super.metadata(),
			id: 'img-gif-87a',
			title: 'GIF 87a',
			options: {},
			glob: [
				'*.gif',
			],
		};
	}

	static getMagicWord() {
		return 'GIF87a';
	}
}

export class img_gif_89a extends img_gif_base {

	static metadata() {
		let md = super.metadata();
		md.limits.frameCount.max = undefined;
		return {
			...md,
			id: 'img-gif-89a',
			title: 'GIF 89a',
			options: {
				loop: 'Number of times to loop if the image is animated, 0=forever, '
					+ 'null=omit loop block entirely',
			},
			glob: [
				'*.gif',
			],
		};
	}

	static getMagicWord() {
		return 'GIF89a';
	}

	static getExtensionsAllowed() {
		return true;
	}
}

export class img_imagex extends img_gif_87a {

	static metadata() {
		return {
			...super.metadata(),
			id: 'img-imagex',
			title: 'Imagexcel IMG',
			glob: [
				'*.img',
			],
		};
	}

	static getMagicWord() {
		return 'IMAGEX';
	}
}
