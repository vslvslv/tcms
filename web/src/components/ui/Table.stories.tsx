import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Table,
  TableHead,
  TableHeaderRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
} from "./Table";
import { StatusBadge } from "./StatusBadge";

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
  tags: ["autodocs"],
};
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Table>
      <TableHead>
        <TableHeaderRow>
          <TableHeadCell>ID</TableHeadCell>
          <TableHeadCell>Title</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </TableHeaderRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell className="font-mono text-xs text-muted">a1b2c3d4</TableCell>
          <TableCell className="font-medium text-text">Login with valid credentials</TableCell>
          <TableCell><StatusBadge status="passed" /></TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-mono text-xs text-muted">e5f6g7h8</TableCell>
          <TableCell className="font-medium text-text">Reset password flow</TableCell>
          <TableCell><StatusBadge status="failed" /></TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-mono text-xs text-muted">i9j0k1l2</TableCell>
          <TableCell className="font-medium text-text">OAuth login — Google</TableCell>
          <TableCell><StatusBadge status="untested" /></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const Empty: StoryObj = {
  render: () => (
    <Table>
      <TableHead>
        <TableHeaderRow>
          <TableHeadCell>Title</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
        </TableHeaderRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell colSpan={2} className="py-8 text-center text-muted">
            No results.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  name: "Empty state",
};
