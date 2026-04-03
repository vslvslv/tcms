import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingSpinner } from "./LoadingSpinner";

const meta: Meta<typeof LoadingSpinner> = {
  title: "UI/LoadingSpinner",
  component: LoadingSpinner,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

// Single story — animation is visible in Storybook, frozen in visual regression tests
// (Playwright disables animations via page.addStyleTag in test setup)
export const Default: Story = {};
