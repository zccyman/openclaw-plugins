export function createGuardrailHook() {
  return async (event: any) => {
    const toolName = event?.toolName ?? "";
    const params = event?.params ?? {};
    const command = String(params.command ?? params.code ?? "");

    if (toolName !== "bash" && toolName !== "shell" && toolName !== "execute") {
      return undefined;
    }

    const dangerous = ["rm -rf", "sudo", "chmod 777", "dd ", "mkfs", "curl | bash"];
    const match = dangerous.find((d) => command.includes(d));
    if (match) {
      return { block: true, blockReason: `Dangerous pattern detected: "${match}"` };
    }

    return undefined;
  };
}
