import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <p className="text-text">Card with default padding and border radius.</p>
    ),
  },
};

export const NoPadding: Story = {
  args: {
    className: "p-0",
    children: (
      <div className="divide-y divide-border">
        <div className="px-4 py-3 text-sm text-text">Row one</div>
        <div className="px-4 py-3 text-sm text-text">Row two</div>
        <div className="px-4 py-3 text-sm text-text">Row three</div>
      </div>
    ),
  },
  name: "No padding (table layout)",
};

export const WithHeading: Story = {
  args: {
    children: (
      <>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pass Rate</h3>
        <p className="text-2xl font-semibold text-success">84%</p>
        <p className="text-sm text-muted">16/19 tests passed</p>
      </>
    ),
  },
  name: "Metric card",
};
