import urllib.request
import json
import os
from PIL import Image
import io

# URL of Pinterest Logo on Wikimedia
url = "https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png"

# Setup the folders
iconset_path = "ios/App/Assets.xcassets/AppIcon.appiconset"
os.makedirs(iconset_path, exist_ok=True)

print("Downloading icon...")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    img_data = response.read()

img = Image.open(io.BytesIO(img_data)).convert("RGBA")

# Create white background to replace transparency if any, because iOS icons cannot be transparent
background = Image.new("RGBA", img.size, (255, 255, 255, 255))
img_with_bg = Image.alpha_composite(background, img)
img_final = img_with_bg.convert("RGB") # Remove alpha channel

sizes = [
    (20, 1, "ipad"),
    (20, 2, "ipad"),
    (29, 1, "ipad"),
    (29, 2, "ipad"),
    (40, 1, "ipad"),
    (40, 2, "ipad"),
    (76, 1, "ipad"),
    (76, 2, "ipad"),
    (83.5, 2, "ipad"),
    (20, 2, "iphone"),
    (20, 3, "iphone"),
    (29, 2, "iphone"),
    (29, 3, "iphone"),
    (40, 2, "iphone"),
    (40, 3, "iphone"),
    (60, 2, "iphone"),
    (60, 3, "iphone"),
    (1024, 1, "ios-marketing")
]

images_json = []

for size, scale, idiom in sizes:
    actual_size = int(size * scale)
    filename = f"Icon-{size}x{size}@{scale}x-{idiom}.png"
    filepath = os.path.join(iconset_path, filename)
    
    resized = img_final.resize((actual_size, actual_size), Image.Resampling.LANCZOS)
    resized.save(filepath)
    
    images_json.append({
        "size": f"{size}x{size}" if size.is_integer() else f"{size}x{size}",
        "idiom": idiom,
        "filename": filename,
        "scale": f"{scale}x"
    })

# Write Contents.json
contents = {
    "images": images_json,
    "info": {
        "version": 1,
        "author": "xcode"
    }
}

with open(os.path.join(iconset_path, "Contents.json"), "w") as f:
    json.dump(contents, f, indent=2)

print("Icons generated successfully!")
