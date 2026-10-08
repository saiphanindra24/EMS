import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "../components/common/Pagination";

describe("Pagination Component", () => {
  it("renders correct record counts and page indicator", () => {
    render(
      <Pagination
        page={2}
        totalPages={5}
        totalCount={45}
        pageSize={10}
        itemName="employees"
      />
    );

    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText("11–20")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText(/Page/i)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("disables Previous on page 1 and Next on last page", () => {
    const { rerender } = render(
      <Pagination
        page={1}
        totalPages={3}
        totalCount={30}
        pageSize={10}
      />
    );

    const prevBtn = screen.getByRole("button", { name: /Previous page/i });
    const nextBtn = screen.getByRole("button", { name: /Next page/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    rerender(
      <Pagination
        page={3}
        totalPages={3}
        totalCount={30}
        pageSize={10}
      />
    );

    expect(prevBtn).toBeEnabled();
    expect(nextBtn).toBeDisabled();
  });

  it("calls onPageChange when clicking next and previous", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={2}
        totalPages={4}
        totalCount={40}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    const prevBtn = screen.getByRole("button", { name: /Previous page/i });
    const nextBtn = screen.getByRole("button", { name: /Next page/i });

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("handles per-page select changes", () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalPages={2}
        totalCount={15}
        pageSize={10}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 20, 50]}
      />
    );

    const select = screen.getByLabelText(/Per page:/i);
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "20" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });

  it("returns null when totalCount is 0 and totalPages is 1", () => {
    const { container } = render(
      <Pagination
        page={1}
        totalPages={1}
        totalCount={0}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
