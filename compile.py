#
# Compile the RoyalUr website into a smaller, coherent unit.
#

import os
import sys
import json
import subprocess
from PIL import Image as PILImage


#
# Utility Functions
#

def execute_command(*command, **kwargs):
    """
    Shorthand to execute a single command.
    """
    return execute_piped_commands(command, **kwargs)


def execute_piped_commands(*commands, **kwargs):
    """
    Executes the given commands where the output of each is piped to the next.
    The last command can be a string filename, in which case the final output will be written to the file.
    Returns whether execution was successful.
    """
    prefix = kwargs.pop("prefix", "")

    output_file = None
    if isinstance(commands[-1], str):
        output_file = commands[-1]
        commands = commands[:-1]

    last_process = None
    for index in range(len(commands)):
        command = commands[index]
        command_print = (" | " if index > 0 else "") + " ".join(command)

        pipe_out = subprocess.PIPE
        if index == len(commands) - 1 and output_file is not None:
            pipe_out = open(output_file, 'w')
            command_print += " > " + output_file

        print(prefix + command_print)
        if last_process is None:
            last_process = subprocess.Popen(command, stdout=pipe_out)
        else:
            last_process = subprocess.Popen(command, stdin=last_process.stdout, stdout=pipe_out)

    try:
        stdout, stderr = last_process.communicate()
        stdout = ("" if stdout is None else stdout.decode('utf-8'))
        stderr = ("" if stderr is None else stderr.decode('utf-8'))
        ret_code = last_process.returncode

        if stdout != "":
            print(prefix + "STDOUT:", stdout)
        if stderr != "":
            print(prefix + "STDERR", stderr, file=sys.stderr)

        if ret_code < 0:
            print(prefix + "Execution of", commands[-1], "was terminated by signal:", -ret_code, file=sys.stderr)
        elif ret_code != 0:
            print(prefix + "Command", commands[-1], "resulted in the non-zero return code:", ret_code, file=sys.stderr)

        return ret_code == 0
    except OSError as error:
        print(prefix + "Execution of", commands[-1], "failed:", error, file=sys.stderr)
        return False


#
# Compilation Specification
#

class CompilationSpec:
    def __init__(self, spec_json):
        self.js_files = spec_json["javascript"]
        self.res_files = spec_json["resources"]
        self.annotation_files = spec_json["annotations"]

        self.image_size_classes = {}
        for spec, name in spec_json["image_size_classes"].items():
            self.image_size_classes[spec] = ImageSizeClass(spec, name)

        self.image_size_groups = {}
        for name, size_specs in spec_json["image_size_groups"].items():
            self.image_size_groups[name] = ImageSizeGroup(name, size_specs)

        self.images = {}
        for from_rel, spec in spec_json["images"].items():
            image = Image(from_rel, spec)
            self.images[from_rel] = image
            if image.size_group is not None:
                if image.size_group not in self.image_size_groups:
                    raise Exception("Unknown size group {} for image {}".format(image.size_group, from_rel))
                image.sizes = self.image_size_groups[image.size_group]

        self.sprites = {}
        for to_rel, input_images in spec_json["sprites"].items():
            images = []
            for image_from_rel in input_images:
                if image_from_rel not in self.images:
                    raise Exception("Unknown image {} for sprite {}".format(image_from_rel, to_rel))
                images.append(self.images[image_from_rel])
            self.sprites[to_rel] = Sprite(to_rel, images)

    @staticmethod
    def read(file):
        with open(file, 'r') as f:
            spec_json = json.load(f)
        return CompilationSpec(spec_json)


class ImageSizeClass:
    def __init__(self, spec, name):
        self.spec = spec
        self.name = name
        spec_wh = spec.split("_", 2)
        self.width = -1 if spec_wh[0] == "u" else int(spec_wh[0])
        self.height = -1 if spec_wh[1] == "u" else int(spec_wh[1])


class ImageSizeGroup:
    def __init__(self, name, spec):
        self.name = name
        self.sizes = {}
        for size_class, size_spec in spec.items():
            self.sizes[size_class] = ImageSize(size_spec)
        # Each size group should contain the original copy size.
        if "u_u" not in self.sizes:
            self.sizes["u_u"] = ImageSize("auto x auto")

    def items(self):
        return self.sizes.items()


