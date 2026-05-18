# MC Painting Maker

A browser-based tool that turns your images into Minecraft Bedrock custom paintings.
Drop images, choose dimensions in blocks, optionally crop / resize / move the image
inside the canvas, and export a `.mcaddon` that adds each painting as an independent
custom entity placeable with its own vanilla spawn egg.

Compatible with Bedrock 1.21.30+ and Minecraft Education Edition.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173/`).

## Build static site

```bash
npm run build
```

Output goes to `dist/`. Deployable to GitHub Pages (workflow included).

## Tests

```bash
npm test
```

## Manual verification in Minecraft

After exporting a `.mcaddon`:

1. Open the file with Minecraft Bedrock - both packs install.
2. Create a world with both packs enabled (Behaviour and Resources).
3. Open the Creative inventory → the `items` category contains a
   "Custom Paintings" (or your configured name) group with one spawn egg per painting.
4. Use a spawn egg against a wall. The painting should:
   - Appear flush with the wall.
   - Snap to the nearest cardinal direction.
   - Be hittable across its full width and height.
5. Punching the painting despawns it.

## License

MIT.
