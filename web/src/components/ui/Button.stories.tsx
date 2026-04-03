import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, SubmitButton } from "./Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost"],
    },
    disabled: { control: "boolean" },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary", children: "Save changes" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Cancel" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Learn more" },
};

export const Disabled: Story = {
  args: { variant: "primary", children: "Disabled", disabled: true },
};

export const Submit: StoryObj<typeof SubmitButton> = {
  render: (args) => <SubmitButton {...args} />,
  args: { variant: "primary", children: "Submit form" },
  name: "SubmitButton",
};

export const SubmitDisabled: StoryObj<typeof SubmitButton> = {
  render: (args) => <SubmitButton {...args} />,
  args: { variant: "primary", children: "Submitting…", disabled: true },
  name: "SubmitButton / Pending",
};
