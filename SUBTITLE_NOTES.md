# Subtitle translation and format notes

Design references reviewed at the user's request:
- https://github.com/rockbenben/subtitle-translator — separate timing from dialogue, decode common character sets, and default to source-language detection.
- https://github.com/mamq144/srt-translator-mcp — validate timing and use UTF-8 for interoperable SRT.

Kurd Movie implements its own pipeline; it does not embed either repository or their LLM services. Only subtitle dialogue is sent to the unofficial Google translation endpoint; timestamps remain local. The endpoint needs internet access, can rate-limit or fail, and machine translation quality isn't guaranteed. Uploaded SRT/VTT files use BOM detection and best-effort character-set detection via jschardet (0BSD); detection is not reliable for every file, and unsupported or low-confidence files should be saved as UTF-8. ASS and LRC are not supported. Exported SRT is UTF-8 with a BOM and per-line RTL marks. Unicode text remains in logical order; exact rendering can vary among external players.
