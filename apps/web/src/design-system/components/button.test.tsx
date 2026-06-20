import { describe, expect, it } from "vitest";

import { Button } from "./button.js";

describe("Button", () => {
  it("does not apply content padding to an icon button", () => {
    const element = Button({ "aria-label": "Toggle theme", size: "icon" });
    const className = element.props.className as string;

    expect(className).not.toContain("px-5");
    expect(className).not.toContain("py-3");
    expect(className).toContain("p-0");
  });
});
