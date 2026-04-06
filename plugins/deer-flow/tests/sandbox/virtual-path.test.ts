import { describe, it, expect } from "vitest";
import { VirtualPathMapper } from "@/sandbox/virtual-path";

describe("VirtualPathMapper", () => {
  it("maps virtual path to physical", () => {
    const mapper = new VirtualPathMapper([
      { virtual: "/mnt/user-data", physical: "/home/user" },
      { virtual: "/mnt/skills", physical: "/opt/skills" },
    ]);

    expect(mapper.toPhysical("/mnt/user-data/project/file.ts")).toBe("/home/user/project/file.ts");
    expect(mapper.toPhysical("/mnt/skills/test/SKILL.md")).toBe("/opt/skills/test/SKILL.md");
  });

  it("maps physical path to virtual", () => {
    const mapper = new VirtualPathMapper([
      { virtual: "/mnt/user-data", physical: "/home/user" },
    ]);

    expect(mapper.toVirtual("/home/user/project/file.ts")).toBe("/mnt/user-data/project/file.ts");
  });

  it("returns original path when no mapping matches", () => {
    const mapper = new VirtualPathMapper([
      { virtual: "/mnt/user-data", physical: "/home/user" },
    ]);

    expect(mapper.toPhysical("/other/path")).toBe("/other/path");
    expect(mapper.toVirtual("/other/path")).toBe("/other/path");
  });

  it("detects virtual paths", () => {
    const mapper = new VirtualPathMapper([
      { virtual: "/mnt/user-data", physical: "/home/user" },
    ]);

    expect(mapper.isVirtual("/mnt/user-data/file")).toBe(true);
    expect(mapper.isVirtual("/home/user/file")).toBe(false);
  });

  it("addMapping adds new mapping dynamically", () => {
    const mapper = new VirtualPathMapper([]);
    mapper.addMapping("/mnt/data", "/real/data");

    expect(mapper.toPhysical("/mnt/data/file.txt")).toBe("/real/data/file.txt");
  });

  it("getMappings returns copy of mappings", () => {
    const mapper = new VirtualPathMapper([
      { virtual: "/v", physical: "/p" },
    ]);

    const mappings = mapper.getMappings();
    expect(mappings).toHaveLength(1);
    mappings.push({ virtual: "/x", physical: "/y" });
    expect(mapper.getMappings()).toHaveLength(1);
  });
});
