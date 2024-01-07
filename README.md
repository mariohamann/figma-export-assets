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
-   🔄 Batch Exporting: Supports batch exporting out of the box to overcame Figma API export limits.
-   📁 Customizable Asset Paths/Names: Set unique saving paths or names for each asset.
-   🌈 Customizable Asset Format: Chose any Figma export format for each asset.
-   🚫 Asset Exclusion: Easily exclude specific assets from export based on their names.
-   ⚙️ Axios Integration: Extend or modify Axios configurations for advanced HTTP request handling.
-   🌟 Variant Exporting: Overridable option to export components with variants as separate assets.

## Minimal Example

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
	const figma = new FigmaExporter(config);

	const optimizePath = (path) =>
		path.replace("assets/", "").replace("name=", "").replace(".png", "");

	// Step 1: Get Assets
	let assets = await figma.getAssets();

	// Step 2: Create PNGs
	let pngs = assets.filter((asset) => asset.name.includes(".png"));
	pngs = await figma.exportAssets(pngs, "png", 4);
	const pngDownloads = pngs.map(async (asset) => {
		await figma.saveAsset(asset, {
			path: optimizePath(asset.name),
		});
		console.log(`Downloaded ${asset.name} as png`);
	});
	await Promise.all(pngDownloads);

	// Step 3: Create SVGs
	let svgs = assets.filter((asset) => !asset.name.includes(".png"));
	svgs = await figma.exportAssets(svgs, "svg");
	const svgDownloads = svgs.map(async (asset) => {
		await figma.saveAsset(asset, {
			name: optimizePath(asset.name),
		});
		console.log(`Downloaded ${asset.name} as svg`);
	});
	await Promise.all(svgDownloads);
}

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
    -   `axiosConfig` (Object, optional): Additional Axios configuration settings.
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

### `exportAssets(assets, format, scale, batchSize)`

Exports assets from Figma in batches.

#### Parameters

-   `assets` (Array): The assets to export.
-   `format` (string, optional): The format to export the assets in. Defaults to `'svg'`.
-   `scale` (number, optional): The scale at which to export the assets. Defaults to `1`.
-   `batchSize` (number, optional): The number of assets to export in each batch. Defaults to `100`.

#### Returns

-   `Promise<Array>`: A promise that resolves to an array of exported assets.

### `saveAsset(asset, overrideConfig)`

Saves assets to the configured assets path.

#### Parameters

-   `asset` (Object): The asset to save.
-   `overrideConfig` (Object, optional): Overrides for the exporter configuration.
    -   `name` (string, optional): Overrides the name of the asset.
    -   `format` (string, optional): The format of the exported assets. Defaults to `'svg'`.
    -   `assetsPath` (string, optional): The path to save the exported assets to.
    -   `scale` (number, optional): The scale at which to export assets. Defaults to `1`.

#### Returns

-   `Promise`: A promise that resolves when all assets have been saved.
