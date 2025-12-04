# Annoti

A tool for reading, mainly focused on annotation.

## Platform Requirements

**⚠️ Important: This application currently supports Windows desktop platforms only**

- ✅ **Windows Desktop** (Windows 10/11 recommended)
- ❌ Web browsers (not supported)
- ❌ macOS / Linux (not supported yet)

**System requirements:**
- Windows 10/11
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually preinstalled)

----

Current status:

- ~~Initially planned to use a Tauri + Vue + TypeScript stack with a Rust backend, but that seems unnecessary for now~~ Currently tentatively using Flutter (Dart);
- Still in the startup stage, not accepting PRs for now ~~may end up being postponed for a long time~~.
- SPAGHETTI

Currently, the basic goals are modeled after the features that [Zhizhi Reader](https://www.zhizhireader.com/) can achieve (this project has no affiliation with that product and is only used for reference).

Right now I use MS Word to meet my needs, but Word has far too many features; I want something dedicated to annotation and reading — editable text seems unnecessary.

-> Maybe we can draw on some RTF experience.

Other references that look useful but I haven't actually used: [Calibre](https://github.com/kovidgoyal/calibre), [Bookxnote](http://www.bookxnote.com/), [Sumatra](https://github.com/sumatrapdfreader/sumatrapdf), [Koodo](https://github.com/koodo-reader/koodo-reader).

I originally wanted a Windows-native app (because I primarily use Windows). After considering WinUI3, JavaFX, JavaSwing, and Electron, I finally chose Tauri for its better performance — maybe it can become cross-platform.

Core requirements (in my opinion):

1. Robust text compatibility:
   1. Must support rendering at least Text, Markdown, PDF, Epub, and HTML formats;
   2. No immediate i18n requirement — handling Chinese alone is already difficult enough. Western-centric note-taking software aside, CJK typesetting is a major pain point; I believe Zhizhi Reader still has significant room for improvement in Chinese typography;
   3. Reading inevitably involves long texts, e.g., web novels with millions of characters (though I personally don't read those :P). Ensure good performance while supporting CRUD for very large texts.
2. Annotation threads:
   1. Record annotations like community discussions in timestamp order and enable transfer between friends to allow discussion;
   2. But it should be offline — I prefer it to work offline. Services like Notion are powerful but forcing an internet connection is very annoying;
   3. I want annotations to feel like "sticky notes attached to the book" rather than endnotes; visualization and user customization will need attention;
   4. Packaging annotated text together with the original text might make management and offline sharing between friends easier.
3. Good performance:
   1. Should not stutter or drop frames on a normal device;
   2. UI optimization and rendering are also big challenges.
4. Others:
   1. Version control like Git? To avoid accidentally changing the original text — still deciding whether the original should be editable;
   2. Richer, highly customizable typesetting like Adobe InDesign — a huge rabbit hole.

License is undecided for now. Later we will probably pull in other libraries to simplify GUI development (reinventing-the-wheel series); if a licensing approach becomes appropriate we can adopt it.

Git commits currently follow the [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0-beta.4/) spec, using [git-commitizen](https://www.cnblogs.com/Irving/p/5146738.html) for automated commit tooling.
