# LegacyBloomPlayer

We are trying to retire this repo, which has been replaced by bloom-player. The single-page javascript is still used by the current version of BloomReader (1.X), which we are also trying to retire. Please don't use it for any new Bloom projects!

Navigate **Bloom** books while basking in sound and motion

1. One output, `bloomPlayer.js`, is consumed by the **Bloom Desktop** project for the Cmd Line Interface option **_-hydrate_**. When dropped into a Bloom Book html file, it should provide a basic "player" that work in browsers and phone apps.

2. A second output, `bloomPagePlayer.js`, contains only the code for dealing with a single page and is consumed by the BloomReader Android app.

The **BloomPlayer** handles:

* turning pages
* adjusting to device screens

In addition, for **Bloom** books with multimedia content, **BloomPlayer** handles:

* playing narration (from **Bloom**'s *Talking Book Tool*)
* highlighting sentences as you listen to narration
* Ken Burns-style animation (from **Bloom**'s *Motion Tool*)
* background music (from **Bloom**'s *Music Tool*)
* playing videos (from **Bloom**'s *Sign Language Tool*)

## Dependencies
Node version >= 5.0 and NPM >= 3**.

## Building
    npm install
    webpack

For a continuous build:

    webpack -w

For a production build:

    npm run build:prod

## Testing with a book while hacking on the code

You'll need to get a Bloom book, then add a link with a path to the bloomPlayer.js in it. There are a couple ways to do that:

If you will be using a file system URL, you can do:

```<script src="path-to-bloomPlayer/output/bloomPlayer.js"></script>```

But that doesn't work well if you're testing via a server. If instead you set up a hardlink so that it looks like the file is there:

    mklink /H bloomPlayer.js the-path-to-the-actual-bloomPlayer.js # windows example

 then you can just put

```<script src="bloomPlayer.js"></script>```

and it will always use your latest, whether you're running from a server or the file system.
