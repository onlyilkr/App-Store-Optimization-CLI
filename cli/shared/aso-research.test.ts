import {
  DEFAULT_RESEARCH_APP_ID,
  RESEARCH_APP_ID,
  RESEARCH_APP_ID_PREFIX,
  isResearchAppId,
  projectIdFromResearchAppId,
  researchAppIdForProject,
} from "./aso-research";

describe("aso-research helpers", () => {
  it("recognizes bare and suffixed research ids", () => {
    expect(isResearchAppId(RESEARCH_APP_ID)).toBe(true);
    expect(isResearchAppId(DEFAULT_RESEARCH_APP_ID)).toBe(true);
    expect(isResearchAppId(`${RESEARCH_APP_ID_PREFIX}halal-food`)).toBe(true);
    expect(isResearchAppId("6755012360")).toBe(false);
    expect(isResearchAppId("")).toBe(false);
    expect(isResearchAppId("  ")).toBe(false);
  });

  it("builds research app id for a project", () => {
    expect(researchAppIdForProject("default")).toBe("research:default");
    expect(researchAppIdForProject("halal-food")).toBe("research:halal-food");
    expect(researchAppIdForProject("  spaced  ")).toBe("research:spaced");
  });

  it("throws when building research app id without a project", () => {
    expect(() => researchAppIdForProject("")).toThrow();
    expect(() => researchAppIdForProject("   ")).toThrow();
  });

  it("extracts projectId from suffixed research id", () => {
    expect(projectIdFromResearchAppId("research:default")).toBe("default");
    expect(projectIdFromResearchAppId("research:halal-food")).toBe(
      "halal-food"
    );
  });

  it("returns null for non-prefixed or bare research ids", () => {
    expect(projectIdFromResearchAppId("research")).toBeNull();
    expect(projectIdFromResearchAppId("6755012360")).toBeNull();
    expect(projectIdFromResearchAppId("")).toBeNull();
    expect(projectIdFromResearchAppId("research:")).toBeNull();
  });
});
