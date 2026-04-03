import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import "../src/index.css";

// Theme decorator: sets document.documentElement.dataset.theme = 'dark' | 'light'
// so all TCMS CSS tokens resolve correctly in stories.
function WithTheme(Story: React.ComponentType, context: { globals: { theme?: string } }) {
  const theme = context.globals.theme ?? "dark";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [theme]);

  return <Story />;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  decorators: [WithTheme],
  parameters: {
    backgrounds: { disable: true }, // we use data-theme, not Storybook backgrounds
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;
