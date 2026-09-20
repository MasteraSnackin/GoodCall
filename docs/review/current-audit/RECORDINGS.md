# Dialog interaction recordings

These are silent encodes of the live browser frames captured during the dialog audit. They show actual UI changes; no interaction, cursor or screen content was reconstructed.

| Recording | Duration | Dimensions | Size |
| --- | --- | --- | --- |
| [Before](dialog-before.mp4) | 5.784443 seconds | 1280 × 720 | 206,144 bytes |
| [After](dialog-after.mp4) | 5.586894 seconds | 1280 × 720 | 89,283 bytes |

The before recording contains text entry and finishes on the reopened empty form. The after recording finishes with the entered audit text still in the form. The recordings contain the captured states; the audit report supplies the action sequence and explanation.

Frames retain their original intervals, using variable frame rate. Time zero is the first captured frame; the last frame is held until the recorded stop. Each output includes one identical terminal frame for that final hold. The timing difference is below one microsecond per frame. Full decoding and representative frame inspection passed.

The source recordings are 2560 × 1440 JPEG frames. Outputs use H.264 at 1280 × 720, yuv420p, with no audio. No crop, speed change, cuts, captions or cursor overlays were added.

See [recording-provenance.json](recording-provenance.json) for exact settings, hashes and verification. The timestamp manifests remain alongside the videos. Raw frames and their checksums are archived outside the app at `../output/goodcall-audit-recordings/2026-09-20-current-audit/`. An earlier ten-frame partial capture is labelled superseded there and was not used for either video.
