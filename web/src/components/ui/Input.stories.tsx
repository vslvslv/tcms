import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: "Enter value…" },
};

export const WithValue: Story = {
  args: { defaultValue: "existing value", placeholder: "Enter value…" },
};

export const Disabled: Story = {
  args: { placeholder: "Disabled input", disabled: true },
};

export const ErrorState: Story = {
  render: () => (
    <div className="space-y-1">
      <Input
        placeholder="Enter email"
        defaultValue="not-an-email"
        className="border-error focus:border-error focus:ring-error/30"
        aria-invalid="true"
        aria-describedby="email-error"
      />
      <p id="email-error" className="text-xs text-error">Please enter a valid email address.</p>
    </div>
  ),
  name: "Error state",
};
