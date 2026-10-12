import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MeetChat from "../components/MeetChat";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      first_name: "Ananya",
      last_name: "Rao",
      email: "ananya.rao@emwts.local",
      role: "EMPLOYEE",
    },
  }),
}));

describe("Meet & Chat Communications Suite", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders workplace channels and contacts", () => {
    render(<MeetChat />);

    expect(screen.getByText("daily-scrum")).toBeInTheDocument();
    expect(screen.getByText("general")).toBeInTheDocument();
    expect(screen.getByText("engineering")).toBeInTheDocument();

    expect(screen.getAllByText("Priya Sharma").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Arjun Mehta").length).toBeGreaterThan(0);
  });

  it("renders voice call, video call, and screen share buttons", () => {
    render(<MeetChat />);

    expect(screen.getByRole("button", { name: /Voice Call/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Video Call/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share Screen/i })).toBeInTheDocument();
  });

  it("allows sending a message in the active channel", () => {
    render(<MeetChat />);

    const input = screen.getByPlaceholderText(/Message #daily-scrum.../i);
    fireEvent.change(input, { target: { value: "Hello team! Testing WebRTC audio setup." } });

    const sendBtn = screen.getByRole("button", { name: "Send" });
    fireEvent.click(sendBtn);

    expect(screen.getByText("Hello team! Testing WebRTC audio setup.")).toBeInTheDocument();
  });

  it("opens video call modal when clicking Video Call button and allows ending call", () => {
    render(<MeetChat />);

    const videoCallBtn = screen.getByRole("button", { name: /Video Call/i });
    fireEvent.click(videoCallBtn);

    // Call room header should be visible
    expect(screen.getByText(/End-to-End Encrypted/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mute Microphone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stop Camera/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Share Screen/i)).toBeInTheDocument();

    // End call
    const endCallBtn = screen.getByLabelText(/Leave Call/i);
    fireEvent.click(endCallBtn);

    expect(screen.queryByText(/End-to-End Encrypted/i)).not.toBeInTheDocument();
  });
});
