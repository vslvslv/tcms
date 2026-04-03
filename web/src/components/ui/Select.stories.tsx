import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Select>;

const options = (
  <>
    <option value="">— Choose —</option>
    <option value="a">Option A</option>
    <option value="b">Option B</option>
    <option value="c">Option C</option>
  </>
);

export const Default: Story = {
  render: (args) => <Select {...args}>{options}</Select>,
};

export const WithSelection: Story = {
  render: (args) => (
    <Select {...args} defaultValue="b">
      {options}
    </Select>
  ),
  name: "With selection",
};

export const Disabled: Story = {
  render: (args) => (
    <Select {...args} disabled>
      {options}
    </Select>
  ),
};
