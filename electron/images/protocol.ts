import { net, protocol } from "electron";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { imagePath } from "./store";

// img://local/<ref> serves an image, img://local/<ref>/thumb its thumbnail
export const IMAGE_SCHEME = "img";

// Has to run before the app is ready: lets the page load img:// URLs like any other images
export function registerImageScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
}

export function handleImageRequests(dir: string) {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const [ref, variant] = new URL(request.url).pathname.split("/").filter(Boolean);
    const file = imagePath(dir, ref ?? "", variant === "thumb");
    if (!file || !fs.existsSync(file)) return new Response(null, { status: 404 });

    const response = await net.fetch(pathToFileURL(file).toString());
    // A reference always means the same bytes, so the browser can keep it forever
    return new Response(response.body, {
      headers: { "content-type": response.headers.get("content-type") ?? "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" },
    });
  });
}
