import { describe, it } from "node:test";
import assert from "node:assert";
import FigmaExporter from "../index.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const RESULTS_DIR = path.resolve("tests/results");

function prepareTestDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

describe("FigmaExporter Integration Tests", () => {
  it("should export SVG assets from a specific frame", async () => {
    const testDir = path.join(RESULTS_DIR, "test-frame-svg");
    prepareTestDir(testDir);

    const exporter = await new FigmaExporter({
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "icons",
      assetsPath: testDir,
      format: "svg",
      exportVariants: false,
    })
      .setAssets()
      .then((e) => e.createAssets());

    const files = fs.readdirSync(testDir);
    assert(files.includes("star.svg"));
    assert(files.includes("star_filled.svg"));
  });

  it("should export JPG assets from a specific frame", async () => {
    const testDir = path.join(RESULTS_DIR, "test-frame-jpg");
    prepareTestDir(testDir);

    const exporter = await new FigmaExporter({
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "images",
      assetsPath: testDir,
      format: "jpg",
    })
      .setAssets()
      .then((e) => e.createAssets());

    const files = fs.readdirSync(testDir);
    assert(files.includes("star.jpg"));
    assert(files.includes("star_bw.jpg"));
  });

  it("should export variant components as separate assets", async () => {
    const testDir = path.join(RESULTS_DIR, "test-variants");
    prepareTestDir(testDir);

    await new FigmaExporter({
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "component",
      assetsPath: testDir,
      format: "svg",
      exportVariants: true,
    })
      .setAssets()
      .then((e) => e.createAssets());

    const variantDir = path.join(testDir, "star");
    const files = fs.readdirSync(variantDir);
    assert(files.some((f) => f.includes("filled=true.svg")));
    assert(files.some((f) => f.includes("filled=false.svg")));
  });

  it("should override asset name when saving", async () => {
    const testDir = path.join(RESULTS_DIR, "test-override-name");
    prepareTestDir(testDir);

    const exporter = await new FigmaExporter({
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "icons",
      assetsPath: testDir,
      format: "svg",
    }).setAssets();

    const overrideName = "custom_name";
    await exporter.createAssets(
      // override first asset
      (assets) => {
        assets[0].name = overrideName;
        return assets;
      }
    );

    const files = fs.readdirSync(testDir);
    assert(files.includes(`${overrideName}.svg`));
  });

  it("should export all assets from a page (no frame)", async () => {
    const testDir = path.join(RESULTS_DIR, "test-no-frame");
    prepareTestDir(testDir);

    await new FigmaExporter({
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      assetsPath: testDir,
      format: "svg",
    })
      .setAssets()
      .then((e) => e.createAssets());

    const files = fs.readdirSync(testDir);
    assert(files.length > 0, "Expected at least one file to be exported");
  });
  it("should allow chaining createAssets with different output paths", async () => {
    const baseConfig = {
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      exportVariants: true,
    };

    const exporter = await new FigmaExporter(baseConfig).setAssets();

    const svgDir = path.join(RESULTS_DIR, "test-chained-svg");
    const jpgDir = path.join(RESULTS_DIR, "test-chained-jpg");

    prepareTestDir(svgDir);
    prepareTestDir(jpgDir);

    // Export SVGs, filtering out "images" and cleaning up names
    await exporter.createAssets(
      (assets) =>
        assets
          .filter((a) => !a.name.includes("images"))
          .map((a) => ({
            ...a,
            name: a.name
              .replace("component/", "")
              .replace("icons/", ""),
          })),
      { assetsPath: svgDir, format: "svg" }
    );

    // Export JPGs, only those that include "images"
    await exporter.createAssets(
      (assets) =>
        assets
          .filter((a) => a.name.includes("images"))
          .map((a) => ({
            ...a,
            name: a.name.replace("images/", ""),
          })),
      { assetsPath: jpgDir, format: "jpg" }
    );

    // Assertions
    const svgFiles = fs.readdirSync(svgDir);
    const jpgFiles = fs.readdirSync(jpgDir);
    assert(
      svgFiles.length > 0,
      "Expected at least one SVG file to be exported"
    );
    assert(
      jpgFiles.length > 0,
      "Expected at least one JPG file to be exported"
    );
  });

  it("should transform asset names dynamically", async () => {
    const testDir = path.join(RESULTS_DIR, "test-transform-names");
    prepareTestDir(testDir);

    const exporter = await new FigmaExporter({
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "icons",
      assetsPath: testDir,
      format: "svg",
    }).setAssets();

    await exporter.createAssets((assets) =>
      assets.map((a) => ({
        ...a,
        name: `icon-${a.name.replace(/\s+/g, "_").toLowerCase()}`,
      }))
    );

    const files = fs.readdirSync(testDir);
    assert(files.some((f) => f.startsWith("icon-")));
  });

  it("should skip existing files if skipExisting is true", async () => {
    const testDir = path.join(RESULTS_DIR, "test-skip-existing");
    prepareTestDir(testDir);

    const exporter = await new FigmaExporter({
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "icons",
      assetsPath: testDir,
      format: "svg",
      skipExistingFiles: true,
    }).setAssets();

    // Create a dummy file to simulate an existing file
    const starDir = path.join(testDir, "star");
    fs.mkdirSync(starDir, { recursive: true });
    fs.writeFileSync(path.join(starDir, "icon.svg"), "dummy content");

    await exporter.createAssets();

    // check if file content is unchanged
    const starFiles = fs.readdirSync(starDir);
    assert(starFiles.includes("icon.svg"));
    assert.strictEqual(
      fs.readFileSync(path.join(starDir, "icon.svg"), "utf-8"),
      "dummy content"
    );

    // check if other files in star_filled folder are created
    const starFilledDir = path.join(testDir, "star_filled");
    const starFilledFiles = fs.readdirSync(starFilledDir);
    assert(starFilledFiles.includes("icon.svg"));
  });
});
