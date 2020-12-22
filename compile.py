#
# Compile the RoyalUr website into a smaller, coherent unit.
#

import os
import sys
import json
import subprocess
import shutil
from PIL import Image as PILImage


#
# Utility Functions
#

def getmtime(filename):
    try:
        return os.path.getmtime(filename)
    except FileNotFoundError:
        return -1


def append_size_class(path, size_class):
    if size_class == "u_u":
        return path
    return "{}.{}".format(path, size_class)


def execute_command(*command, **kwargs):
    return execute_piped_commands(command, **kwargs)


def execute_piped_commands(*commands, prefix=""):
    """
    Executes the given commands where the output of each is piped to the next.
    The last command can be a string filename, in which case the final output will be written to the file.
    Returns whether execution was successful.
    """
    # See if the command output should be piped to a file.
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
            print(prefix + "STDERR:", stderr, file=sys.stderr)
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
        css_spec = spec_json["css"]
        self.css_source = css_spec["source"]
        self.css_dest = css_spec["dest"]

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

    def __getitem__(self, key):
        return self.sizes[key]

    def keys(self):
        return self.sizes.keys()

    def values(self):
        return self.sizes.values()

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

    def get_original(self):
        if self.original_image is None:
            self.original_image = PILImage.open(self.from_rel)
        return self.original_image

    def get_scaled(self, size):
        original = self.get_original()
        width = size.calc_width(*original.size)
        height = size.calc_height(*original.size)
        return original.resize((width, height), PILImage.LANCZOS)

    def save_image_copies(self, target_folder, *, prefix=""):
        original = self.get_original()
        mtime = getmtime(self.from_rel)

        # Make sure the directory to copy the image to exists.
        output_file = os.path.join(target_folder, self.to_rel)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # Create the scaled copies.
        for size_class, size in self.sizes.items():
            # Check if the scaled copy already exists.
            scaled_file = append_size_class(output_file, size_class)
            scaled_file_png = scaled_file + ".png"
            scaled_file_webp = scaled_file + ".webp"
            if mtime <= getmtime(scaled_file_png) and mtime <= getmtime(scaled_file_webp):
                continue

            # Save the scaled copies.
            scaled_image = self.get_scaled(size)
            scaled_image.save(scaled_file_png)
            print("{}created {}".format(prefix, scaled_file_png))
            scaled_image.save(scaled_file_webp)
            print("{}created {}".format(prefix, scaled_file_webp))


class Sprite:
    def __init__(self, to_rel, images):
        self.to_rel = to_rel
        self.images = images
        size_classes = self.get_size_classes()
        for image in images:
            if image.sizes.keys() != size_classes:
                raise Exception("Images have inconsistent sets of size classes")

    def get_mod_time(self):
        return min(getmtime(image.from_rel) for image in self.images)

    def get_size_classes(self):
        return set().union(*(image.sizes.keys() for image in self.images))

    def save_sprite_copies(self, target_folder, *, prefix=""):
        mtime = self.get_mod_time()

        # Make sure the directory to create the sprites in exists.
        output_file = os.path.join(target_folder, self.to_rel)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # Create the scaled sprites.
        sprite_annotations = {}
        for size_class in self.get_size_classes():
            # Generate the sprite's annotations.
            to_rel = append_size_class(self.to_rel, size_class)
            annotations, total_width, max_height = self.generate_sprite_annotations(size_class)
            sprite_annotations[to_rel] = annotations

            # Determine whether we need to generate the sprite image itself.
            scaled_file = append_size_class(output_file, size_class)
            scaled_file_png = scaled_file + ".png"
            scaled_file_webp = scaled_file + ".webp"
            if mtime <= getmtime(scaled_file_png) and mtime <= getmtime(scaled_file_webp):
                continue

            # Generate the sprite image.
            sprite_image = self.generate_sprite_image(size_class, total_width, max_height)
            sprite_image.save(scaled_file_png)
            print("{}created {}".format(prefix, scaled_file_png))
            sprite_image.save(scaled_file_webp)
            print("{}created {}".format(prefix, scaled_file_webp))

        return sprite_annotations

    def generate_sprite_annotations(self, size_class):
        annotations = {}
        total_width = 0
        max_height = 0
        for image in self.images:
            size = image.sizes[size_class]
            width = size.calc_width(*image.get_original().size)
            height = size.calc_height(*image.get_original().size)
            annotations[image.from_rel] = {
                "width": width,
                "height": height,
                "x_offset": total_width,
                "y_offset": 0
            }
            total_width += width
            max_height = max(max_height, height)

        return annotations, total_width, max_height

    def generate_sprite_image(self, size_class, total_width, max_height):
        sprite_image = PILImage.new('RGBA', (total_width, max_height))
        x_offset = 0
        for image in self.images:
            scaled_image = image.get_scaled(image.sizes[size_class])
            sprite_image.paste(scaled_image, (x_offset, 0))
            x_offset += scaled_image.size[0]
        return sprite_image


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


def minify_css(target_folder, comp_spec, *, prefix=""):
    """
    Minify the CSS of the website.
    """
    assert execute_piped_commands(
        ["uglifycss", comp_spec.css_source],
        os.path.join(target_folder, comp_spec.css_dest),
        prefix=prefix
    )


