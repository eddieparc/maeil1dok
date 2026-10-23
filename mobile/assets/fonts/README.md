# Reading font provenance

This is the isolated reading-font unit of LAB-171. The parent task owns release
and visual parity acceptance. No navigation, screen, theme, or release settings
are changed by this unit.

## Web contract and native faces

The reference is `frontend/app/stores/readingSettings.ts` and
`frontend/app/assets/css/main.css`. Display order is KoPub, RIDI, Noto Serif,
Pretendard, Noto Sans, system. The persisted weights normal/medium/bold mean
CSS 400/500/600, not 400/500/700.

| Family | Web 400 / normal | Web 500 / medium | Web 600 / bold |
| --- | --- | --- | --- |
| KoPub Batang | KoPubBatang-Light | KoPubBatang-Regular | KoPubBatang-Bold |
| RIDI Batang | RIDIBatang | RIDIBatang (only original face) | RIDIBatang (only original face) |
| Noto Serif KR | NotoSerifKR-Regular | NotoSerifKR-Medium | NotoSerifKR-SemiBold |
| Pretendard | Pretendard-Regular | Pretendard-Medium | Pretendard-SemiBold |
| Noto Sans KR | NotoSansKR-Regular | NotoSansKR-Medium | NotoSansKR-SemiBold |
| System | Platform 400 | Platform 500 | Platform 600 |

KoPub's original OS/2 weight classes are **300/400/700**. They intentionally map
to the web CSS declarations **400/500/600**. The original files are not relabeled
or modified to disguise this distinction. Default medium therefore uses the
original KoPub Regular, not a platform sans face.

RIDI supplies only Regular, weight class 400. No Medium/Bold file exists here
and no other family substitutes for RIDI. A browser can synthesize heavier
rendering from the web's single 400 face; this unit does not reproduce or claim
equivalence to that synthesis. All three persisted settings select the same
original RIDI face in native text.

## Pinned originals

All original files were downloaded with `curl --fail --location` from
`raw.githubusercontent.com`, using these exact commits and paths:

| Files | Repository / commit | Upstream directory |
| --- | --- | --- |
| KoPubBatang-{Light,Regular,Bold}.ttf | `google/fonts` / `45e3d5269e4a17d823f6d84470bc084dc5ae46f6` | `ofl/kopubbatang/` |
| RIDIBatang.otf | `ridi/ridicorp.github.io` / `e5d2645922fc4afdde1cb8b6c408e5f698c45f78` | `branding/fonts/ridibatang/` |
| NotoSerifKR-{Regular,Medium,SemiBold}.otf | `notofonts/noto-cjk` / `f8d157532fbfaeda587e826d4cd5b21a49186f7c` | `Serif/SubsetOTF/KR/` |
| NotoSansKR-Variable.ttf | `google/fonts` / `45e3d5269e4a17d823f6d84470bc084dc5ae46f6` | `ofl/notosanskr/NotoSansKR[wght].ttf` |

The variable source is retained for reproducibility, but is not registered or
required by the application. Its `wght` axis is 100..900, default 100.
Registering that unchanged source under three different aliases would not
select the three reading weights: the reader selects a face name, not an axis.
Static instances were generated with FontTools **4.63.0**, without changing
outlines beyond the source's own weight interpolation:

```sh
fonttools varLib.instancer NotoSansKR-Variable.ttf wght=400 --static --update-name-table --no-recalc-timestamp -o NotoSansKR-Regular.ttf
fonttools varLib.instancer NotoSansKR-Variable.ttf wght=500 --static --update-name-table --no-recalc-timestamp -o NotoSansKR-Medium.ttf
fonttools varLib.instancer NotoSansKR-Variable.ttf wght=600 --static --update-name-table --no-recalc-timestamp -o NotoSansKR-SemiBold.ttf
```

The generated fonts have distinct PostScript names, OS/2 weights 400/500/600,
and no `fvar` table. These are explicitly derived instances, not upstream static
downloads. Their license reserves "Source", not "Noto Sans KR".

Pretendard's existing four OTF files and registration names are preserved
byte-for-byte. Their metadata reports version 1.309 and weight classes
400/500/600/700. Pretendard-Bold remains registered for existing UI callers;
reading "bold" continues to select SemiBold. The old NotoSerifKR-Regular.ttf
asset is left untouched but is no longer registered; the reading path uses the
pinned original OTFs. The existing NotoSerifKR-Bold.ttf remains registered for
UI headings that use the web's actual CSS700, including the Home hero and
reading card. Its SFNT metadata reports NotoSerifKR-Bold, weight700, version
2.003-H1. This does not change the persisted reading bold=600 mapping.

