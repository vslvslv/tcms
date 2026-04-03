import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { AppLink } from "./AppLink";

const meta: Meta<typeof AppLink> = {
  title: "UI/AppLink",
  component: AppLink,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof AppLink>;

export const Default: Story = {
  args: { to: "/runs", children: "View test runs" },
};

export const Truncation: Story = {
  decorators: [
    (Story) => (
      <div className="w-32 overflow-hidden">
        <Story />
      </div>
    ),
  ],
  args: { to: "/runs", children: "A very long link label that should truncate at the container edge" },
};
