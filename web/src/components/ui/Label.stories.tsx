import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "./Label";
import { Input } from "./Input";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: { children: "Email address" },
};

export const Required: Story = {
  render: () => (
    <Label>
      Email address <span className="text-error" aria-hidden="true">*</span>
    </Label>
  ),
  name: "Required field",
};

export const WithInput: Story = {
  render: () => (
    <div>
      <Label htmlFor="demo-input">Email address</Label>
      <Input id="demo-input" placeholder="you@example.com" />
    </div>
  ),
  name: "Label + Input",
};

export const ErrorAssociated: Story = {
  render: () => (
    <div className="space-y-1">
      <Label htmlFor="error-input" className="text-error">Email address</Label>
      <Input
        id="error-input"
        defaultValue="bad-value"
        className="border-error focus:border-error focus:ring-error/30"
        aria-invalid="true"
        aria-describedby="label-error"
      />
      <p id="label-error" className="text-xs text-error">Invalid email address.</p>
    </div>
  ),
  name: "Error-associated",
};