## Copyright and licenses

Each family is distributed under SIL Open Font License 1.1:

- `OFL-KoPub.txt` preserves `ofl/kopubbatang/OFL.txt` from the pinned Google
  Fonts commit. Its copyright is Ministry of Culture, Sports and Tourism and
  Korea Publishers Society, with reserved names KoPub Dotum and KoPub Batang.
  The original binary name table also carries the older FONTRIX 2005-2011
  copyright. Both are retained without rewriting the binaries.
- `OFL-RIDIBatang.txt` includes the original font's 2019 RIDI & Sandoll notice
  and the complete OFL 1.1 text. The primary licensing statement is
  `branding/fonts/ridibatang/index.html` at the pinned RIDI commit: RIDI owns
  the font, permits bundling/redistribution, and identifies OFL 1.1.
- `OFL-NotoSerifKR.txt` preserves `Serif/LICENSE` from the pinned Noto commit.
  Original OTF name tables carry Adobe 2017-2024 copyright and OFL 1.1.
- `OFL-NotoSansKR.txt` preserves `ofl/notosanskr/OFL.txt` from the pinned Google
  Fonts commit, including Adobe 2014-2021 copyright and reserved name Source.
  This also covers the three derived static instances.
- Existing Pretendard binaries retain their Kil Hyung-jin 2023 copyright and
  OFL 1.1 metadata. The complete OFL 1.1 text is reproduced in the accompanying
  license files; no Pretendard binary was modified.

## SHA-256

| File | SHA-256 |
| --- | --- |
| KoPubBatang-Light.ttf | `4b48b18e81ecc50b54a5d34e625ac21a5a9b6b043e3f6bab6cd87279a645587b` |
| KoPubBatang-Regular.ttf | `e7e51c6d8d1131d8dab207ad8da64be861070700b20b19fcb4cd13556d0cc27c` |
| KoPubBatang-Bold.ttf | `e21f1202062cf8a76173cce5aba07a88b79ac21b78aa885dc5c9e28dc1b672ac` |
| RIDIBatang.otf | `f13a49c0815d254ac15e392953a0b056613dec08ceb378e54eeed14c4fda9a54` |
| NotoSerifKR-Regular.otf | `5ea012e15cb7eacc1f680aee1703f3b164791b1443ea3e52b65080cca5d179cf` |
| NotoSerifKR-Medium.otf | `4635a54699624f9235ff4511e932dd8229edce678bdb00d43f46b4668b151062` |
| NotoSerifKR-SemiBold.otf | `a63051d299d7219132a98ff3c2b76a62022344e50e9f3b50fdb9b0ee4560f583` |
| NotoSerifKR-Bold.ttf (unchanged UI face) | `9a6dbb18ee4c88b8f1df0bf892baca9af901ef5a3c82de210f2413cc4fed08f9` |
| NotoSansKR-Variable.ttf | `194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252` |
| NotoSansKR-Regular.ttf | `4609a7b62a6da24cae3a8b73ecde7003581b8f60662d60cc8f55a3793de07763` |
| NotoSansKR-Medium.ttf | `4546aaa0be877f52e67a6f8b14e708a654d34f6ff921d7a469ec7ed8d3bf7080` |
| NotoSansKR-SemiBold.ttf | `ce82b8c9368de1a2c82c1fc78822e0277268ff95859b4e26e9996c598bc9745a` |
| Pretendard-Regular.otf (unchanged) | `3ffbacde6ab8411f1d2db54bb9b1f0b3ee2a738932033722cf0388c06aed1c93` |
| Pretendard-Medium.otf (unchanged) | `d39e50e4bb52b4993b6a4eeb821a171254745bd824446af01e1f616b89fface0` |
| Pretendard-SemiBold.otf (unchanged) | `c89bc43027dc7cde5726e96223376f8eec09302b2fc1f8147fd5b57cfc376118` |
| Pretendard-Bold.otf (unchanged) | `2e91915fab54df71cc9598ebf608b2bdb54c6fe3c066ac61dff0bc44fca71cc7` |

## Verification boundary

Metadata, original-source hashes, face selection, application registration,
and host-component text styles can be checked locally. They do not prove
CoreText/Android loading, glyph shaping, fallback, rasterization, line wrapping,
baseline metrics, or pixel parity against the web. Same-passage/same-width
iOS and Android comparisons for every family and weight remain a parent-task
visual gate, especially RIDI 500/600 and the web's CDN/font-version differences.
