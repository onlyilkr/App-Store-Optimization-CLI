import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  PROJECT_COLORS,
  PROJECT_NAME_MAX_LENGTH,
  ensureUniqueSlug,
  isValidProjectColor,
  slugifyProjectName,
  validateProjectName,
} from "./project-types";

describe("project-types helpers", () => {
  it("exposes the expected default project sentinel", () => {
    expect(DEFAULT_PROJECT_ID).toBe("default");
    expect(DEFAULT_PROJECT_NAME).toBe("Default");
    expect((PROJECT_COLORS as readonly string[]).includes(DEFAULT_PROJECT_COLOR)).toBe(true);
  });

  describe("isValidProjectColor", () => {
    it("accepts preset colors", () => {
      for (const color of PROJECT_COLORS) {
        expect(isValidProjectColor(color)).toBe(true);
      }
    });
    it("rejects other values", () => {
      expect(isValidProjectColor("maroon")).toBe(false);
      expect(isValidProjectColor("")).toBe(false);
      expect(isValidProjectColor(123)).toBe(false);
      expect(isValidProjectColor(null)).toBe(false);
    });
  });

  describe("validateProjectName", () => {
    it("accepts and trims valid names", () => {
      expect(validateProjectName("Halal Food")).toEqual({
        ok: true,
        value: "Halal Food",
      });
      expect(validateProjectName("  spaced  ")).toEqual({
        ok: true,
        value: "spaced",
      });
    });

    it("rejects empty / whitespace-only", () => {
      expect(validateProjectName("")).toEqual({ ok: false, reason: "empty" });
      expect(validateProjectName("   ")).toEqual({ ok: false, reason: "empty" });
      expect(validateProjectName(123)).toEqual({ ok: false, reason: "empty" });
    });

    it("rejects names above max length", () => {
      const tooLong = "x".repeat(PROJECT_NAME_MAX_LENGTH + 1);
      expect(validateProjectName(tooLong)).toEqual({
        ok: false,
        reason: "too_long",
      });
    });
  });

  describe("slugifyProjectName", () => {
    it("lowercases and replaces non-alphanumeric with dashes", () => {
      expect(slugifyProjectName("Halal Food")).toBe("halal-food");
      expect(slugifyProjectName("My App 2024!")).toBe("my-app-2024");
    });

    it("normalizes Turkish diacritics", () => {
      expect(slugifyProjectName("Altın Takibi")).toBe("altin-takibi");
      expect(slugifyProjectName("Şeker Ürünü")).toBe("seker-urunu");
      expect(slugifyProjectName("Çiğdem Öznur Güneş")).toBe(
        "cigdem-oznur-gunes"
      );
    });

    it("collapses repeated dashes and trims edges", () => {
      expect(slugifyProjectName("---weird----name---")).toBe("weird-name");
      expect(slugifyProjectName("___underscores___")).toBe("underscores");
    });

    it("falls back to 'project' when name yields empty slug", () => {
      expect(slugifyProjectName("!!!")).toBe("project");
      expect(slugifyProjectName("🎉🎉")).toBe("project");
      expect(slugifyProjectName("   ")).toBe("project");
    });

    it("truncates to max slug length", () => {
      const long = "a".repeat(120);
      const slug = slugifyProjectName(long);
      expect(slug.length).toBeLessThanOrEqual(48);
      expect(slug.startsWith("a")).toBe(true);
      expect(slug.endsWith("-")).toBe(false);
    });
  });

  describe("ensureUniqueSlug", () => {
    it("returns original slug when unique", () => {
      expect(ensureUniqueSlug("halal-food", [])).toBe("halal-food");
      expect(ensureUniqueSlug("halal-food", ["default"])).toBe("halal-food");
    });

    it("appends -2, -3, ... on collisions", () => {
      expect(ensureUniqueSlug("halal-food", ["halal-food"])).toBe(
        "halal-food-2"
      );
      expect(
        ensureUniqueSlug("halal-food", ["halal-food", "halal-food-2"])
      ).toBe("halal-food-3");
    });

    it("accepts Set inputs", () => {
      const existing = new Set(["halal-food", "halal-food-2"]);
      expect(ensureUniqueSlug("halal-food", existing)).toBe("halal-food-3");
    });
  });
});
