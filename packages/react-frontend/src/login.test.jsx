import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor
} from "@testing-library/react";

// Mock navigate from react-router-dom
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate
}));

// Mock auth helpers
const mockSaveToken = jest.fn();
const mockClearToken = jest.fn();

jest.mock("./auth", () => ({
  saveToken: (...args) => mockSaveToken(...args),
  clearToken: (...args) => mockClearToken(...args)
}));

import Login from "./Login";

describe("Login component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test("renders inputs and buttons", () => {
    render(<Login />);

    expect(
      screen.getByPlaceholderText(/email/i)
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/password/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  test("updates email and password fields", () => {
    render(<Login />);

    const email = screen.getByPlaceholderText(/email/i);
    const password = screen.getByPlaceholderText(/password/i);

    fireEvent.change(email, {
      target: { value: "test@example.com" }
    });
    fireEvent.change(password, {
      target: { value: "secret123" }
    });

    expect(email).toHaveValue("test@example.com");
    expect(password).toHaveValue("secret123");
  });

  test("successful login saves token and navigates to /planners", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "abc123" })
      })
      .mockResolvedValueOnce({
        ok: true
      });

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "secret123" }
    });

    fireEvent.click(
      screen.getByRole("button", { name: /continue/i })
    );

    await waitFor(() => {
      expect(mockClearToken).toHaveBeenCalled();
      expect(mockSaveToken).toHaveBeenCalledWith("abc123");
      expect(mockNavigate).toHaveBeenCalledWith("/planners");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer abc123" }
      })
    );
  });

  test("shows server error text when login fails", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "Bad credentials"
    });

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "wrong@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "wrongpass" }
    });

    fireEvent.click(
      screen.getByRole("button", { name: /continue/i })
    );

    expect(
      await screen.findByText(/bad credentials/i)
    ).toBeInTheDocument();
    expect(mockSaveToken).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith("/planners");
  });

  test("clicking Create account navigates to /signup", () => {
    render(<Login />);
    fireEvent.click(
      screen.getByRole("button", { name: /create account/i })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/signup");
  });

  test("shows network error if fetch throws", async () => {
    global.fetch.mockRejectedValueOnce(
      new Error("Network down")
    );

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "secret123" }
    });

    fireEvent.click(
      screen.getByRole("button", { name: /continue/i })
    );

    expect(
      await screen.findByText(
        /network error\. is the backend running\?/i
      )
    ).toBeInTheDocument();
  });
});
