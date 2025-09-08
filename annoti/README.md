# Annoti

一个阅读的工具，主要用于阅读时批注的需求。



目前：

- ~~暂定使用Tauri + Vue + TypeScript的架构，后端使用Rust但是暂时好像用不上~~暂定使用Flutter(Dart)；
- 还处于Start-up阶段，不接受PR~~没准又会鸽很久~~。
- SPAGHETTI



目前暂时以[知之阅读](https://www.zhizhireader.com/)所能实现的功能为基本目标（本项目该项目没有任何的利益关系，仅作参照之用）。

现在是用的MS Word满足我的需求，但MS Word的功能实在太多了，我希望它能专注于批注和阅读——看上去可编辑是不必要的。

看上去可以作为参照但是实际还没用过的：[Calibre](https://github.com/kovidgoyal/calibre)、[Bookxnote](http://www.bookxnote.com/)、[Sumatra](https://github.com/sumatrapdfreader/sumatrapdf)、[Koodo](https://github.com/koodo-reader/koodo-reader)。

本来想做Windows Native的（因为自己平时也只用 Windows），考虑了WinUI3、JavaFX、JavaSwing和Electron架构之后，最后选择了性能更好的Tauri，没准也能做跨平台。



个人认为的比较核心的需求：

1. 良好的文本兼容：
   1. 至少需要满足Text、Markdown、PDF、Epub、HTML格式的文件的渲染；
   2. 暂时没有i18n的需求，或者说光是处理中文本身就已经很有难度了——西文为主导的那些笔记软件自不必说，CJK大坑，知之阅读在中文排版上的功能我认为还有很大的改进的空间；
   3. 阅读中不可避免长文本的阅读，例如上百万字的网文小说（虽然我自己是不看w），保证性能的同时也要保证大文本的CRUD正常；
2. 批注讨论串：
   1. 如同在社群内讨论一样，按时间戳的形式记录各种批注，并可以在朋友间传输，实现讨论；
   2. 但它是**离线**的，进一步说我更希望它是离线就能用的，像Notion这种虽然功能强大但是强制联网实在恼人；
   3. 我希望这个批注更像是**贴在书上的小纸条**那种感觉，而不是说尾注，在可视化和用户自定义上肯定要下功夫；
   4. 带有批注的文本和原文封装存储可能会更易于管理（主要是朋友间离线传输）。
3. 良好的性能：
   1. 至少在一台正常的设备上不应该出现掉帧卡顿；
   2. 界面优化和渲染也是大坑。
4. 其他的：
   1. 像Git一样做版本控制？避免手欠把原文改了——其实要不要做原文的可编辑还在考虑；
   2. 如Adobe InDesign那样更为丰富的可自定义化的排版——天坑。



License暂时还不确定，后续大概率要引一些其他东西来简化GUI的开发流程（造轮子系列），如果到时候有协议传播那么直接套就好了。

Git Commit目前暂时使用[约定式提交](https://www.conventionalcommits.org/zh-hans/v1.0.0-beta.4/)，使用[git-commitizen](https://www.cnblogs.com/Irving/p/5146738.html)进行自动化提交配置。