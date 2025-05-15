# figma-export-assets

## Install

```bash
npm install figma-export-assets
```

## Description

A highly customizable package for exporting assets from the Figma API in any supported format.

🙏🏻 Based on concepts by https://github.com/tsimenis/figma-export-icons and https://github.com/nate-summercook/figma-assets-exporter but with focus on customizability. Thanks to both of them for their work!

## Features

-   📄 Multiple Figma Pages/Frames: Configure to process assets from various Figma pages or specific frames.
-   🔄 Batch Exporting: Supports batch exporting out of the box to handle Figma API export limits.
-   📁 Customizable Asset Paths/Names: Set unique saving paths or names for each asset.
-   🌈 Customizable Asset Format: Choose any Figma export format for each asset.
-   🚫 Asset Exclusion: Easily exclude specific assets from export based on their names.
-   🌟 Variant Exporting: Overridable option to export components with variants as separate assets.

## Examples

### Basic Usage

```js
import { FigmaExporter } from "figma-export-assets";
import dotenv from "dotenv";
dotenv.config();

const exporter = new FigmaExporter({
	figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
	fileId: process.env.FILE_ID,
	page: process.env.PAGE,
	assetsPath: "src/assets",
	format: "svg",
});

await exporter.setAssets();
await exporter.createAssets();
```

### Export variants with custom names

```js
import { FigmaExporter } from "figma-export-assets";
import dotenv from "dotenv";
dotenv.config();

const exporter = new FigmaExporter({
	figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
	fileId: process.env.FILE_ID,
	page: process.env.PAGE,
	frame: "component",
	exportVariants: true,
	assetsPath: "src/assets",
	format: "svg",
});

await exporter.setAssets();

await exporter.createAssets((assets) =>
	assets.map((a) => ({
		...a,
		name: a.name.replace("component/", ""),
	}))
);
```

### Chaining exports to multiple formats/paths

```js
import { FigmaExporter } from "figma-export-assets";
import dotenv from "dotenv";
dotenv.config();

const baseConfig = {
	figmaPersonalToken: process.env.FIGMA_PERSONAL_TOKEN,
	fileId: process.env.FILE_ID,
	page: process.env.PAGE,
	exportVariants: true,
};

const exporter = new FigmaExporter(baseConfig);

await exporter.setAssets();

await exporter.createAssets(
	(assets) =>
		assets
			.filter((a) => !a.name.includes("images"))
			.map((a) => ({
				...a,
				name: a.name.replace("icons/", ""),
			})),
	{ assetsPath: "src/svg", format: "svg" }
);

await exporter.createAssets(
	(assets) =>
		assets
			.filter((a) => a.name.includes("images"))
			.map((a) => ({
				...a,
				name: a.name.replace("images/", ""),
			})),
	{ assetsPath: "src/jpg", format: "jpg" }
);
```

## Methods

### `constructor(config: Config)`

-   **Description**: Initializes the FigmaExporter instance with the provided configuration.
-   **Parameters**: `config` - The configuration object containing the Figma API token, file ID, page name, and other settings.

### `setAssets()`

-   **Description**: Sets the assets by fetching them from the Figma API.
-   **Parameters**: None
-   **Returns**: `Promise<FigmaExporter>` - The instance of the exporter with the assets set.

### `createAssets(assetTransformFn, config)`

-   **Description**: Creates assets by asking the Figma API for the assets and saving them to the specified path.
-   **Parameters**:
    -   `assetTransformFn`: Callback function to transform the assets before saving them. It receives the assets as an argument and should return an array of assets.
        -   **Parameters**: `assets: Asset[]` - The array of assets to transform.
        -   **Returns**: `Asset[]` - The transformed array of assets.
        -   **Example**: `(assets) => assets.map((a) => ({ ...a, name: a.name.replace("component/", "") }))`
    -   `config`: Optional configuration object to override the default settings for this export.
-   **Returns**: `Promise<FigmaExporter>` - The instance of the exporter with the assets set.

## Parameters

### Config

This can be overriden in every `createAssets` call.

```typescript
{
    /**
     * - Personal access token for the Figma API.
     */
    figmaPersonalToken: string;
    /**
     * - The ID of the Figma file to export assets from.
     */
    fileId: string;
    /**
     * - The name of the page to export assets from.
     */
    page: string;
    /**
     * - The path to save the exported assets.
     */
    assetsPath: string;
    /**
     * - The format of the exported assets.
     */
    format?: string;
    /**
     * - The scale at which to export assets.
     */
    scale?: number;
    /**
     * - Whether to export variants of the assets.
     */
    exportVariants?: boolean;
    /**
     * - The name of the frame to export assets from.
     */
    frame?: string;
    /**
     * - Maximum number of nested levels to traverse in the Figma file.
     */
    depth?: number;
    /**
     * - The number of assets to export in each batch.
     */
    batchSize?: number;
    /**
     * - The maximum number of concurrent requests.
     */
    concurrencyLimit?: number;
    /**
     * - Whether to skip existing files.
     */
    skipExistingFiles?: boolean;
};
```

### Asset

This can be overriden in every `createAssets` call to optimize paths or names.

```ts
{
    /**
     * - The ID of the asset.
     */
    id: string;
    /**
     * - The name of the asset.
     */
    name: string;
    /**
     * - The URL of the asset image.
     */
    url?: string;
    /**
     * - The path to save the asset.
     */
    assetsPath?: string;
}
```

## Contributing

### Versioning

Create a changeset via `pnpm changeset` that describes the changes you made to the codebase. This will be used to generate a changelog entry and version bump. It will be picked up by the release workflow.

### Testing

The tests are based on the following file: https://www.figma.com/design/fgP5dbJzh1bnZqMgnDXoyd/test?node-id=0-1&p=f&t=5uSDKcMwgBqsYBg0-11

To test yourself, duplicate the file to your drafts and add the needed data to the `.env` file (see `.env.example`).
