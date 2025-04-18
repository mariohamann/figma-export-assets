import { describe, it } from "node:test";
import assert from "node:assert";
import { FigmaExporter } from "../index.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const RESULTS_DIR = path.resolve("tests/results");

// Helper to clean up and recreate a specific test directory
function prepareTestDir(testDir) {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
}

describe("FigmaExporter Integration Tests", () => {
  it("should export SVG assets from a specific frame", async () => {
    const testDir = path.join(RESULTS_DIR, "test-frame-svg");
    prepareTestDir(testDir);

    const config = {
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "icons",
      assetsPath: testDir,
      format: "svg",
      exportVariants: false,
    };

    const exporter = new FigmaExporter(config);
    const assets = await exporter.getAssets();
    const exportedAssets = await exporter.exportAssets(assets, "svg");

    for (const asset of exportedAssets) {
      await exporter.saveAsset(asset);
    }

    const files = fs.readdirSync(testDir);
    assert(files.some((file) => file.includes("star.svg")));
    assert(files.some((file) => file.includes("star_filled.svg")));
  });

  it("should export JPG assets from a specific frame", async () => {
    const testDir = path.join(RESULTS_DIR, "test-frame-jpg");
    prepareTestDir(testDir);

    const config = {
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "images",
      assetsPath: testDir,
      format: "jpg",
    };

    const exporter = new FigmaExporter(config);
    const assets = await exporter.getAssets();
    const exportedAssets = await exporter.exportAssets(assets, "jpg");

    for (const asset of exportedAssets) {
      await exporter.saveAsset(asset);
    }

    const files = fs.readdirSync(testDir);
    assert(files.some((file) => file.includes("star.jpg")));
    assert(files.some((file) => file.includes("star_bw.jpg")));
  });

  it("should export variant components as separate assets", async () => {
    const testDir = path.join(RESULTS_DIR, "test-variants");
    prepareTestDir(testDir);

    const config = {
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "component",
      assetsPath: testDir,
      format: "svg",
      exportVariants: true,
    };

    const exporter = new FigmaExporter(config);
    const assets = await exporter.getAssets();
    const exportedAssets = await exporter.exportAssets(assets, "svg");

    for (const asset of exportedAssets) {
      await exporter.saveAsset(asset);
    }

    const files = fs.readdirSync(testDir + "/star");
    assert(files.some((file) => file.includes("filled=true.svg")));
    assert(files.some((file) => file.includes("filled=false.svg")));
  });

  it("should override asset name when saving", async () => {
    const testDir = path.join(RESULTS_DIR, "test-override-name");
    prepareTestDir(testDir);

    const config = {
      figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
      fileId: process.env.FILE_ID,
      page: process.env.PAGE,
      frame: "icons",
      assetsPath: testDir,
      format: "svg",
    };

    const exporter = new FigmaExporter(config);
    const assets = await exporter.getAssets();
    const exportedAssets = await exporter.exportAssets(assets, "svg");

    const overrideName = "custom_name";
    const assetToOverride = exportedAssets[0];
    await exporter.saveAsset(assetToOverride, { name: overrideName });

    const files = fs.readdirSync(testDir);
    assert(files.some((file) => file === `${overrideName}.svg`));
  });
});
