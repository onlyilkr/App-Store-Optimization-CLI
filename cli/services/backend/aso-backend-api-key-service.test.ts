import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { AsoBackendApiKeyService, maskApiKey } from "./aso-backend-api-key-service";

describe("aso-backend-api-key-service", () => {
  const originalEnv = process.env;
  const testHome = path.join(
    os.tmpdir(),
    `aso-backend-api-key-home-${process.pid}-${Date.now()}`
  );

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ASO_HOME_DIR = testHome;
    delete process.env.ASO_API_KEY;
    delete process.env.ASO_CLIENT_ID;
    fs.rmSync(testHome, { recursive: true, force: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(testHome, { recursive: true, force: true });
  });

  it("prefers ASO_API_KEY env over file", () => {
    const service = new AsoBackendApiKeyService();
    service.setApiKey("file-key-1234");
    process.env.ASO_API_KEY = "env-key-9999";

    const resolved = service.resolveApiKey();
    expect(resolved.source).toBe("env");
    expect(resolved.apiKey).toBe("env-key-9999");
  });

  it("writes and clears key file", () => {
    const service = new AsoBackendApiKeyService();
    service.setApiKey("test-key-1234");

    const keyPath = service.getKeyPath();
    expect(fs.existsSync(keyPath)).toBe(true);
    expect(service.resolveApiKey()).toEqual({
      apiKey: "test-key-1234",
      source: "file",
    });

    service.clearApiKey();
    expect(fs.existsSync(keyPath)).toBe(false);
    expect(service.resolveApiKey()).toEqual({
      apiKey: null,
      source: "none",
    });
  });

  it("masks api keys in status output", () => {
    expect(maskApiKey("1234567890abcdef")).toBe("1234****cdef");
  });

  it("creates and persists anonymous client id when missing", () => {
    const service = new AsoBackendApiKeyService();
    const first = service.resolveClientId();
    const second = service.resolveClientId();

    expect(first.source).toBe("generated");
    expect(first.clientId).toBeTruthy();
    expect(second.clientId).toBe(first.clientId);
    expect(second.source).toBe("file");
  });

  it("prefers ASO_CLIENT_ID env over persisted client id", () => {
    const service = new AsoBackendApiKeyService();
    const generated = service.resolveClientId();
    expect(generated.clientId).toBeTruthy();

    process.env.ASO_CLIENT_ID = "client-env-123";
    expect(service.resolveClientId()).toEqual({
      clientId: "client-env-123",
      source: "env",
    });
  });
});
