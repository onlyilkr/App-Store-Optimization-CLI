import {
  CLI_RUNTIME_ERROR_CODE,
  CLI_VALIDATION_ERROR_CODE,
  emitStdoutRuntimeFailure,
  emitStdoutValidationFailure,
  isStdoutKeywordsRun,
  toMachineReadableErrorMessage,
} from "./stdout-contract";

describe("stdout contract", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("detects keywords stdout run", () => {
    expect(isStdoutKeywordsRun(["keywords", "foo,bar", "--stdout"])).toBe(true);
    expect(isStdoutKeywordsRun(["keywords", "foo,bar", "--stdout=true"])).toBe(
      true
    );
    expect(isStdoutKeywordsRun(["keywords", "foo,bar"])).toBe(false);
    expect(isStdoutKeywordsRun(["auth", "--stdout"])).toBe(false);
  });

  it("normalizes machine-readable error messages", () => {
    expect(toMachineReadableErrorMessage("  hello  ")).toBe("hello");
    expect(toMachineReadableErrorMessage(new Error("  boom "))).toBe("boom");
    expect(toMachineReadableErrorMessage(null)).toBe("Unknown error.");
    expect(toMachineReadableErrorMessage({})).toBe("Unknown error.");
  });

  it("emits validation failure envelope", () => {
    const writeSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true as any);

    emitStdoutValidationFailure("bad input");

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = String(writeSpy.mock.calls[0]?.[0] || "");
    const parsed = JSON.parse(written.trim());
    expect(parsed).toEqual({
      error: {
        code: CLI_VALIDATION_ERROR_CODE,
        message: "bad input",
        help: "Use `aso --help` to see available commands and options.",
      },
    });
  });

  it("emits runtime failure envelope", () => {
    const writeSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true as any);

    emitStdoutRuntimeFailure("runtime failure");

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = String(writeSpy.mock.calls[0]?.[0] || "");
    const parsed = JSON.parse(written.trim());
    expect(parsed).toEqual({
      error: {
        code: CLI_RUNTIME_ERROR_CODE,
        message: "runtime failure",
      },
    });
  });
});
