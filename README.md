# JetBrains File Icon Theme for VS Code

The goal of the JetBrains File Icon Theme is to reduce visual clutter and give you more space for your code and thoughts.

I hope this theme will be the one you enjoy working with day and night.

## Preview

### Folders icons

![Preview folders icons](https://raw.githubusercontent.com/fogio-org/vscode-jetbrains-file-icon-theme/refs/heads/master/assets/img/preview_folders.png)

### File extensions icons

![Preview file extensions icons](https://raw.githubusercontent.com/fogio-org/vscode-jetbrains-file-icon-theme/refs/heads/master/assets/img/preview_file_extensions.png)

### File names icons

Icons for reserved file names

![Preview file names icons](https://raw.githubusercontent.com/fogio-org/vscode-jetbrains-file-icon-theme/refs/heads/master/assets/img/preview_file_names.png)

## Install

### File icon theme

Set File Icon Theme ([guide](https://code.visualstudio.com/docs/configure/themes#_file-icon-themes))

### Font

You can use [JetBrains Mono](https://www.jetbrains.com/lp/mono/) font with the JetBrains File Icon Theme.

VS Code doesn't provide clear functionality for adding a custom font to color theme... But I managed to add the font to the File icon theme!

> **Important! To use the JetBrains Mono font, the File Icon Theme must be set!**

Then there are 2 ways to enable the new font:

#### Settings UI

![Change font in settings UI](https://raw.githubusercontent.com/fogio-org/vscode-jetbrains-file-icon-theme/refs/heads/master/assets/img/guide_change_font_settings_ui.jpg)

> **It is very important to specify the font family exactly `JetBrainsMono`, without spaces!**

#### settings.json file

Add the following line to your settings.json file:

```json
"editor.fontFamily": "JetBrainsMono, Consolas, 'Courier New', monospace",
```

#### Extras

Also, there are some additional settings that you can apply both in the Settings UI and in settings.json file:

```json
"editor.fontSize": 13,
"editor.fontLigatures": true, // ">=" to "≥" etc
"terminal.integrated.fontFamily": "JetBrainsMono",
"terminal.integrated.fontSize": 13,
```

## Credits

I express my deep gratitude to the JetBrains team for their work. Here are links to open resources used to create this theme:

- JetBrains icons: [https://jetbrains.design/intellij/resources/icons_list/](https://jetbrains.design/intellij/resources/icons_list/)
- JetBrains Mono font: [https://www.jetbrains.com/lp/mono/](https://www.jetbrains.com/lp/mono/)