def create_sprites(target_folder, comp_spec, *, prefix=""):
    """
    Concatenate groups of images into a single image.
    """
    sprite_annotations = {}
    for sprite in comp_spec.sprites.values():
        sprite_annotations.update(sprite.save_sprite_copies(target_folder, prefix=prefix))
    return sprite_annotations


def copy_resource_files(target_folder, comp_spec, *, prefix=""):
    """
    Copy all the resource files for the page into the target folder.
    """
    # Copy static files.
    for from_path, to_rel in comp_spec.res_files.items():
        to_path = os.path.join(target_folder, to_rel)
        if getmtime(from_path) <= getmtime(to_path):
            continue

        os.makedirs(os.path.dirname(to_path), exist_ok=True)
        shutil.copyfile(from_path, to_path)
        print("{}copied {}".format(prefix, to_rel))

    # Copy and scale images.
    for from_rel, image in comp_spec.images.items():
        if image.to_rel is not None:
            image.save_image_copies(target_folder, prefix=prefix)

    # Create the favicon images.
    favicon_image = PILImage.open("res/favicon.png")
    favicon_96 = favicon_image.resize((96, 96), PILImage.LANCZOS)
    favicon_32 = favicon_image.resize((32, 32), PILImage.LANCZOS)
    favicon_16 = favicon_image.resize((16, 16), PILImage.LANCZOS)

    favicon_96.save(os.path.join(target_folder, "favicon.ico"), sizes=[(96, 96)])
    favicon_96.save(os.path.join(target_folder, "favicon96.ico"), sizes=[(96, 96)])
    favicon_32.save(os.path.join(target_folder, "favicon32.ico"), sizes=[(32, 32)])
    favicon_16.save(os.path.join(target_folder, "favicon16.ico"), sizes=[(16, 16)])


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
    assert execute_command("zip", "-q", "-r", output_file, "./res", prefix=prefix)


def download_development_res_folder(*, prefix=""):
    """
    Downloads and unzips the development resources folder from https://royalur.net/res.zip.
    """
    assert not os.path.exists("./res"), "The ./res directory already exists"
    assert not os.path.exists("./res.zip"), "The ./res.zip archive already exists"
    assert execute_command("wget", "-q", "https://royalur.net/res.zip", "-O", "./res.zip", prefix=prefix)
    try:
        assert execute_command("unzip", "-q", "./res.zip", "res/*", prefix=prefix)
    finally:
        assert execute_command("rm", "-f", "./res.zip", prefix=prefix)


#
# Create the different types of builds.
#

def create_release_build(target_folder):
    print("\nCompiling Release Build")
    comp_spec = CompilationSpec.read("compilation.json")

    print("\n1. Clean")
    clean(target_folder, comp_spec, prefix=" .. ")

    print("\n2. Combine & Minify Javascript")
    combine_minify_js(target_folder, comp_spec, prefix=" .. ")

    print("\n3. Minify CSS")
    minify_css(target_folder, comp_spec, prefix=" .. ")

    print("\n4. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")

    print("\n5. Create Sprites")
    sprite_annotations = create_sprites(target_folder, comp_spec, prefix=" .. ")

    print("\n6. Create Annotations File")
    combine_annotations(target_folder, comp_spec, {
        "sprites": sprite_annotations
    }, prefix=" .. ")

    print("\n7. Zip Development Resources Folder")
    zip_development_res_folder(target_folder, comp_spec, prefix=" .. ")

    print("\nDone!\n")


def create_dev_build(target_folder):
    print("\nCompiling Development Build")
    comp_spec = CompilationSpec.read("compilation.json")

    print("\n1. Combine Javascript")
    combine_js(target_folder, comp_spec, prefix=" .. ")

    print("\n2. Minify CSS")
    minify_css(target_folder, comp_spec, prefix=" .. ")

    print("\n3. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")

    print("\n4. Create Sprites")
    sprite_annotations = create_sprites(target_folder, comp_spec, prefix=" .. ")

    print("\n5. Create Annotations File")
    combine_annotations(target_folder, comp_spec, {
        "sprites": sprite_annotations
    }, prefix=" .. ")

    print("\nDone!\n")


def create_nojs_build(target_folder):
    print("\nCompiling Development NoJS Build")
    comp_spec = CompilationSpec.read("compilation.json")

    print("\n1. Minify CSS")
    minify_css(target_folder, comp_spec, prefix=" .. ")

    print("\n2. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")

    print("\n3. Create Sprites")
    sprite_annotations = create_sprites(target_folder, comp_spec, prefix=" .. ")

    print("\n4. Create Annotations File")
    combine_annotations(target_folder, comp_spec, {
        "sprites": sprite_annotations
    }, prefix=" .. ")

    print("\nDone!\n")


#
# Run the Compilation
#
if __name__ == "__main__":
    # Download the resources folder if it doesn't exist.
    if not os.path.exists("./res"):
        print("Could not find ./res directory, attempting to download it...")
        download_development_res_folder(prefix=" .. ")

    # Detect the compilation mode, and start it.
    mode = (sys.argv[1] if len(sys.argv) == 2 else "")
    if mode == "release":
        create_release_build("compiled")
    elif mode == "dev":
        create_dev_build("compiled")
    elif mode == "nojs":
        create_nojs_build("compiled")
    else:
        if mode != "":
            print("Invalid compilation mode", mode)

        print("Usage:")
        print("  python -m compile <dev:release>")
        sys.exit(1)
