import type { VirtualPathMapping } from "../types.js";

export class VirtualPathMapper {
  private mappings: VirtualPathMapping[];

  constructor(mappings: VirtualPathMapping[] = []) {
    this.mappings = mappings;
  }

  addMapping(virtual: string, physical: string): void {
    this.mappings.push({ virtual, physical });
  }

  toPhysical(virtualPath: string): string {
    for (const m of this.mappings) {
      if (virtualPath.startsWith(m.virtual)) {
        return virtualPath.replace(m.virtual, m.physical);
      }
    }
    return virtualPath;
  }

  toVirtual(physicalPath: string): string {
    for (const m of this.mappings) {
      if (physicalPath.startsWith(m.physical)) {
        return physicalPath.replace(m.physical, m.virtual);
      }
    }
    return physicalPath;
  }

  isVirtual(path: string): boolean {
    return this.mappings.some((m) => path.startsWith(m.virtual));
  }

  getMappings(): VirtualPathMapping[] {
    return [...this.mappings];
  }
}
