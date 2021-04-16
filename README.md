# gamegraphics.js
Copyright 2010-2021 Adam Nielsen <<malvineous@shikadi.net>>  

This is a Javascript library that can read and write the custom image formats
used by many MS-DOS games from the 1990s.  Both single-image files as well as
multi-image tilesets are supported.  This library is an attempt to provide a
unified interface for reading and writing these unique file formats.

## Supported file formats

Due to the significant variation between games, it is recommended to use
[gameinfo.js](https://github.com/Malvineous/gameinfojs) to access images
instead.  That library takes care of locating the images within the game's file,
passing the image handler the correct parameters, and so on.  It uses
gamegraphics.js internally to load the images but greatly simplifies the
process.

With gameinfojs you only need pick a game and the image to access (e.g. "title
screen"), whereas with gamegraphics.js you must extract the right file from any
archive, supply the correct format identifier, pass any options (such as the
image width and height for those formats that don't store it) and only then can
read and write the image.

| Game                      | Types                  | Code                    |
|---------------------------|------------------------|-------------------------|
| Captain Comic             | Sprites                | tls-ccomic-sprite       |
| Captain Comic             | Map tiles              | tls-ccomic-map          |
| Cosmo's Cosmic Adventures | Full-screen images     | img-raw-planar-4bpp     |
| Cosmo's Cosmic Adventures | Tilesets               | tls-cosmo               |
| Dangerous Dave            | Map tileset            | tls-ddave-{cga,ega,vga} |

## Installation as an end-user

If you wish to use the command-line `gamegfx` utility to work with game images
directly, you can install the CLI globally on your system:

    npm install -g @camoto/gamegraphics-cli

### Command line interface

The `gamegfx` utility can be used to manipulate graphics files.  Commands are
specified one after the other as parameters.  Use the `--help` option to get a
list of all the available commands.  Some quick examples:

    # Convert a single image from one format to another
    gamegfx read apogee.pcx write -t img-png apogee.png
    
    # Apply a palette during conversion, for those formats that store the
    # palette in an separate file.
    gamegfx read apogee.raw readpal apogee.pal write -t img-png apogee.png

To get a list of supported file formats, run:

    gamegfx --formats

## Installation as a dependency

If you wish to make use of the library in your own project, install it
in the usual way:

    npm install @camoto/gamegraphics

See `cli/index.js` for example use.  The quick start is:

    const GameGraphics = require('@camoto/gamegraphics');
    
    // Some formats take options.  These are usually values that can vary
    // between files, but they aren't stored in the file itself so they can't
    // easily be deduced automatically.  Options are specific to the selected
    // format handler.
    const options = {
      width: 320,
      height: 200,
    };
    
    // Read an image into memory.
    const handler = GameGraphics.getHandler('img-raw-vga');
    const content = {
        main: fs.readFileSync('image.raw'),
        // Some formats need additional files here, see handler.supps()
    };
    let image = handler.read(content, options);
    
    // Change a pixel.
    image.pixels[0] = 5;
    
    // Write the image back to disk with the modifications.
    const output = handler.write(image);
    fs.writeFileSync('out.raw', output.content.main);
    
    // Show any warnings.
    console.log(output.warnings);

## Installation as a contributor

If you would like to help add more file formats to the library, great!
Clone the repo, and to get started:

    npm install

Run the tests to make sure everything worked:

    npm test

You're ready to go!  To add a new file format:

 1. Create a new file in the `formats` folder for your format.  Copying an
    existing file that covers a similar format will help considerably.  If
    you're not sure, `images/img-raw-vga.js` is a good starting point as it is
    fairly simple.  The files that start with `img` are for formats that only
    support a single picture in each file, while files starting with `tls`
    (short for tileset) support multiple pictures ("frames") in each file.
    Files that start with `anm` are the same as `tls` but each frame is part
    of an animation sequence rather than separate images.
    
 2. Edit `formats/index.js` and add an `import` statement for your new file.
    
 3. Make a folder in `test/` for your new format and populate it with
    files similar to the other formats.  The tests work by creating
    a standard image/palette/tileset with some preset content, and
    comparing the result to what is inside this folder.
    
    You can either create these files by hand, with another utility, or if
    you are confident that your code is correct, from the code itself.  This is
    done by setting an environment variable when running the tests, which will
    cause the file produced by your code to be saved to a temporary file in the
    current directory:
    
        # Prepare the location for the test files.
        mkdir test/img-myformat/
        touch test/img-myformat/default.bin   # Repeat for all needed files
        
        # Run the tests and save the output.
        SAVE_FAILED_TEST=1 npm test
        
        # Check the failed output and if it's correct, overwrite the expected
        # output with the test result.
        mv test/img-myformat/default.bin.failed_test_output test/img-myformat/default.bin
    
    It is helpful however, to create these files first before implementing your
    new format, as then you only need to keep running the tests and tweaking
    your code until all the tests pass.
    
 4. Create a file in `test/` for any extra tests your new format needs.
    Typically all formats will at least have tests that confirm the optional
    `identify()` function (if present) is correctly rejecting files, but you
    can also add additional tests here if your format needs it.  See
    [test-img-png.js](test/test-img-png.js) for an example.
    
 5. Update the `README.md` with details of your new format and supported games.

If your file format has any sort of compression or encryption, these algorithms
should go into the `gamecomp` project instead.  This is to make it easier to
reuse the algorithms, as many of them (particularly the compression ones) are
used amongst many unrelated file formats.  All the `gamecomp` algorithms are
available to be used by any file format in this library.

During development you can test your code like this:

    # Convert a sample image to .png and view it with `xv`, with debug messages on
    $ DEBUG='gamegraphics:*' ./bin/gamegfx.js read -t img-myformat example.dat write -t img-png out.png && xv out.png

    # Make sure the format is identified correctly or if not why not
    $ DEBUG='gamegraphics:*' ./bin/gamegfx.js identify example.dat

    # Run only unit tests for the new format, with debugging on
    $ DEBUG='gamegraphics:*' npm test -- -g img-myformat

If you use `debug()` rather than `console.log()` in your code then these
messages can be left in for future diagnosis as they will only appear when the
`DEBUG` environment variable is set correctly.

### Development tips

#### Images

 * If your image has a palette, is it shared amongst other images or unique to
   the format you are implementing?  If the palette is only used by one image,
   it should be updated along with the pixel data when writing out the format.
   If however the palette is shared amongst multiple images, it should be
   implemented as a separate file format and not changed when an image is
   written, to avoid a change to one image corrupting the colours in the others.

 * Tilesets should be returned as an array of individual images.  This allows
   map editors to draw the tiles singly.  For those games where the tilesets
   are more easily edited as a single large image, gameinfo.js can be used to
   combine all the tiles into a single image and split them out again when
   changing the tileset.  See `game-ddave` for an example of how this is done.

#### File formats

 * `tls-ddave-vga` is stored inside the game's .exe files, so
   [gamearchive.js](https://github.com/Malvineous/gamearchivejs) is used to
   extract that.  It is compressed, but the EGA version of the graphics is
   stored outside the .exe and not compressed, so it was decided that
   compression is unique to the .exe and not part of the tileset format.  Thus
   gamearchive.js takes care of the decompression for CGA and VGA graphics,
   while the EGA graphics are read as-is.  gamegraphics.js still has to decode
   the data as due to a bug in the way the game reads the files, it skips one
   byte every 64 kB so a gamecomp.js filter is used to add and remove these
   extra bytes.

## Known issues

pngjs cannot write indexed .png images, only 24-bit RGBA.  This means the
palette is lost when exporting to .png, and importing from .png is not possible
unless an external editor is used to reduce the file back to indexed while
matching the destination palette (practically impossible).  Hopefully at some
point full indexed support can be added to pngjs.
