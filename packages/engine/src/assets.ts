const ASSET_SPECIFIER =
  /\.(css|scss|sass|less|json|svg|png|jpe?g|gif|webp|ico|bmp|woff2?|ttf|eot|mp4|webm)(\?|#|$)/i;
const PROTOCOL = /^[a-z][a-z0-9+.-]*:/i;

export function isAssetSpecifier(specifier: string): boolean {
  return ASSET_SPECIFIER.test(specifier);
}

export function isNodeBuiltinSpecifier(specifier: string): boolean {
  return specifier.startsWith("node:") || specifier.startsWith("bun:");
}

export function isProtocolSpecifier(specifier: string): boolean {
  if (isNodeBuiltinSpecifier(specifier) || specifier.startsWith("npm:")) {
    return false;
  }
  return PROTOCOL.test(specifier);
}

export function isOversizedSpecifier(specifier: string): boolean {
  return specifier.length === 0 || specifier.length > 1024 || specifier.includes("\0");
}

export function packageNameFromSpecifier(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.includes("\\")) {
    return undefined;
  }
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return specifier;
  }
  return specifier.split("/")[0];
}
