import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlakyBadge } from "./FlakyBadge";

describe("FlakyBadge", () => {
  it("renders badge when score is above threshold (4)", () => {
    render(<FlakyBadge score={4} />);
    expect(screen.getByText("Flaky")).toBeTruthy();
  });

  it("renders badge when score is 10", () => {
    render(<FlakyBadge score={10} />);
    expect(screen.getByText("Flaky")).toBeTruthy();
  });

  it("shows score in title tooltip", () => {
    render(<FlakyBadge score={7} />);
    expect(screen.getByTitle("Flakiness score: 7/10")).toBeTruthy();
  });

  it("renders nothing when score is at threshold (3)", () => {
    const { container } = render(<FlakyBadge score={3} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when score is below threshold (1)", () => {
    const { container } = render(<FlakyBadge score={1} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when score is 0", () => {
    const { container } = render(<FlakyBadge score={0} />);
    expect(container.firstChild).toBeNull();
  });
});
