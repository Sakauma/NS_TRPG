import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the tutorial scenario and advances a player turn", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "建卡道场" })).toBeTruthy();
    expect(screen.getAllByText("火焰吞食者").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "开始训练" }));

    expect(screen.getByRole("heading", { name: "忍者杀手 TRPG：入门训练剧本" })).toBeTruthy();
    expect(screen.getAllByText("玩家小队")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "集中并放弃移动" }));
    fireEvent.click(screen.getByRole("button", { name: "结束行动" }));

    expect(screen.getAllByText("霓虹影 / 移动阶段").length).toBeGreaterThan(0);
  });
});
