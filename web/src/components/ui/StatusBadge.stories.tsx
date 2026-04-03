import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof StatusBadge> = {
  title: "UI/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["passed", "failed", "blocked", "skipped", "untested", "draft", "ready", "approved"],
    },
  },
};
export default meta;
type Story = StoryObj<typeof StatusBadge>;

// Run statuses
export const Passed: Story = { args: { status: "passed" } };
export const Failed: Story = { args: { status: "failed" } };
export const Blocked: Story = { args: { status: "blocked" } };
export const Skipped: Story = { args: { status: "skipped" } };
export const Untested: Story = { args: { status: "untested" } };

// Case statuses
export const Draft: Story = { args: { status: "draft" } };
export const Ready: Story = { args: { status: "ready" } };
export const Approved: Story = { args: { status: "approved" } };

export const AllRunStatuses: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["passed", "failed", "blocked", "skipped", "untested"] as const).map((s) => (
        <StatusBadge key={s} status={s} />
      ))}
    </div>
  ),
  name: "All run statuses",
};

export const AllCaseStatuses: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["draft", "ready", "approved"] as const).map((s) => (
        <StatusBadge key={s} status={s} />
      ))}
    </div>
  ),
  name: "All case statuses",
};
