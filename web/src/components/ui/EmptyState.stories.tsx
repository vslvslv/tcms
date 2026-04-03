import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: { message: "No test cases yet." },
};

export const WithAction: Story = {
  args: {
    message: "No test runs found for this project.",
    action: <Button variant="primary">+ Add Test Run</Button>,
  },
  name: "With action button",
};