class ImageSize:
    def __init__(self, spec):
        self.spec = spec
        spec_wh = spec.split("x", 2)
        w = spec_wh[0].strip()
        h = spec_wh[1].strip()
        self.width = -1 if w == "auto" else int(w)
        self.height = -1 if h == "auto" else int(h)

    def calc_width(self, original_width, original_height):
        if self.width > 0:
            return self.width
        if self.height <= 0:
            return original_width
        return int(original_width * self.height / original_height)

    def calc_height(self, original_width, original_height):
        if self.height > 0:
            return self.height
        if self.width <= 0:
            return original_height
        return int(original_height * self.width / original_width)


class Image:
    def __init__(self, from_rel, spec):
        self.from_rel = from_rel
        self.to_rel = spec["dest"] if "dest" in spec else None
        self.size_group = spec["size_group"] if "size_group" in spec else None
        self.sizes = None
        # If no size group is given, it must be directly specified.
        if "sizes" in spec:
            if self.size_group is not None:
                raise Exception("Cannot specify both a size_group and sizes")
            self.sizes = ImageSizeGroup("Direct:" + from_rel, spec["sizes"])
        elif self.size_group is None:
            raise Exception("Must specify either a size_group or sizes")

        # May be populated later.
        self.original_image = None
        self.scaled_copies = None

    def get_original(self):
        if self.original_image is None:
            self.original_image = PILImage.open(self.from_rel)
        return self.original_image

    def get_scaled_copies(self):
        if self.scaled_copies is not None:
            return self.scaled_copies
        original = self.get_original()

        self.scaled_copies = {}
        for size_class, size in self.sizes.items():
            width = size.calc_width(*original.size)
            height = size.calc_height(*original.size)
            self.scaled_copies[size_class] = original.resize((width, height), PILImage.LANCZOS)
        return self.scaled_copies


class Sprite:
    def __init__(self, to_rel, images):
        self.to_rel = to_rel
        self.images = images
        self.scaled_copies = None

    def get_scaled_copies(self):
        if self.scaled_copies is not None:
            return self.scaled_copies
        scales = {}
        # First figure out all of the available scales.
        for image in self.images:
            scaled_copies = image.get_scaled_copies()
            for size_class, scaled_copy in image.get_scaled_copies().items():
                scales[size_class] = {}
        # Then add all of the scaled copies.
        for image in self.images:
            scaled_copies = image.get_scaled_copies()
            for size_class in scales.keys():
                if size_class not in scaled_copies:
                    raise Exception("Image {} is missing size class {} for generating sprite {}".format(
                        image.from_rel, size_class, self.to_rel
                    ))
                scales[size_class][image.from_rel] = scaled_copies[size_class]
        # Generate each sprite image for each size class.
        self.scaled_copies = {}
        for size_class, images in scales.items():
            self.scaled_copies[size_class] = SpriteInstance.create(images)
        return self.scaled_copies


class SpriteInstance:
    def __init__(self, image, annotations):
        self.image = image
        self.annotations = annotations

    @staticmethod
    def create(images):
        annotations = {}
        total_width = 0
        max_height = 0
        # Create the image annotations, and find the dimensions of the sprite.
        for image_from_rel, image in images.items():
            width, height = image.size
            annotations[image_from_rel] = {
                "width": width,
                "height": height,
                "x_offset": total_width,
                "y_offset": 0
            }
            total_width += width
            max_height = max(max_height, height)
        # Generate the sprite image.
        sprite_image = PILImage.new('RGBA', (total_width, max_height))
        x_offset = 0
        for image in images.values():
            sprite_image.paste(image, (x_offset, 0))
            x_offset += image.size[0]
        return SpriteInstance(sprite_image, annotations)


#
# Perform Compilation
#

def clean(target_folder, comp_spec, *, prefix=""):
    """
    Completely empty the compilation folder.
    """
    assert execute_command("rm", "-rf", target_folder, prefix=prefix)
    assert execute_command("mkdir", target_folder, prefix=prefix)


def combine_js(target_folder, comp_spec, *, prefix=""):
    """
    Concatenate all javascript into a single source file.
    """
    for to_rel, file_list in comp_spec.js_files.items():
        assert execute_piped_commands(
            ["npx", "babel", "--presets=@babel/env"] + file_list,
            os.path.join(target_folder, to_rel),
            prefix=prefix
        )


