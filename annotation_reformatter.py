#
# This is a tool to transform annotation files from the VGG annotation format saved
# from the Oxford annotation tool into a simpler format to be used by Royal Ur.
#
# Oxford Annotation Tool: http://www.robots.ox.ac.uk/~vgg/software/via/via_demo.html
#

import sys
import json
from PIL import Image


#
# Read the command-line arguments
#

if len(sys.argv) != 4:
    print("Usage:")
    print("  python3 -m annotation_reformatter <annotation file> <original image> <output file>")
    sys.exit(1)

annotation_file = sys.argv[1]
image_file = sys.argv[2]
output_file = sys.argv[3]


#
# Load the image to find its width and height
#

image = Image.open(image_file)
img_width = image.size[0]
img_height = image.size[1]


#
# Parse the file
#

def parse_region(region):
    shape = region["shape_attributes"]
    if shape["name"] != "rect":
        print("Can only work with rectangle regions")
        sys.exit(0)

    return [
        shape["x"] / img_width,
        shape["y"] / img_height,
        shape["width"] / img_width,
        shape["height"] / img_height
    ]


regions = []
with open(annotation_file, 'r') as f:
    data = json.load(f)
    images = data["_via_img_metadata"]

    if len(images.keys()) != 1:
        print("Expected annotation file to contain a single image")
        sys.exit(1)

    image = images[list(images.keys())[0]]
    for region in image["regions"]:
        regions.append(parse_region(region))


#
# Write the output file
#

with open(output_file, 'w') as f:
    json.dump(regions, f, separators=(',', ':'))
