// Fonts safe to assume on a typical Windows / macOS system. libavfilter's
// `ass` filter resolves these via fontconfig at render time, so anything the
// host has installed will work; this list is just the picker's options.
export const FONT_OPTIONS: string[] = [
  "Arial",
  "Arial Black",
  "Helvetica",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Courier New",
  "Consolas",
  "Lucida Console",
  "Impact",
  "Comic Sans MS",
  "Bebas Neue",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Inter",
  "Oswald",
];
