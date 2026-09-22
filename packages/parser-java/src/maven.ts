export interface PomInfo {
  rejected: boolean;
  artifactId?: string;
  modules: string[];
  sourceDirectory?: string;
  testSourceDirectory?: string;
  parentRelativePath?: string;
  parentDeclared: boolean;
}

interface XmlNode {
  name: string;
  text: string;
  children: XmlNode[];
}

function rejected(): PomInfo {
  return { rejected: true, modules: [], parentDeclared: false };
}

function safeChar(code: number): string | "bad" {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
    return "bad";
  }
  return String.fromCodePoint(code);
}

function decodeXml(text: string): string | "bad" {
  if (/&(?!(?:amp|lt|gt|quot|apos);|#(?:x[0-9A-Fa-f]{1,6}|[0-9]{1,7});)/.test(text)) {
    return "bad";
  }
  let bad = false;
  const decoded = text
    .replace(/&#x([0-9A-Fa-f]{1,6});/g, (_match, hex: string) => {
      const char = safeChar(Number.parseInt(hex, 16));
      if (char === "bad") {
        bad = true;
        return "";
      }
      return char;
    })
    .replace(/&#([0-9]{1,7});/g, (_match, dec: string) => {
      const char = safeChar(Number.parseInt(dec, 10));
      if (char === "bad") {
        bad = true;
        return "";
      }
      return char;
    })
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
  return bad ? "bad" : decoded;
}

function parseXml(text: string): XmlNode | "rejected" {
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) {
    return "rejected";
  }
  const root: XmlNode = { name: "#root", text: "", children: [] };
  const stack = [root];
  let index = 0;
  let nodes = 0;
  while (index < text.length) {
    if (nodes > 4000 || stack.length > 32) {
      return "rejected";
    }
    if (text.startsWith("<!--", index)) {
      const end = text.indexOf("-->", index + 4);
      if (end < 0) {
        return "rejected";
      }
      index = end + 3;
      continue;
    }
    if (text.startsWith("<![CDATA[", index)) {
      const end = text.indexOf("]]>", index + 9);
      if (end < 0) {
        return "rejected";
      }
      const decoded = decodeXml(text.slice(index + 9, end));
      if (decoded === "bad") {
        return "rejected";
      }
      stack[stack.length - 1]!.text += decoded;
      index = end + 3;
      continue;
    }
    if (text.startsWith("<?", index)) {
      const end = text.indexOf("?>", index + 2);
      if (end < 0) {
        return "rejected";
      }
      index = end + 2;
      continue;
    }
    if (text[index] === "<") {
      if (text[index + 1] === "/") {
        const end = text.indexOf(">", index);
        if (end < 0) {
          return "rejected";
        }
        const name = text.slice(index + 2, end).trim();
        const current = stack.pop();
        if (current === undefined || current.name !== name || stack.length === 0) {
          return "rejected";
        }
        index = end + 1;
        continue;
      }
      const end = text.indexOf(">", index);
      if (end < 0) {
        return "rejected";
      }
      let body = text.slice(index + 1, end).trim();
      const selfClosing = body.endsWith("/");
      if (selfClosing) {
        body = body.slice(0, -1).trim();
      }
      const name = body.split(/\s+/)[0];
      if (name === undefined || !/^[A-Za-z_:][\w:.-]*$/.test(name)) {
        return "rejected";
      }
      const node: XmlNode = { name, text: "", children: [] };
      stack[stack.length - 1]!.children.push(node);
      nodes += 1;
      if (!selfClosing) {
        stack.push(node);
      }
      index = end + 1;
      continue;
    }
    const next = text.indexOf("<", index);
    const decoded = decodeXml(text.slice(index, next < 0 ? text.length : next));
    if (decoded === "bad") {
      return "rejected";
    }
    stack[stack.length - 1]!.text += decoded;
    index = next < 0 ? text.length : next;
  }
  if (stack.length !== 1) {
    return "rejected";
  }
  return root.children.find((child) => child.name === "project") ?? "rejected";
}

function childText(node: XmlNode, name: string): string | undefined {
  const child = node.children.find((item) => item.name === name);
  const text = child?.text.trim();
  return text !== undefined && text.length > 0 ? text : undefined;
}

export function readPom(text: string): PomInfo {
  const project = parseXml(text);
  if (project === "rejected") {
    return rejected();
  }
  const modules = project.children.find((child) => child.name === "modules");
  const build = project.children.find((child) => child.name === "build");
  const parent = project.children.find((child) => child.name === "parent");
  return {
    rejected: false,
    artifactId: childText(project, "artifactId"),
    modules:
      modules?.children
        .filter((child) => child.name === "module")
        .map((child) => child.text.trim())
        .filter((item) => item.length > 0) ?? [],
    sourceDirectory: build !== undefined ? childText(build, "sourceDirectory") : undefined,
    testSourceDirectory: build !== undefined ? childText(build, "testSourceDirectory") : undefined,
    parentRelativePath: parent !== undefined ? childText(parent, "relativePath") : undefined,
    parentDeclared: parent !== undefined,
  };
}
