import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumb } from "./Breadcrumb";

const meta: Meta<typeof Breadcrumb> = {
  title: "UI/Breadcrumb",
  component: Breadcrumb,
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
type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {
  args: {
    items: [
      { label: "Projects", to: "/projects" },
      { label: "Alpha Project", to: "/projects/1" },
      { label: "Test Cases" },
    ],
  },
};

export const SingleItem: Story = {
  args: {
    items: [{ label: "Projects" }],
  },
  name: "Single item (current page only)",
};

export const TwoLevels: Story = {
  args: {
    items: [
      { label: "All projects", to: "/cases/details" },
      { label: "Alpha Project" },
    ],
  },
};
