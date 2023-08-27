# figma-export-assets

Example implementation

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
