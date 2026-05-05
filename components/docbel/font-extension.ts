import { Mark } from "@tiptap/core";

export const FontFamily = Mark.create({
  name: "fontFamily",

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontFamily,
        renderHTML: (attributes: Record<string, string | null>) => {
          if (!attributes.fontFamily) {
            return {};
          }
          return {
            style: `font-family: ${attributes.fontFamily}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: "font-family",
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["span", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ commands }: { commands: { setMark: (name: string, attrs: Record<string, unknown>) => boolean } }) => {
          return commands.setMark("fontFamily", { fontFamily });
        },
      unsetFontFamily: () => ({ commands }: { commands: { unsetMark: (name: string) => boolean } }) => {
        return commands.unsetMark("fontFamily");
      },
    } as Record<string, unknown>;
  },
} as Record<string, unknown>);
