import { Mark } from "@tiptap/core";

export const FontFamily = Mark.create({
  name: "fontFamily",

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (element: any) => element.style.fontFamily,
        renderHTML: (attributes: any) => {
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

  renderHTML({ HTMLAttributes }: any) {
    return ["span", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ commands }: any) => {
          return commands.setMark(this.name, { fontFamily });
        },
      unsetFontFamily: () => ({ commands }: any) => {
        return commands.unsetMark(this.name);
      },
    } as any;
  },
} as any);
