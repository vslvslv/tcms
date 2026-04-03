import type { Meta, StoryObj } from "@storybook/react-vite";
import { SectionHeading } from "./SectionHeading";

const meta: Meta<typeof SectionHeading> = {
  title: "UI/SectionHeading",
  component: SectionHeading,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof SectionHeading>;

export const Default: Story = {
  args: { children: "Test Results" },
};

export const Truncation: Story = {
  decorators: [
    (Story) => (
      <div className="w-32 overflow-hidden">
        <Story />
      </div>
    ),
  ],
  args: { children: "A Very Long Section Heading That Should Truncate" },
};
