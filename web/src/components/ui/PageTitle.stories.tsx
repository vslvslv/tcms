import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageTitle } from "./PageTitle";

const meta: Meta<typeof PageTitle> = {
  title: "UI/PageTitle",
  component: PageTitle,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof PageTitle>;

export const Default: Story = {
  args: { children: "Test Cases" },
};

export const Truncation: Story = {
  decorators: [
    (Story) => (
      <div className="w-48 overflow-hidden">
        <Story />
      </div>
    ),
  ],
  args: { children: "A Very Long Page Title That Will Truncate" },
};