def combine_minify_js(target_folder, comp_spec, *, prefix=""):
    """
    Concatenate all javascript into a single source file, and minify it.
    """
    for to_rel, file_list in comp_spec.js_files.items():
        assert execute_piped_commands(
            ["npx", "babel", "--presets=@babel/env"] + file_list,
            ["uglifyjs", "--compress", "--mangle"],
            os.path.join(target_folder, to_rel),
            prefix=prefix
        )


def create_sprites(target_folder, comp_spec, *, prefix=""):
    """
    Concatenate groups of images into a single image.
    """
    sprite_annotations = {}

    for sprite_to_rel, sprite in comp_spec.sprites.items():
        for size_class, sprite_instance in sprite.get_scaled_copies().items():
            # Insert the size class into the path.
            to_rel = "{}.{}".format(sprite_to_rel, size_class)

            # Save the image and store its annotations.
            sprite_annotations[to_rel] = sprite_instance.annotations
            output_file = os.path.join(target_folder, to_rel)
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            sprite_instance.image.save(output_file + ".png")
            sprite_instance.image.save(output_file + ".webp")
            print("{}Created {}".format(prefix, to_rel))

    return sprite_annotations


def copy_resource_files(target_folder, comp_spec, *, prefix=""):
    """
    Copy all the resource files for the page into the target folder.
    """
    # Copy static files.
    for from_path, to_rel in comp_spec.res_files.items():
        to_path = os.path.join(target_folder, to_rel)
        os.makedirs(os.path.dirname(to_path), exist_ok=True)
        assert execute_piped_commands(["cp", from_path, to_path], prefix=prefix)

    # Copy and scale images.
    for from_rel, image in comp_spec.images.items():
        if image.to_rel is None:
            continue

        # Copy the original image.
        output_file = os.path.join(target_folder, image.to_rel)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        image.get_original().save(output_file + ".png")
        image.get_original().save(output_file + ".webp")
        print("{}Copied {}".format(prefix, image.to_rel))

        for size_class, scaled_image in image.get_scaled_copies().items():
            # Insert the size class into the path.
            to_rel = "{}.{}".format(image.to_rel, size_class)

            # Save the image.
            scaled_image.save(os.path.join(target_folder, to_rel) + ".png")
            scaled_image.save(os.path.join(target_folder, to_rel) + ".webp")
            print("{}Created {}".format(prefix, to_rel))

    # Create the favicon images.
    favicon_image = PILImage.open("res/favicon.png")
    favicon_96 = favicon_image.resize((96, 96), PILImage.LANCZOS)
    favicon_32 = favicon_image.resize((32, 32), PILImage.LANCZOS)
    favicon_16 = favicon_image.resize((16, 16), PILImage.LANCZOS)

    favicon_96.save(os.path.join(target_folder, "favicon.ico"), sizes=[(96, 96)])
    favicon_96.save(os.path.join(target_folder, "favicon96.ico"), sizes=[(96, 96)])
    favicon_32.save(os.path.join(target_folder, "favicon32.ico"), sizes=[(32, 32)])
    favicon_16.save(os.path.join(target_folder, "favicon16.ico"), sizes=[(16, 16)])


def requires_release_build(target_folder, comp_spec, *, prefix=""):
    """
    Check whether all resource files exist in the compiled directory.
    Does not check if any annotations or resource file contents have changed.
    """
    for fromPath, to_rel in comp_spec.res_files.items():
        to_rel = to_rel if len(to_rel) > 0 else fromPath
        to_path = os.path.join(target_folder, to_rel)
        if not os.path.exists(to_path):
            return True
    if not os.path.exists(target_folder + "/res/annotations.json"):
        return True
    return False


def combine_annotations(target_folder, comp_spec, additional_annotations, *, prefix=""):
    """
    Combine all resource annotations into their own file.
    """
    annotations = {**additional_annotations}
    for key, file in comp_spec.annotation_files.items():
        with open(file, "r") as f:
            annotations[key] = json.load(f)

    with open(target_folder + "/res/annotations.json", 'w') as f:
        json.dump(annotations, f, separators=(',', ':'))


