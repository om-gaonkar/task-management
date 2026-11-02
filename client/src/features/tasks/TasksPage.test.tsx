import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { TasksPage } from "./TasksPage";

vi.mock("../../lib/api-client", () => ({
  api: vi.fn(async (path: string) => {
    if (path.startsWith("/tasks?page")) return { data: { items: [{ _id:"1", title:"Write project brief", status:"todo", priority:"high", dueAt:null, projectId:null, createdAt:"2026-01-01" }], total:1, page:1, pages:1 } };
    return { data: { _id:"2" } };
  })
}));
function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry:false }, mutations: { retry:false } } });
  return render(<QueryClientProvider client={queryClient}><BrowserRouter><TasksPage/></BrowserRouter></QueryClientProvider>);
}
afterEach(()=>cleanup());

describe("TasksPage",()=>{
  it("renders tasks returned by the API",async()=>{
    mount();
    expect(await screen.findByText("Write project brief")).toBeTruthy();
  });
  it("shows a task entry field",()=>{
    mount();
    expect(screen.getByPlaceholderText("Add a task…")).toBeTruthy();
  });
});
