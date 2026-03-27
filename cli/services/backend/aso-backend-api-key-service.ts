import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

export type AsoBackendApiKeySource = "env" | "file" | "none";

export type AsoResolvedBackendApiKey = {
  apiKey: string | null;
  source: AsoBackendApiKeySource;
};

export type AsoBackendClientIdSource = "env" | "file" | "generated";

export type AsoResolvedBackendClientId = {
  clientId: string;
  source: AsoBackendClientIdSource;
};

function resolveAsoDirectory(): string {
  const configuredHome = process.env.ASO_HOME_DIR;
  const homeDir =
    typeof configuredHome === "string" && configuredHome.trim() !== ""
      ? configuredHome.trim()
      : os.homedir();
  return path.join(homeDir, ".aso");
}

function resolveKeyPath(): string {
  return path.join(resolveAsoDirectory(), "key");
}

function resolveClientIdPath(): string {
  return path.join(resolveAsoDirectory(), "client-id");
}

function readTrimmed(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

export class AsoBackendApiKeyService {
  getKeyPath(): string {
    return resolveKeyPath();
  }

  getClientIdPath(): string {
    return resolveClientIdPath();
  }

  private persistClientId(value: string): void {
    const asoDir = resolveAsoDirectory();
    if (!fs.existsSync(asoDir)) {
      fs.mkdirSync(asoDir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(this.getClientIdPath(), `${value}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  resolveApiKey(): AsoResolvedBackendApiKey {
    const envValue = readTrimmed(process.env.ASO_API_KEY);
    if (envValue) {
      return {
        apiKey: envValue,
        source: "env",
      };
    }

    const keyPath = this.getKeyPath();
    try {
      if (!fs.existsSync(keyPath)) {
        return { apiKey: null, source: "none" };
      }
      const fileValue = readTrimmed(fs.readFileSync(keyPath, "utf8"));
      if (!fileValue) {
        return { apiKey: null, source: "none" };
      }
      return {
        apiKey: fileValue,
        source: "file",
      };
    } catch {
      return { apiKey: null, source: "none" };
    }
  }

  resolveClientId(): AsoResolvedBackendClientId {
    const envValue = readTrimmed(process.env.ASO_CLIENT_ID);
    if (envValue) {
      return {
        clientId: envValue,
        source: "env",
      };
    }

    const clientIdPath = this.getClientIdPath();
    try {
      if (fs.existsSync(clientIdPath)) {
        const fileValue = readTrimmed(fs.readFileSync(clientIdPath, "utf8"));
        if (fileValue) {
          return {
            clientId: fileValue,
            source: "file",
          };
        }
      }
    } catch {
      // fall through to generated id
    }

    const generated = randomUUID();
    try {
      this.persistClientId(generated);
    } catch {
      return {
        clientId: generated,
        source: "generated",
      };
    }
    return {
      clientId: generated,
      source: "generated",
    };
  }

  setApiKey(rawKey: string): void {
    const key = readTrimmed(rawKey);
    if (!key) {
      throw new Error("API key cannot be empty.");
    }
    const asoDir = resolveAsoDirectory();
    if (!fs.existsSync(asoDir)) {
      fs.mkdirSync(asoDir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(this.getKeyPath(), `${key}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  clearApiKey(): void {
    try {
      const keyPath = this.getKeyPath();
      if (fs.existsSync(keyPath)) {
        fs.unlinkSync(keyPath);
      }
    } catch {
      return;
    }
  }

  getStatus(): {
    source: AsoBackendApiKeySource;
    maskedKey: string | null;
  } {
    const resolved = this.resolveApiKey();
    return {
      source: resolved.source,
      maskedKey: resolved.apiKey ? maskApiKey(resolved.apiKey) : null,
    };
  }
}

export const asoBackendApiKeyService = new AsoBackendApiKeyService();