def zip_development_res_folder(target_folder, comp_spec, *, prefix=""):
    """
    Creates a zip file with the full contents of the development resources folder.
    """
    output_file = os.path.join(target_folder, "res.zip")
    assert execute_piped_commands(["zip", "-q", "-r", output_file, "./res"], prefix=prefix)


def download_development_res_folder(*, prefix=""):
    """
    Downloads and unzips the development resources folder from https://royalur.net/res.zip.
    """
    assert not os.path.exists("./res"), "The ./res directory already exists"
    assert not os.path.exists("./res.zip"), "The ./res.zip archive already exists"
    assert execute_piped_commands(["wget", "-q", "https://royalur.net/res.zip", "-O", "./res.zip"], prefix=prefix)
    try:
        assert execute_piped_commands(["unzip", "-q", "./res.zip", "res/*"], prefix=prefix)
    finally:
        assert execute_piped_commands(["rm", "-f", "./res.zip"], prefix=prefix)


#
# Create the different types of builds.
#

def create_release_build(target_folder, prefix=""):
    sub_prefix = prefix + " .. "

    print(prefix)
    print(prefix + "Compiling Release Build")
    comp_spec = CompilationSpec.read("compilation.json")

    print(prefix)
    print(prefix + "1. Clean")
    clean(target_folder, comp_spec, prefix=sub_prefix)

    print(prefix)
    print(prefix + "2. Combine & Minify Javascript")
    combine_minify_js(target_folder, comp_spec, prefix=sub_prefix)

    print(prefix)
    print(prefix + "3. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=sub_prefix)

    print(prefix)
    print(prefix + "4. Create Sprites")
    sprite_annotations = create_sprites(target_folder, comp_spec, prefix=sub_prefix)

    print(prefix)
    print(prefix + "5. Create Annotations File")
    combine_annotations(target_folder, comp_spec, {
        "sprites": sprite_annotations
    }, prefix=sub_prefix)

    print(prefix)
    print(prefix + "6. Zip Development Resources Folder")
    zip_development_res_folder(target_folder, comp_spec, prefix=sub_prefix)

    print(prefix)
    print(prefix + "Done!\n")


def create_dev_build(target_folder):
    print("\nCompiling Development Build")
    comp_spec = CompilationSpec.read("compilation.json")

    print("\n1. Combine Javascript")
    combine_js(target_folder, comp_spec, prefix=" .. ")

    print("\n2. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")

    print("\n3. Create Sprites")
    sprite_annotations = create_sprites(target_folder, comp_spec, prefix=" .. ")

    print("\n4. Create Annotations File")
    combine_annotations(target_folder, comp_spec, {
        "sprites": sprite_annotations
    }, prefix=" .. ")

    print("\nDone!\n")


def create_jsdev_build(target_folder):
    print("\nCompiling Javascript Development Build")
    comp_spec = CompilationSpec.read("compilation.json")

    print("\n1. Check whether to revert to a Release Build")
    if requires_release_build(target_folder, comp_spec):
        print("\nERROR : Release build is required\n", file=sys.stderr)
        create_release_build(target_folder, prefix="| ")

    print("\n2. Combine Javascript")
    combine_js(target_folder, comp_spec, prefix=" .. ")

    print("\nDone!\n")


#
# Run the Compilation
#
DEV_MODE = "dev"
JS_DEV_MODE = "jsdev"
RELEASE_MODE = "release"

if len(sys.argv) != 2:
    print("Usage:")
    print("  python -m compile <" + DEV_MODE + ":" + JS_DEV_MODE + ":" + RELEASE_MODE + ">")
    sys.exit(1)

# Download the resources folder if it doesn't exist.
if not os.path.exists("./res"):
    print("Could not find ./res directory, attempting to download it...")
    download_development_res_folder(prefix=" .. ")

compilation_mode = (sys.argv[1] if len(sys.argv) == 2 else "")

if compilation_mode == RELEASE_MODE:
    create_release_build("compiled")
elif compilation_mode == JS_DEV_MODE:
    create_jsdev_build("compiled")
elif compilation_mode == DEV_MODE:
    create_dev_build("compiled")
else:
    if compilation_mode != "":
        print("Invalid compilation mode", compilation_mode)

    print("Usage:")
    print("  python -m compile <" + DEV_MODE + ":" + RELEASE_MODE + ">")
    sys.exit(1)
