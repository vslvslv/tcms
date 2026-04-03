import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dropdown, DropdownItem } from "./Dropdown";

const meta: Meta<typeof Dropdown> = {
  title: "UI/Dropdown",
  component: Dropdown,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="flex justify-center pt-4" style={{ minHeight: 220 }}>
        <div className="w-56">
          <Story />
        </div>
      </div>
    ),
  ],
};
export default meta;

const items = (
  <>
    <DropdownItem onClick={() => {}}>View</DropdownItem>
    <DropdownItem onClick={() => {}}>Edit</DropdownItem>
    <DropdownItem onClick={() => {}}>Delete</DropdownItem>
  </>
);

export const Closed: StoryObj<typeof Dropdown> = {
  render: () => <Dropdown trigger="Actions">{items}</Dropdown>,
  name: "Closed (default)",
};

function OpenDropdown() {
  const [open, setOpen] = useState(true);
  return (
    <Dropdown trigger="Actions" open={open} onOpenChange={setOpen}>
      {items}
    </Dropdown>
  );
}

export const Open: StoryObj<typeof Dropdown> = {
  render: () => <OpenDropdown />,
  name: "Open",
};

function ListboxDropdown() {
  const projects = ["Alpha", "Beta", "Gamma"];
  const [selected, setSelected] = useState("Beta");
  const [open, setOpen] = useState(true);
  return (
    <Dropdown trigger={selected} open={open} onOpenChange={setOpen} aria-haspopup="listbox">
      {projects.map((p) => (
        <DropdownItem
          key={p}
          role="option"
          selected={p === selected}
          onClick={() => { setSelected(p); setOpen(false); }}
        >
          {p}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

export const WithSelection: StoryObj<typeof Dropdown> = {
  render: () => <ListboxDropdown />,
  name: "Listbox with selection",
};

export const Disabled: StoryObj<typeof Dropdown> = {
  render: () => <Dropdown trigger="Actions" disabled>{items}</Dropdown>,
};
