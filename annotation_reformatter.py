#
# This is a tool to transform annotation files from the VGG annotation format saved
# from the Oxford annotation tool into a simpler format to be used by Royal Ur.
#
# Oxford Annotation Tool: http://www.robots.ox.ac.uk/~vgg/software/via/via_demo.html
#

import sys
import json


#
# Read the command-line arguments
#

if len(sys.argv) != 4:
    print("Usage:")
    print("  python -m annotation_reformatter <annotation file> <output name> <output file>")
    sys.exit(1)

annotation_file = sys.argv[1]
output_name = sys.argv[2]
output_file = sys.argv[3]


#
# Parse the file
#

def parse_region(region):
    shape = region["shape_attributes"]
    if shape["name"] != "rect":
        print("Can only work with rectangle regions")
        sys.exit(0)

    return [
        shape["x"],
        shape["y"],
        shape["width"],
        shape["height"]
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
    json.dump({
        output_name: regions
    }, f, separators=(',', ':'))
