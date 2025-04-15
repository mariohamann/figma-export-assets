# figma-export-assets

## Install

```bash
npm install figma-export-assets
```

## Description

A highly customizable package for exporting assets from Figma API in any supported format.

🙏🏻 Based on concepts by https://github.com/tsimenis/figma-export-icons and https://github.com/nate-summercook/figma-assets-exporter but with focus on customizability. Thanks to both of them for their work!

## Features

-   📄 Multiple Figma Pages/Frames: Configure to process assets from various Figma pages or specific frames.
-   🔄 Batch Exporting: Supports batch exporting out of the box to handle Figma API export limits.
-   📁 Customizable Asset Paths/Names: Set unique saving paths or names for each asset.
-   🌈 Customizable Asset Format: Choose any Figma export format for each asset.
-   🚫 Asset Exclusion: Easily exclude specific assets from export based on their names.
-   🌟 Variant Exporting: Overridable option to export components with variants as separate assets.

## Example: Basic Usage

```js
// get figmaPersonalToken and fileId from .env
require("dotenv").config({ path: ".env" });

const { FigmaExporter } = require("figma-export-assets");

const config = {
	figmaPersonalToken: process.env.figma_token,
	fileId: process.env.figma_file_id,
	page: "📎 assets",
	assetsPath: "src",
};

async function main() {
	// 0. Initialize exporter
	const figma = new FigmaExporter(config);

	// 1. Get an array of all assets in the Figma file
	let assets = await figma.getAssets();

	// 2. Create SVGs (Figma API)
	svgs = await figma.exportAssets(assets, "svg");

	const svgDownloads = svgs.map(async (asset) => {
		// 3. Download each exported asset
		await figma.saveAsset(asset);
		console.log(`Downloaded ${asset.name} as svg`);
	});

	await Promise.all(svgDownloads);
}

// Run everything
main();
```

## Example: Individual Asset Handling

```js
// get figmaPersonalToken and fileId from .env
require("dotenv").config({ path: ".env" });

const { FigmaExporter } = require("figma-export-assets");

const config = {
	figmaPersonalToken: process.env.figma_token,
	fileId: process.env.figma_file_id,
	page: "📎 assets",
	assetsPath: "src",
};

async function main() {
	// 0. Initialize exporter
	const figma = new FigmaExporter(config);

	// Helper function to optimize the path coming from Figma
	const optimizePath = (path) =>
		path.replace("assets/", "").replace("name=", "").replace(".png", "");

	// 1. Get an array of all assets in the Figma file
	let assets = await figma.getAssets();

	// 2. Create PNGs

	// 2a. Select all assets which have `.png` in their name in Figma
	let pngs = assets.filter((asset) => asset.name.includes(".png"));
	// 2b. Let Figma export the assets as PNGs with a scale of 4
	pngs = await figma.exportAssets(pngs, "png", 4);
	const pngDownloads = pngs.map(async (asset) => {
		// 2c. Download each exported asset
		await figma.saveAsset(asset, {
			// 2d. Optimize the path coming from Figma
			path: optimizePath(asset.name),
		});
		console.log(`Downloaded ${asset.name} as png`);
	});
	await Promise.all(pngDownloads);

	// 3. Create SVGs

	// 3a. Select all assets which do NOT have `.png` in their name in Figma
	let svgs = assets.filter((asset) => !asset.name.includes(".png"));
	// 3b. Let Figma export the assets as SVGs
	svgs = await figma.exportAssets(svgs, "svg");
	const svgDownloads = svgs.map(async (asset) => {
		// 3c. Download each exported asset
		await figma.saveAsset(asset, {
			// 3d. Optimize the path coming from Figma
			name: optimizePath(asset.name),
		});
		console.log(`Downloaded ${asset.name} as svg`);
	});
	await Promise.all(svgDownloads);
}

// Run everything
main();
```

## Constructor

### `constructor(config)`

Creates a new instance of the FigmaExporter.

#### Parameters

-   `config`: An object containing configuration settings.
    -   `baseURL` (string, optional): The base URL for the Figma API. Defaults to `'https://api.figma.com/v1'`.
    -   `format` (string, optional): The format of the exported assets. Defaults to `'svg'`.
    -   `assetsPath` (string, required): The path to save the exported assets to.
    -   `scale` (number, optional): The scale at which to export assets. Defaults to `1`.
    -   `exportVariants` (boolean, optional): Whether to export variants of the assets. Defaults to `true`.
    -   `figmaPersonalToken` (string, required): Personal access token for the Figma API.
    -   `fileId` (string, required): The ID of the Figma file to export assets from.
    -   `page` (string, required): The name of the page to export assets from.
    -   `frame` (string, optional): The name of the frame to export assets from.

## Methods

### `getAssets()`

Fetches assets from Figma using the configured settings.

#### Returns

-   `Promise<Array>`: A promise that resolves to an array of assets.

### `exportAssets(assets, format?, scale?, batchSize?)`

Exports assets from Figma in batches.

#### Parameters

-   `assets` (Array): The assets to export.
-   `format` (string, optional): The format to export the assets in. Defaults to `'svg'`.
-   `scale` (number, optional): The scale at which to export the assets. Defaults to `1`.
-   `batchSize` (number, optional): The number of assets to export in each batch. Defaults to `100`.

#### Returns

-   `Promise<Array>`: A promise that resolves to an array of exported assets.

### `saveAsset(asset, overrideConfig?)`

Saves an exported asset to the configured assets path.

#### Parameters

-   `asset` (Object): The asset to save.
-   `overrideConfig` (Object, optional): Overrides for the exporter configuration.
    -   `name` (string, optional): Overrides the name of the asset.
    -   `format` (string, optional): The format of the exported asset. Defaults to `'svg'`.
    -   `assetsPath` (string, optional): The path to save the exported asset to.
    -   `scale` (number, optional): The scale at which to export the asset. Defaults to `1`.

#### Returns

-   `Promise`: A promise that resolves when the asset has been saved.
